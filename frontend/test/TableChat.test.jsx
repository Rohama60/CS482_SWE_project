/**
 * @jest-environment jsdom
 */
// M3: the chat box at a table. Members at the table can send, everyone can read,
// and guests get a "Members Only!" notice that fades away.
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { socket } from '../src/socket'
import { TableChat, MEMBERS_ONLY, SEATED_ONLY } from '../src/components/TableChat.tsx'

jest.mock('../src/socket', () => ({
  socket: { on: jest.fn(), off: jest.fn(), emit: jest.fn() },
}))

const OLD_MESSAGES = [
  { id: 'm1', name: 'Josue', message: 'good luck', createdAt: '2026-11-06T15:00:00Z' },
  { id: 'm2', name: 'Preston', message: 'you too', createdAt: '2026-11-06T15:01:00Z' },
]

function installFetch({ ok = true, body = { messages: OLD_MESSAGES }, fail = false } = {}) {
  global.fetch = jest.fn(() =>
    fail ? Promise.reject(new Error('down')) : Promise.resolve({ ok, json: () => Promise.resolve(body) })
  )
}

// Pretend the server sent a live event
function serverSends(event, data) {
  const handler = socket.on.mock.calls.filter(([name]) => name === event).pop()[1]
  act(() => { handler(data) })
}

async function setup({ isMember = true, isSeated = true, myName = 'Preston', fetchOptions } = {}) {
  installFetch(fetchOptions)
  const view = render(<TableChat tableId="t1" isMember={isMember} isSeated={isSeated} myName={myName} />)
  await waitFor(() => expect(global.fetch).toHaveBeenCalled())
  return view
}

const box = () => screen.getByLabelText('Type a message to the table')
const sendButton = () => screen.getByRole('button', { name: 'Send message' })

beforeEach(() => {
  jest.clearAllMocks()
})

afterEach(() => {
  jest.useRealTimers()
  delete global.fetch
})

