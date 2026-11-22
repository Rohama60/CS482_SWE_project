/**
 * @jest-environment jsdom
 */
// P18 Chat with Admin, the admin side: read players' messages and reply.
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { socket } from '../src/socket'
import { AdminSupportInbox, updateInbox } from '../src/components/support/AdminSupportInbox.tsx'
import { joinSupport } from '../src/components/support/supportSocket.ts'

jest.mock('../src/socket', () => ({
  socket: { on: jest.fn(), off: jest.fn(), emit: jest.fn(), connect: jest.fn(), connected: false },
}))

const PRESTON = 'acct-preston'
const JOSUE = 'acct-josue'
const INBOX = [
  { playerId: PRESTON, playerName: 'Preston', lastMessage: 'I lost my chips', lastFrom: 'player', lastAt: '2026-11-19T20:00:00Z', unread: 2 },
  { playerId: JOSUE, playerName: 'Josue', lastMessage: 'Fixed it', lastFrom: 'admin', lastAt: '2026-11-19T19:00:00Z', unread: 0 },
]
const THREAD = [
  { id: 'm1', playerId: PRESTON, from: 'player', senderName: 'Preston', message: 'I lost my chips', createdAt: '2026-11-19T19:59:00Z' },
  { id: 'm2', playerId: PRESTON, from: 'player', senderName: 'Preston', message: 'Please help', createdAt: '2026-11-19T20:00:00Z' },
]

function reply(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) })
}

function installServer(overrides = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    const key = `${options.method || 'GET'} ${url}`
    if (overrides[key]) return overrides[key](url, options)
    if (key === 'GET /api/admin/support') return reply({ conversations: INBOX })
    if (key === `GET /api/admin/support/${PRESTON}`) return reply({ player: { id: PRESTON, name: 'Preston' }, messages: THREAD })
    if (key === `GET /api/admin/support/${JOSUE}`) return reply({ player: { id: JOSUE, name: 'Josue' }, messages: [] })
    if (key === `POST /api/admin/support/${PRESTON}`) {
      const { message } = JSON.parse(options.body)
      return reply({ message: { id: 'r1', playerId: PRESTON, from: 'admin', senderName: 'Ayana', message, createdAt: '2026-11-19T20:10:00Z' } })
    }
    return reply({ error: `Unhandled ${key}` }, false)
  })
}

async function openInbox(overrides) {
  installServer(overrides)
  render(<AdminSupportInbox />)
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
}

const convoButton = name => within(screen.getByRole('list', { name: 'Conversations' })).getByRole('button', { name: new RegExp(`^${name}`) })

async function openPreston() {
  fireEvent.click(convoButton('Preston'))
  await screen.findByText('Please help')
}

function serverSends(message) {
  const handler = socket.on.mock.calls.filter(([name]) => name === 'support:message').pop()[1]
  act(() => { handler(message) })
}

const calls = key => global.fetch.mock.calls.filter(([url, o = {}]) => `${o.method || 'GET'} ${url}` === key)

beforeEach(() => {
  jest.clearAllMocks()
  socket.connected = false
})

afterEach(() => {
  delete global.fetch
})

