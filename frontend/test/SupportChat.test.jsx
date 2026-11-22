/**
 * @jest-environment jsdom
 */
// P18: As a Player, I want to chat with an admin, so that I can get help with a problem.
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { socket } from '../src/socket'
import { SupportChat, addMessage, formatTime } from '../src/components/support/SupportChat.tsx'

jest.mock('../src/socket', () => ({
  socket: { on: jest.fn(), off: jest.fn(), emit: jest.fn(), connect: jest.fn(), connected: false },
}))

const ME = 'acct-me'
const MESSAGES = [
  { id: 'm1', playerId: ME, from: 'player', senderName: 'Preston', message: 'I lost my chips', createdAt: '2026-11-19T20:00:00Z' },
  { id: 'm2', playerId: ME, from: 'admin', senderName: 'Ayana', message: 'Let me check', createdAt: '2026-11-19T20:05:00Z' },
]

function reply(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) })
}

function installServer(overrides = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    const key = `${options.method || 'GET'} ${url}`
    if (overrides[key]) return overrides[key](url, options)
    if (key === 'GET /api/support') return reply({ playerId: ME, messages: MESSAGES })
    if (key === 'POST /api/support') {
      const { message } = JSON.parse(options.body)
      return reply({ message: { id: 'm3', playerId: ME, from: 'player', senderName: 'Preston', message, createdAt: '2026-11-19T20:10:00Z' } })
    }
    return reply({ error: `Unhandled ${key}` }, false)
  })
}

async function open(overrides) {
  installServer(overrides)
  const onClose = jest.fn()
  render(<SupportChat onClose={onClose} />)
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
  return { onClose }
}

// Pretend the server sent a live message
function serverSends(message) {
  const handler = socket.on.mock.calls.filter(([name]) => name === 'support:message').pop()[1]
  act(() => { handler(message) })
}

const box = () => screen.getByLabelText('Message to an admin')
const sendButton = () => screen.getByRole('button', { name: /^Send/ })

beforeEach(() => {
  jest.clearAllMocks()
  socket.connected = false
})

afterEach(() => {
  delete global.fetch
})