describe('Reading the chat (M3)', () => {
  test('loads the recent messages for this table', async () => {
    await setup()
    expect(await screen.findByText('good luck')).toBeInTheDocument()
    expect(screen.getByText('you too')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/tables/t1/chat', { credentials: 'include' })
  })

  test('the fake sample messages are gone', async () => {
    await setup({ fetchOptions: { body: { messages: [] } } })
    expect(screen.queryByText('Good luck at the draw.')).not.toBeInTheDocument()
    expect(await screen.findByText('No messages yet.')).toBeInTheDocument()
  })

  test('your own name is highlighted', async () => {
    await setup()
    expect(await screen.findByText('Preston')).toHaveStyle({ color: '#f0a097' })
    expect(screen.getByText('Josue')).toHaveStyle({ color: '#e8e4dc' })
  })

  test('if loading fails, the chat starts empty', async () => {
    await setup({ fetchOptions: { ok: false } })
    expect(await screen.findByText('No messages yet.')).toBeInTheDocument()
  })

  test('if the server is down, the chat starts empty', async () => {
    await setup({ fetchOptions: { fail: true } })
    expect(screen.getByText('No messages yet.')).toBeInTheDocument()
  })

  test('a reply with no messages list counts as empty', async () => {
    await setup({ fetchOptions: { body: {} } })
    expect(await screen.findByText('No messages yet.')).toBeInTheDocument()
  })

  test('new messages show up live', async () => {
    await setup()
    await screen.findByText('good luck')
    serverSends('chat:message', { id: 'm3', name: 'Ayana', message: 'raise it up' })
    expect(screen.getByText('raise it up')).toBeInTheDocument()
  })

  test('shows how many people are at the table', async () => {
    await setup()
    expect(screen.getByText('1 online')).toBeInTheDocument()
    serverSends('chat:online', { tableId: 't1', online: 4 })
    expect(screen.getByText('4 online')).toBeInTheDocument()
  })

  test('ignores online counts for other tables', async () => {
    await setup()
    serverSends('chat:online', { tableId: 'other', online: 9 })
    expect(screen.queryByText('9 online')).not.toBeInTheDocument()
  })

  test('stops listening when the table closes', async () => {
    const { unmount } = await setup()
    unmount()
    expect(socket.off).toHaveBeenCalledWith('chat:message', expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith('chat:error', expect.any(Function))
    expect(socket.off).toHaveBeenCalledWith('chat:online', expect.any(Function))
  })
})

describe('Sending as a seated member (M3)', () => {
  test('sends the message to the server and clears the box', async () => {
    await setup()
    fireEvent.change(box(), { target: { value: '  nice hand  ' } })
    fireEvent.click(sendButton())
    expect(socket.emit).toHaveBeenCalledWith('chat:send', { tableId: 't1', message: 'nice hand' })
    expect(box()).toHaveValue('')
  })

  test('pressing Enter sends too', async () => {
    await setup()
    fireEvent.change(box(), { target: { value: 'gg' } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(socket.emit).toHaveBeenCalledWith('chat:send', { tableId: 't1', message: 'gg' })
  })

  test('other keys do not send', async () => {
    await setup()
    fireEvent.change(box(), { target: { value: 'gg' } })
    fireEvent.keyDown(box(), { key: 'g' })
    expect(socket.emit).not.toHaveBeenCalled()
  })

  test('an empty message is not sent', async () => {
    await setup()
    expect(sendButton()).toBeDisabled()
    fireEvent.change(box(), { target: { value: '   ' } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(socket.emit).not.toHaveBeenCalled()
  })

  test('the box allows up to 200 characters', async () => {
    await setup()
    expect(box()).toHaveAttribute('maxLength', '200')
  })

  test('members can click into the box normally', async () => {
    await setup()
    fireEvent.mouseDown(box())
    fireEvent.focus(box())
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(box()).not.toHaveAttribute('readOnly')
  })

  test('an error from the server pops up', async () => {
    await setup()
    serverSends('chat:error', { error: 'Message could not be sent' })
    expect(screen.getByRole('status')).toHaveTextContent('Message could not be sent')
  })
})

describe('Guests (M3)', () => {
  test('clicking the box shows "Members Only! Sign up to chat"', async () => {
    await setup({ isMember: false, isSeated: true })
    fireEvent.mouseDown(box())
    expect(screen.getByRole('status')).toHaveTextContent(MEMBERS_ONLY)
    expect(MEMBERS_ONLY).toBe('Members Only! Sign up to chat')
  })

  test('guests cannot type', async () => {
    await setup({ isMember: false })
    expect(box()).toHaveAttribute('readOnly')
  })

  test('focusing the box (like with Tab) also shows the notice', async () => {
    await setup({ isMember: false })
    fireEvent.focus(box())
    expect(screen.getByRole('status')).toHaveTextContent(MEMBERS_ONLY)
  })

  test('the send button shows the notice instead of sending', async () => {
    await setup({ isMember: false })
    fireEvent.click(sendButton())
    expect(screen.getByRole('status')).toHaveTextContent(MEMBERS_ONLY)
    expect(socket.emit).not.toHaveBeenCalled()
  })

  test('Enter shows the notice instead of sending', async () => {
    await setup({ isMember: false })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(socket.emit).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(MEMBERS_ONLY)
  })

  test('the notice fades out and then goes away', async () => {
    await setup({ isMember: false })
    jest.useFakeTimers()
    fireEvent.mouseDown(box())
    expect(screen.getByRole('status')).toHaveStyle({ opacity: '1' })

    act(() => { jest.advanceTimersByTime(2000) })
    expect(screen.getByRole('status')).toHaveStyle({ opacity: '0' })

    act(() => { jest.advanceTimersByTime(500) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  test('clicking again restarts the fade', async () => {
    await setup({ isMember: false })
    jest.useFakeTimers()
    fireEvent.mouseDown(box())
    act(() => { jest.advanceTimersByTime(1500) })
    fireEvent.mouseDown(box())
    act(() => { jest.advanceTimersByTime(1500) })
    expect(screen.getByRole('status')).toHaveStyle({ opacity: '1' })
  })

  test('guests can still read the chat', async () => {
    await setup({ isMember: false })
    expect(await screen.findByText('good luck')).toBeInTheDocument()
  })
})

describe('Members who are only watching (M3)', () => {
  test('they are told to take a seat', async () => {
    await setup({ isMember: true, isSeated: false })
    fireEvent.mouseDown(box())
    expect(screen.getByRole('status')).toHaveTextContent(SEATED_ONLY)
    expect(box()).toHaveAttribute('readOnly')
  })
})

// Scrolling: the message list stays a fixed size and scrolls once there are lots of messages.
// The test browser has no real layout, so each test sets the list's sizes by hand.
const messageList = () => screen.getByTestId('chat-messages')

function sizeList(list, { scrollHeight, clientHeight = 176, scrollTop = 0 }) {
  Object.defineProperty(list, 'scrollHeight', { configurable: true, value: scrollHeight })
  Object.defineProperty(list, 'clientHeight', { configurable: true, value: clientHeight })
  list.scrollTop = scrollTop
}

const liveMessage = n => ({ id: `live-${n}`, name: 'Josue', message: `message ${n}` })

describe('Scrolling the chat', () => {
  test('the message list scrolls inside its area instead of stretching the chat', async () => {
    await setup()
    expect(messageList()).toHaveStyle({ position: 'absolute', overflowY: 'auto' })
  })

  test('the message area fills the chat panel but never gets smaller than 11rem', async () => {
    await setup()
    expect(messageList().parentElement).toHaveStyle({ flex: '1 1 auto', minHeight: '11rem' })
  })

  test('opening the table jumps to the newest message', async () => {
    installFetch()
    render(<TableChat tableId="t1" isMember isSeated myName="Preston" />)
    sizeList(messageList(), { scrollHeight: 600 })
    expect(await screen.findByText('good luck')).toBeInTheDocument()
    expect(messageList().scrollTop).toBe(600)
  })

  test('a new message scrolls down when you are at the bottom', async () => {
    await setup()
    await screen.findByText('good luck')
    const list = messageList()
    sizeList(list, { scrollHeight: 800, scrollTop: 624 }) // 800 - 176 = the very bottom
    fireEvent.scroll(list)

    sizeList(list, { scrollHeight: 900, scrollTop: 624 })
    serverSends('chat:message', liveMessage(1))
    expect(list.scrollTop).toBe(900)
  })

  test('a new message does not move you while you scroll up to read', async () => {
    await setup()
    await screen.findByText('good luck')
    const list = messageList()
    sizeList(list, { scrollHeight: 800, scrollTop: 100 }) // way above the bottom
    fireEvent.scroll(list)

    sizeList(list, { scrollHeight: 900, scrollTop: 100 })
    serverSends('chat:message', liveMessage(1))
    expect(list.scrollTop).toBe(100)
  })

  test('scrolling back to the bottom turns auto-scroll back on', async () => {
    await setup()
    await screen.findByText('good luck')
    const list = messageList()
    sizeList(list, { scrollHeight: 800, scrollTop: 100 })
    fireEvent.scroll(list)
    sizeList(list, { scrollHeight: 800, scrollTop: 600 }) // within 40px of the bottom
    fireEvent.scroll(list)

    sizeList(list, { scrollHeight: 900, scrollTop: 600 })
    serverSends('chat:message', liveMessage(1))
    expect(list.scrollTop).toBe(900)
  })

  test('long words wrap instead of stretching the chat box', async () => {
    installFetch({ body: { messages: [{ id: 'long', name: 'Josue', message: 'a'.repeat(200) }] } })
    render(<TableChat tableId="t1" isMember isSeated myName="Preston" />)
    expect(await screen.findByText('a'.repeat(200))).toHaveStyle({ overflowWrap: 'anywhere' })
  })
})
