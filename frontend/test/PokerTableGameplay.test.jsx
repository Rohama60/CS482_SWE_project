/**
 * @jest-environment jsdom
 */
// The regular (seated) table screen: starting the game, getting your cards from the server,
// live updates, picking cards, drawing, leaving, and the How to play guide.
import '@testing-library/jest-dom'
import { screen, fireEvent, waitFor, render } from '@testing-library/react'
import { socket } from '../src/socket'
import { TABLE, SEATS, GAME, renderTable, startGame, serverSends, callFor } from './helpers/tableScreen.jsx'

jest.mock('../src/socket', () => ({
  socket: { connected: false, id: 'sock1', on: jest.fn(), off: jest.fn(), emit: jest.fn(), connect: jest.fn() },
}))
jest.mock('../src/AuthClient.ts', () => ({ authClient: { useSession: jest.fn() } }))
jest.mock('../src/guestSession.ts', () => ({ getGuest: jest.fn() }))

const card = (rank, suit) => screen.getByRole('button', { name: new RegExp(`^${rank} of ${suit};`) })
const isMarked = (rank, suit) => card(rank, suit).getAttribute('aria-pressed') === 'true'

function reply(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) })
}

beforeEach(() => {
  jest.clearAllMocks()
  socket.connected = false
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('Before the game starts', () => {
  test('shows Waiting for Game with a Start Game button', async () => {
    await renderTable()
    expect(screen.getByText('Waiting for Game')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start Game' })).toBeEnabled()
    expect(screen.getByText('Waiting for cards...')).toBeInTheDocument()
  })

  test('loads who is sitting at the table', async () => {
    await renderTable()
    expect(screen.getByText('Josue')).toBeInTheDocument()
    expect(screen.getByText('Guest-1234')).toBeInTheDocument()
    expect(screen.getByText('3 / 4')).toBeInTheDocument()
  })

  test('your own seat shows your name, not another player seat', async () => {
    await renderTable()
    // Preston appears once, on your own nameplate at the bottom
    expect(screen.getAllByText('Preston')).toHaveLength(1)
  })

  test('a guest finds their own seat by guest id', async () => {
    await renderTable({ user: null, guest: { id: 'g1' } })
    expect(screen.getAllByText('Guest-1234')).toHaveLength(1)
    expect(screen.getByText('Preston')).toBeInTheDocument()
  })

  test('if the seats cannot load, the table still shows', async () => {
    await renderTable({ seats: [], overrides: { [`GET /api/tables/${TABLE.id}`]: () => reply({}, false) } })
    expect(screen.getByText('Waiting for Game')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
  })
})

describe('Starting the game', () => {
  test('Start Game asks the server to start a game for this table', async () => {
    await renderTable()
    await startGame()
    const [, options] = callFor('POST /api/games')
    expect(JSON.parse(options.body)).toEqual({ tableId: TABLE.id })
  })

  test('shows the pot and the blinds', async () => {
    await renderTable()
    await startGame()
    expect(screen.getByText('$3')).toBeInTheDocument()
    expect(screen.getByText('Small Blind · $1')).toBeInTheDocument()
    expect(screen.getByText('Big Blind · $2')).toBeInTheDocument()
  })

  test('your cards come from the server with suit symbols', async () => {
    await renderTable()
    await startGame()
    expect(await screen.findByRole('button', { name: /^A of ♠;/ })).toBeInTheDocument()
    expect(card('10', '♦')).toBeInTheDocument()
    expect(card('7', '♣')).toBeInTheDocument()
  })

  test('a guest sends their guest id when asking for cards', async () => {
    await renderTable({ user: null, guest: { id: 'g1' } })
    await startGame()
    await screen.findByRole('button', { name: /^A of ♠;/ })
    const [, options] = callFor(`GET /api/games/${GAME._id}/hand`)
    expect(options.headers).toEqual({ 'x-guest-id': 'g1' })
  })

  test('the button says Starting... while waiting', async () => {
    let finish
    await renderTable({ overrides: { 'POST /api/games': () => new Promise(r => { finish = r }) } })
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }))
    expect(await screen.findByRole('button', { name: 'Starting...' })).toBeDisabled()
    finish({ ok: false, json: () => Promise.resolve({}) })
    await screen.findByRole('button', { name: 'Start Game' })
  })

  test('a failed start shows an error', async () => {
    await renderTable({ overrides: { 'POST /api/games': () => reply({}, false) } })
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }))
    expect(await screen.findByText('Failed to start game')).toBeInTheDocument()
  })

  test('if the server cannot be reached, it shows a general error', async () => {
    await renderTable({ overrides: { 'POST /api/games': () => Promise.reject('down') } })
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }))
    expect(await screen.findByText('Unable to start game')).toBeInTheDocument()
  })

  // Note: the screen only shows errors before the game starts, so a card error is logged
  // and you stay on "Waiting for cards..." instead of seeing a message.
  test('if your cards cannot load, you stay on Waiting for cards', async () => {
    await renderTable({ overrides: { [`GET /api/games/${GAME._id}/hand`]: () => reply({ error: 'nope' }, false) } })
    await startGame()
    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error fetching hand:', expect.objectContaining({ message: 'nope' })))
    expect(screen.getByText('Waiting for cards...')).toBeInTheDocument()
  })

  test('a card error with no message uses the default one', async () => {
    await renderTable({ overrides: { [`GET /api/games/${GAME._id}/hand`]: () => reply({}, false) } })
    await startGame()
    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Error fetching hand:', expect.objectContaining({ message: 'Failed to retrieve cards' })))
  })
})