describe('Chat with an admin (P18)', () => {
  test('loads your conversation with the login cookie', async () => {
    await open()
    expect(global.fetch).toHaveBeenCalledWith('/api/support', expect.objectContaining({ credentials: 'include' }))
    expect(screen.getByText('I lost my chips')).toBeInTheDocument()
    expect(screen.getByText('Let me check')).toBeInTheDocument()
  })

  test('your messages say You and admin replies show the admin name', async () => {
    await open()
    expect(screen.getByText(/^You/)).toBeInTheDocument()
    expect(screen.getByText(/Ayana · Admin/)).toBeInTheDocument()
  })

  test('connects the live socket and joins your support room', async () => {
    await open()
    expect(socket.connect).toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith('support:join', expect.any(Function))
  })

  test('does not reconnect if the socket is already connected', async () => {
    socket.connected = true
    await open()
    expect(socket.connect).not.toHaveBeenCalled()
    expect(socket.emit).toHaveBeenCalledWith('support:join', expect.any(Function))
  })

  test('an empty conversation explains what to do', async () => {
    await open({ 'GET /api/support': () => reply({ playerId: ME, messages: [] }) })
    expect(screen.getByText(/Send a message and an admin will reply here/)).toBeInTheDocument()
  })

  test('a reply missing the lists counts as empty', async () => {
    await open({ 'GET /api/support': () => reply({}) })
    expect(screen.getByText(/Send a message and an admin will reply here/)).toBeInTheDocument()
  })

  test('a loading error is shown', async () => {
    await open({ 'GET /api/support': () => reply({ error: 'Log in to chat with an admin' }, false) })
    expect(screen.getByRole('alert')).toHaveTextContent('Log in to chat with an admin')
    expect(screen.queryByText(/Send a message and an admin will reply here/)).not.toBeInTheDocument()
  })

  test('a loading failure that is not a normal error uses a fallback', async () => {
    await open({ 'GET /api/support': () => Promise.reject('down') })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your messages')
  })

  test('sending adds your message and clears the box', async () => {
    await open()
    fireEvent.change(box(), { target: { value: '  still waiting  ' } })
    fireEvent.click(sendButton())

    expect(await screen.findByText('still waiting')).toBeInTheDocument()
    expect(box()).toHaveValue('')
    const [, options] = global.fetch.mock.calls.find(([url, o = {}]) => url === '/api/support' && o.method === 'POST')
    expect(JSON.parse(options.body)).toEqual({ message: 'still waiting' })
  })

  test('pressing Enter sends too', async () => {
    await open()
    fireEvent.change(box(), { target: { value: 'hello' } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(await screen.findByText('hello')).toBeInTheDocument()
  })

  test('other keys do not send', async () => {
    await open()
    fireEvent.change(box(), { target: { value: 'hello' } })
    fireEvent.keyDown(box(), { key: 'a' })
    expect(global.fetch.mock.calls.some(([, o = {}]) => o.method === 'POST')).toBe(false)
  })

  test('Send is disabled until something is typed', async () => {
    await open()
    expect(sendButton()).toBeDisabled()
    fireEvent.change(box(), { target: { value: '   ' } })
    expect(sendButton()).toBeDisabled()
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(global.fetch.mock.calls.some(([, o = {}]) => o.method === 'POST')).toBe(false)
  })

  test('the button says Sending and blocks double sends while waiting', async () => {
    let finish
    await open({ 'POST /api/support': () => new Promise(resolve => { finish = resolve }) })
    fireEvent.change(box(), { target: { value: 'hello' } })
    fireEvent.click(sendButton())
    expect(sendButton()).toHaveTextContent('Sending')
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(global.fetch.mock.calls.filter(([, o = {}]) => o.method === 'POST')).toHaveLength(1)
    finish({ ok: true, json: () => Promise.resolve({ message: { id: 'm9', playerId: ME, from: 'player', senderName: 'Preston', message: 'hello' } }) })
    expect(await screen.findByText('hello')).toBeInTheDocument()
  })

  test('a send error is shown and your text stays', async () => {
    await open({ 'POST /api/support': () => reply({ error: 'Messages can be up to 500 characters' }, false) })
    fireEvent.change(box(), { target: { value: 'hello' } })
    fireEvent.click(sendButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Messages can be up to 500 characters')
    expect(box()).toHaveValue('hello')
  })

  test('a send failure that is not a normal error uses a fallback', async () => {
    await open({ 'POST /api/support': () => Promise.reject('down') })
    fireEvent.change(box(), { target: { value: 'hello' } })
    fireEvent.click(sendButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('Your message could not be sent')
  })

  test('the box allows up to 500 characters', async () => {
    await open()
    expect(box()).toHaveAttribute('maxLength', '500')
  })

  test('admin replies show up live', async () => {
    await open()
    serverSends({ id: 'm5', playerId: ME, from: 'admin', senderName: 'Ayana', message: 'Your chips are back' })
    expect(screen.getByText('Your chips are back')).toBeInTheDocument()
  })

  test('your own message coming back live is not shown twice', async () => {
    await open()
    fireEvent.change(box(), { target: { value: 'once' } })
    fireEvent.click(sendButton())
    await screen.findByText('once')
    serverSends({ id: 'm3', playerId: ME, from: 'player', senderName: 'Preston', message: 'once' })
    expect(screen.getAllByText('once')).toHaveLength(1)
  })

  test("messages for someone else's conversation are ignored", async () => {
    await open()
    serverSends({ id: 'x1', playerId: 'acct-other', from: 'player', senderName: 'Josue', message: 'not yours' })
    expect(screen.queryByText('not yours')).not.toBeInTheDocument()
  })

  test('the close button calls onClose', async () => {
    const { onClose } = await open()
    fireEvent.click(screen.getByRole('button', { name: 'Close chat' }))
    expect(onClose).toHaveBeenCalled()
  })

  test('stops listening when closed', async () => {
    installServer()
    const { unmount } = render(<SupportChat onClose={jest.fn()} />)
    await screen.findByText('I lost my chips')
    unmount()
    expect(socket.off).toHaveBeenCalledWith('support:message', expect.any(Function))
  })

  test('closing before it loads does not cause errors', async () => {
    let finish
    let fail
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    installServer({ 'GET /api/support': () => new Promise(resolve => { finish = resolve }) })
    render(<SupportChat onClose={jest.fn()} />).unmount()
    finish({ ok: true, json: () => Promise.resolve({ playerId: ME, messages: MESSAGES }) })
    installServer({ 'GET /api/support': () => new Promise((_, reject) => { fail = reject }) })
    render(<SupportChat onClose={jest.fn()} />).unmount()
    fail(new Error('down'))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })
})

describe('Where the chat box opens', () => {
  test('bottom-right by default', async () => {
    await open()
    expect(screen.getByRole('dialog', { name: 'Chat with an admin' })).toHaveStyle({ position: 'fixed', right: '16px', bottom: '16px' })
  })

  test('bottom-left, above the lobby button, when asked', async () => {
    installServer()
    render(<SupportChat onClose={jest.fn()} corner="bottom-left" />)
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Chat with an admin' })).toHaveStyle({ left: '16px', bottom: '80px' })
  })
})

describe('helpers', () => {
  test('addMessage skips a message that is already there', () => {
    const list = [MESSAGES[0]]
    expect(addMessage(list, MESSAGES[0])).toBe(list)
    expect(addMessage(list, MESSAGES[1])).toEqual(MESSAGES)
  })

  test('formatTime handles missing or bad dates', () => {
    expect(formatTime(undefined)).toBe('')
    expect(formatTime('nope')).toBe('')
    expect(formatTime('2026-11-19T20:00:00Z')).not.toBe('')
  })
})