describe('Support inbox (P18)', () => {
  test('lists every player who wrote in, with unread counts', async () => {
    await openInbox()
    expect(convoButton('Preston')).toHaveTextContent('I lost my chips')
    expect(within(convoButton('Preston')).getByLabelText('2 unread')).toBeInTheDocument()
    expect(convoButton('Josue')).toHaveTextContent('You: Fixed it')
    expect(screen.getByText(/2 unread/, { selector: 'span' })).toBeInTheDocument()
  })

  test('joins the admins room for live updates', async () => {
    await openInbox()
    expect(socket.connect).toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith('support:join', expect.any(Function))
  })

  test('says so when nobody has written in', async () => {
    await openInbox({ 'GET /api/admin/support': () => reply({}) })
    expect(screen.getByText('No messages from players yet.')).toBeInTheDocument()
  })

  test('a loading error is shown, like a player who is not an admin', async () => {
    await openInbox({ 'GET /api/admin/support': () => reply({ error: 'Access denied: Administrator privileges required' }, false) })
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied')
  })

  test('a loading failure that is not a normal error uses a fallback', async () => {
    await openInbox({ 'GET /api/admin/support': () => Promise.reject('down') })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load the support inbox')
  })

  test('asks you to pick a player at first', async () => {
    await openInbox()
    expect(screen.getByText('Pick a player to read and reply.')).toBeInTheDocument()
  })

  test('opening a conversation shows the messages and clears its unread badge', async () => {
    await openInbox()
    await openPreston()
    expect(screen.getByText('I lost my chips', { selector: 'p' })).toBeInTheDocument()
    expect(within(convoButton('Preston')).queryByLabelText('2 unread')).not.toBeInTheDocument()
    expect(convoButton('Preston')).toHaveAttribute('aria-current', 'true')
    expect(calls(`GET /api/admin/support/${PRESTON}`)).toHaveLength(1)
  })

  test('a conversation with a reply missing its parts still opens', async () => {
    await openInbox({ [`GET /api/admin/support/${PRESTON}`]: () => reply({}) })
    fireEvent.click(convoButton('Preston'))
    expect(await screen.findByLabelText('Reply to Player')).toBeInTheDocument()
  })

  test('an error opening a conversation is shown', async () => {
    await openInbox({ [`GET /api/admin/support/${PRESTON}`]: () => reply({ error: 'Failed to load conversation' }, false) })
    fireEvent.click(convoButton('Preston'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load conversation')
  })

  test('an opening failure that is not a normal error uses a fallback', async () => {
    await openInbox({ [`GET /api/admin/support/${PRESTON}`]: () => Promise.reject('down') })
    fireEvent.click(convoButton('Preston'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load that conversation')
  })

  test('switching quickly only shows the last one you clicked', async () => {
    let finishPreston
    await openInbox({ [`GET /api/admin/support/${PRESTON}`]: () => new Promise(resolve => { finishPreston = resolve }) })
    fireEvent.click(convoButton('Preston'))
    fireEvent.click(convoButton('Josue'))
    await screen.findByLabelText('Reply to Josue')
    await act(async () => {
      finishPreston({ ok: true, json: () => Promise.resolve({ player: { id: PRESTON, name: 'Preston' }, messages: THREAD }) })
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(screen.queryByText('Please help')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Reply to Josue')).toBeInTheDocument()
  })

  test("a slow conversation that fails after you switched away doesn't show its error", async () => {
    let failPreston
    await openInbox({ [`GET /api/admin/support/${PRESTON}`]: () => new Promise((_, reject) => { failPreston = reject }) })
    fireEvent.click(convoButton('Preston'))
    fireEvent.click(convoButton('Josue'))
    await screen.findByLabelText('Reply to Josue')
    await act(async () => {
      failPreston(new Error('Failed to load conversation'))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test("the first player's slow load doesn't hide the second one's Loading", async () => {
    let finishPreston
    await openInbox({
      [`GET /api/admin/support/${PRESTON}`]: () => new Promise(resolve => { finishPreston = resolve }),
      [`GET /api/admin/support/${JOSUE}`]: () => new Promise(() => {}),
    })
    fireEvent.click(convoButton('Preston'))
    fireEvent.click(convoButton('Josue'))
    await act(async () => {
      finishPreston({ ok: true, json: () => Promise.resolve({ player: { id: PRESTON, name: 'Preston' }, messages: THREAD }) })
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(within(screen.getByLabelText('Messages with Josue')).getByText('Loading...')).toBeInTheDocument()
  })

  test('replying sends it, shows it, and moves the player to the top', async () => {
    await openInbox()
    fireEvent.click(convoButton('Josue'))
    await screen.findByLabelText('Reply to Josue')
    fireEvent.click(convoButton('Preston'))
    await screen.findByText('Please help')

    fireEvent.change(screen.getByLabelText('Reply to Preston'), { target: { value: '  Your chips are back  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))

    expect(await screen.findByText('Your chips are back', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByLabelText('Reply to Preston')).toHaveValue('')
    const [[, options]] = calls(`POST /api/admin/support/${PRESTON}`)
    expect(JSON.parse(options.body)).toEqual({ message: 'Your chips are back' })
    expect(convoButton('Preston')).toHaveTextContent('You: Your chips are back')
  })

  test('pressing Enter replies too, other keys do not', async () => {
    await openInbox()
    await openPreston()
    const box = screen.getByLabelText('Reply to Preston')
    fireEvent.change(box, { target: { value: 'On it' } })
    fireEvent.keyDown(box, { key: 'a' })
    expect(calls(`POST /api/admin/support/${PRESTON}`)).toHaveLength(0)
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(await screen.findByText('On it', { selector: 'p' })).toBeInTheDocument()
  })

  test('Reply is disabled until something is typed', async () => {
    await openInbox()
    await openPreston()
    expect(screen.getByRole('button', { name: 'Reply' })).toBeDisabled()
    fireEvent.keyDown(screen.getByLabelText('Reply to Preston'), { key: 'Enter' })
    expect(calls(`POST /api/admin/support/${PRESTON}`)).toHaveLength(0)
  })

  test('the button says Sending and blocks double replies while waiting', async () => {
    let finish
    await openInbox({ [`POST /api/admin/support/${PRESTON}`]: () => new Promise(resolve => { finish = resolve }) })
    await openPreston()
    const box = screen.getByLabelText('Reply to Preston')
    fireEvent.change(box, { target: { value: 'On it' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(screen.getByRole('button', { name: 'Sending' })).toBeDisabled()
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(calls(`POST /api/admin/support/${PRESTON}`)).toHaveLength(1)
    finish({ ok: true, json: () => Promise.resolve({ message: { id: 'r9', playerId: PRESTON, from: 'admin', senderName: 'Ayana', message: 'On it' } }) })
    expect(await screen.findByText('On it', { selector: 'p' })).toBeInTheDocument()
  })

  test('a reply error is shown and your text stays', async () => {
    await openInbox({ [`POST /api/admin/support/${PRESTON}`]: () => reply({ error: 'Player not found' }, false) })
    await openPreston()
    fireEvent.change(screen.getByLabelText('Reply to Preston'), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Player not found')
    expect(screen.getByLabelText('Reply to Preston')).toHaveValue('hi')
  })

  test('a reply failure that is not a normal error uses a fallback', async () => {
    await openInbox({ [`POST /api/admin/support/${PRESTON}`]: () => Promise.reject('down') })
    await openPreston()
    fireEvent.change(screen.getByLabelText('Reply to Preston'), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Your reply could not be sent')
  })

  test('a new message from a player shows up live at the top with an unread badge', async () => {
    await openInbox()
    serverSends({ id: 'n1', playerId: JOSUE, from: 'player', senderName: 'Josue', message: 'It broke again', createdAt: '2026-11-19T21:00:00Z' })
    const buttons = within(screen.getByRole('list', { name: 'Conversations' })).getAllByRole('button')
    expect(buttons[0]).toHaveTextContent('Josue')
    expect(buttons[0]).toHaveTextContent('It broke again')
    expect(within(buttons[0]).getByLabelText('1 unread')).toBeInTheDocument()
  })

  test('a brand new player shows up live too', async () => {
    await openInbox()
    serverSends({ id: 'n2', playerId: 'acct-new', from: 'player', senderName: 'Rohama', message: 'Hi there' })
    expect(convoButton('Rohama')).toHaveTextContent('Hi there')
  })

  test('a live message in the conversation you have open shows there and is marked read', async () => {
    await openInbox()
    await openPreston()
    serverSends({ id: 'n3', playerId: PRESTON, from: 'player', senderName: 'Preston', message: 'Any update?' })
    expect(screen.getByText('Any update?', { selector: 'p' })).toBeInTheDocument()
    expect(within(convoButton('Preston')).queryByLabelText(/unread/)).not.toBeInTheDocument()
    await waitFor(() => expect(calls(`GET /api/admin/support/${PRESTON}`)).toHaveLength(2))
  })

  test('a failed mark-as-read is ignored', async () => {
    let count = 0
    await openInbox({
      [`GET /api/admin/support/${PRESTON}`]: () => (++count === 1 ? reply({ player: { id: PRESTON, name: 'Preston' }, messages: THREAD }) : Promise.reject(new Error('down'))),
    })
    await openPreston()
    serverSends({ id: 'n4', playerId: PRESTON, from: 'player', senderName: 'Preston', message: 'Still there?' })
    await waitFor(() => expect(count).toBe(2))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test("another admin's live reply in the open conversation shows but is not counted as unread", async () => {
    await openInbox()
    await openPreston()
    serverSends({ id: 'n5', playerId: PRESTON, from: 'admin', senderName: 'Josue', message: 'Handled it' })
    expect(screen.getByText('Handled it', { selector: 'p' })).toBeInTheDocument()
    expect(calls(`GET /api/admin/support/${PRESTON}`)).toHaveLength(1)
  })

  test('stops listening when closed, and closing before it loads causes no errors', async () => {
    let finish
    let fail
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    installServer({ 'GET /api/admin/support': () => new Promise(resolve => { finish = resolve }) })
    render(<AdminSupportInbox />).unmount()
    expect(socket.off).toHaveBeenCalledWith('support:message', expect.any(Function))
    finish({ ok: true, json: () => Promise.resolve({ conversations: INBOX }) })
    installServer({ 'GET /api/admin/support': () => new Promise((_, reject) => { fail = reject }) })
    render(<AdminSupportInbox />).unmount()
    fail(new Error('down'))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })
})

describe('updateInbox', () => {
  test('a player message for a closed conversation adds to unread', () => {
    const [top] = updateInbox(INBOX, { id: 'x', playerId: JOSUE, from: 'player', senderName: 'Josue', message: 'hey' }, null)
    expect(top).toMatchObject({ playerId: JOSUE, playerName: 'Josue', lastMessage: 'hey', lastFrom: 'player', unread: 1 })
  })

  test('a message for the open conversation does not add to unread', () => {
    const [top] = updateInbox(INBOX, { id: 'x', playerId: PRESTON, from: 'player', senderName: 'Preston', message: 'hey' }, PRESTON)
    expect(top.unread).toBe(2)
  })
})

describe('joinSupport', () => {
  test('resolves with what the server says', async () => {
    socket.emit.mockImplementation((event, callback) => callback({ ok: true, admin: true }))
    await expect(joinSupport()).resolves.toEqual({ ok: true, admin: true })
  })

  test('treats no answer as not joined', async () => {
    socket.emit.mockImplementation((event, callback) => callback())
    await expect(joinSupport()).resolves.toEqual({ ok: false })
  })
})