describe('Live updates', () => {
  test('joins the table room when the socket connects', async () => {
    await renderTable()
    expect(socket.connect).toHaveBeenCalled()
    serverSends('connect')
    expect(socket.emit).toHaveBeenCalledWith('join-table-room', TABLE.id)
  })

  test('joins right away if the socket is already connected', async () => {
    socket.connected = true
    await renderTable()
    expect(socket.connect).not.toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith('join-table-room', TABLE.id)
  })

  test('someone joining updates the seats without refreshing', async () => {
    await renderTable()
    serverSends('table-updated', { seats: [...SEATS, { kind: 'user', refId: 'u3', displayName: 'Ayana' }] })
    expect(await screen.findByText('Ayana')).toBeInTheDocument()
    expect(screen.getByText('4 / 4')).toBeInTheDocument()
  })

  test('an update with no seats empties the table', async () => {
    await renderTable()
    serverSends('table-updated', {})
    expect(await screen.findByText('0 / 4')).toBeInTheDocument()
  })

  test('when the host starts the game, everyone else gets their cards', async () => {
    await renderTable()
    serverSends('game-started', { gameId: GAME._id, game: GAME })
    expect(await screen.findByRole('button', { name: /^A of ♠;/ })).toBeInTheDocument()
  })

  test('leaving the screen stops listening and leaves the room', async () => {
    const { unmount } = await renderTable()
    unmount()
    expect(socket.off).toHaveBeenCalledWith('table-updated', expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith('game-started', expect.any(Function))
    expect(socket.emit).toHaveBeenCalledWith('leave-table-room', TABLE.id)
  })
})

describe('Picking cards and drawing', () => {
  async function dealt() {
    await renderTable()
    await startGame()
    await screen.findByRole('button', { name: /^A of ♠;/ })
  }

  test('nothing is marked at first, so the button says Draw', async () => {
    await dealt()
    expect(isMarked('10', '♦')).toBe(false)
    expect(screen.getByRole('button', { name: 'Draw' })).toBeInTheDocument()
    expect(screen.getByText('A pair of aces with a 10 kicker')).toBeInTheDocument()
  })

  test('clicking cards marks and unmarks them', async () => {
    await dealt()
    fireEvent.click(card('7', '♣'))
    fireEvent.click(card('3', '♥'))
    expect(screen.getByRole('button', { name: 'Draw 2' })).toBeInTheDocument()
    expect(screen.getByText('2 cards marked to discard')).toBeInTheDocument()
    fireEvent.click(card('3', '♥'))
    expect(isMarked('3', '♥')).toBe(false)
    expect(screen.getByRole('button', { name: 'Draw 1' })).toBeInTheDocument()
  })

  test('Draw replaces the marked cards and locks the hand', async () => {
    await dealt()
    fireEvent.click(card('7', '♣'))
    fireEvent.click(screen.getByRole('button', { name: 'Draw 1' }))
    expect(card('K', '♣')).toBeInTheDocument()
    expect(screen.getByText('Three of a kind — Aces')).toBeInTheDocument()
    fireEvent.click(card('A', '♠'))
    expect(isMarked('A', '♠')).toBe(false)
  })

  test('Stand pat ends the turn without changing any cards', async () => {
    await dealt()
    fireEvent.click(screen.getByRole('button', { name: 'Stand pat' }))
    expect(card('10', '♦')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deal next hand' })).toBeInTheDocument()
  })

  test('Deal next hand resets the hand', async () => {
    await dealt()
    fireEvent.click(screen.getByRole('button', { name: 'Stand pat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deal next hand' }))
    expect(screen.getByRole('button', { name: 'Draw 3' })).toBeInTheDocument()
    expect(screen.getByText('One pair — Aces')).toBeInTheDocument()
  })
})

describe('Leaving the table', () => {
  test('tells the server you left, then goes back to the lobby', async () => {
    const { onLeave } = await renderTable({ guest: { id: 'g1' } })
    fireEvent.click(screen.getByRole('button', { name: '← Leave table' }))
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1))
    const [, options] = callFor(`POST /api/tables/${TABLE.id}/leave`)
    expect(JSON.parse(options.body)).toEqual({ guestId: 'g1' })
  })

  test('stays on the table if leaving fails', async () => {
    const { onLeave } = await renderTable({
      overrides: { [`POST /api/tables/${TABLE.id}/leave`]: () => reply({ error: 'Not seated' }, false) },
    })
    fireEvent.click(screen.getByRole('button', { name: '← Leave table' }))
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(onLeave).not.toHaveBeenCalled()
  })

  test('a failed leave with no message still stays on the table', async () => {
    const { onLeave } = await renderTable({
      overrides: { [`POST /api/tables/${TABLE.id}/leave`]: () => reply({}, false) },
    })
    fireEvent.click(screen.getByRole('button', { name: '← Leave table' }))
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(onLeave).not.toHaveBeenCalled()
  })
})

describe('How to play guide', () => {
  // The ? at the top, then the How to play button in the side panel
  const helpButtons = () => screen.getAllByRole('button', { name: /how to play$/i })
  const guideTitle = () => screen.queryByText('How to play 5-card draw')

  test('both buttons open the guide', async () => {
    await renderTable()
    fireEvent.click(helpButtons()[0])
    expect(guideTitle()).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    fireEvent.click(helpButtons()[1])
    expect(guideTitle()).toBeInTheDocument()
  })

  test('the X closes the guide', async () => {
    await renderTable()
    fireEvent.click(helpButtons()[0])
    fireEvent.click(screen.getByRole('button', { name: 'Close how to play' }))
    expect(guideTitle()).not.toBeInTheDocument()
  })

  test('clicking outside closes it, clicking inside does not', async () => {
    await renderTable()
    fireEvent.click(helpButtons()[0])
    fireEvent.click(guideTitle())
    expect(guideTitle()).toBeInTheDocument()
    fireEvent.click(guideTitle().closest('.fixed'))
    expect(guideTitle()).not.toBeInTheDocument()
  })
})
