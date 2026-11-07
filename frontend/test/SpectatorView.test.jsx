/**
 * @jest-environment jsdom
 */
// P3 (Spectating) and P7 (invite code): the table screen when you are watching,
// compared with when you are seated.
import '@testing-library/jest-dom'
import { screen, fireEvent, within, waitFor } from '@testing-library/react'
import { socket } from '../src/socket'
import { TABLE, renderTable, startGame, serverSends, GAME, callFor } from './helpers/tableScreen.jsx'

jest.mock('../src/socket', () => ({
  socket: { connected: false, id: 'sock1', on: jest.fn(), off: jest.fn(), emit: jest.fn(), connect: jest.fn() },
}))
jest.mock('../src/AuthClient.ts', () => ({ authClient: { useSession: jest.fn() } }))
jest.mock('../src/guestSession.ts', () => ({ getGuest: jest.fn() }))

// Your own cards are buttons you can click to mark for discarding
const yourCards = () => screen.queryAllByRole('button', { name: /selected to discard|keep/ })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('Table screen while spectating (P3)', () => {
  test('shows the Spectating panel instead of your hand', async () => {
    await renderTable({ spectating: true })
    expect(screen.getByText('Spectating')).toBeInTheDocument()
    expect(screen.queryByText('Your hand')).not.toBeInTheDocument()
  })

  test('a spectator cannot start the game', async () => {
    await renderTable({ spectating: true })

    expect(
      screen.queryByRole('button', { name: /start game|^start$/i })
    ).not.toBeInTheDocument()

    expect(
      screen.queryByRole('button', { name: 'Ready' })
    ).not.toBeInTheDocument()
  })
  test('when the game starts, a spectator sees face-down cards and never gets a hand', async () => {
    await renderTable({ spectating: true })
    serverSends('game-started', { gameId: GAME._id, game: GAME })

    expect(await screen.findByText('Current pot')).toBeInTheDocument()
    expect(yourCards()).toHaveLength(0)
    expect(callFor(`GET /api/games/${GAME._id}/hand`)).toBeUndefined()
    expect(screen.queryByRole('button', { name: /Draw/ })).not.toBeInTheDocument()
  })

  test('says how many seats are open', async () => {
    await renderTable({ spectating: true })
    expect(screen.getByText('1 seat open')).toBeInTheDocument()
  })

  test('uses "seats" when more than one is open', async () => {
    await renderTable({ spectating: true, table: { ...TABLE, players: 2, max: 6 } })
    expect(screen.getByText('4 seats open')).toBeInTheDocument()
  })

  test('shows how many people are watching', async () => {
    await renderTable({ spectating: true, table: { ...TABLE, spectators: [{ refId: 'a' }, { refId: 'b' }] } })
    expect(screen.getByText(/2 watching/)).toBeInTheDocument()
  })

  test('counts you as the one watcher if the list is missing', async () => {
    await renderTable({ spectating: true, table: { ...TABLE, spectators: undefined } })
    expect(screen.getByText(/1 watching/)).toBeInTheDocument()
  })

  test('Take a Seat is clickable when a seat is open', async () => {
    const { onTakeSeat } = await renderTable({ spectating: true })
    const button = screen.getByRole('button', { name: 'Take a Seat' })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(onTakeSeat).toHaveBeenCalledTimes(1)
  })

  test('a full table says so and the seat button is disabled', async () => {
    const { onTakeSeat } = await renderTable({ spectating: true, table: { ...TABLE, players: 4, max: 4 } })
    expect(screen.getByText('Table is full')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'No seats open' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onTakeSeat).not.toHaveBeenCalled()
  })

  test('Stop watching goes back without telling the server you left a seat', async () => {
    const { onLeave } = await renderTable({ spectating: true })
    fireEvent.click(screen.getByRole('button', { name: '← Stop watching' }))
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(callFor(`POST /api/tables/${TABLE.id}/leave`)).toBeUndefined()
  })

  test('table details show the real player and watcher counts', async () => {
    await renderTable({ spectating: true })
    expect(screen.getByText('3 / 4')).toBeInTheDocument()
    expect(screen.getByText('Watching')).toBeInTheDocument()
  })
})

describe('Table screen while seated', () => {
  test('a seated player sees the waiting panel and no Take a Seat button', async () => {
    await renderTable()

    expect(
      screen.queryByText('Spectating')
    ).not.toBeInTheDocument()

    expect(
      screen.getByText('Waiting for cards...')
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('button', { name: 'Take a Seat' })
    ).not.toBeInTheDocument()
  })

  test('you get your own cards once the game starts', async () => {
    await renderTable()
    await startGame()
    expect(yourCards()).toHaveLength(5)
  })
})

describe('Invite code on the table screen (P7)', () => {
  test('the host of a private table sees the code', async () => {
    await renderTable({ table: { ...TABLE, isPrivate: true, inviteCode: 'K7Q2MX' } })
    const box = screen.getByText('Invite code').parentElement
    expect(within(box).getByText('K7Q2MX')).toBeInTheDocument()
  })

  test('players who joined get no code, so none is shown', async () => {
    await renderTable({ table: { ...TABLE, isPrivate: true, inviteCode: undefined } })
    expect(screen.queryByText('Invite code')).not.toBeInTheDocument()
  })

  test('public tables never show a code', async () => {
    await renderTable({ table: { ...TABLE, isPrivate: false, inviteCode: null } })
    expect(screen.queryByText('Invite code')).not.toBeInTheDocument()
  })
})
