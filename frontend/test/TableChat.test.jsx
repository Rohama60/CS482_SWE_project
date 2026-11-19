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

// Mute Others: members can mute a player so their messages are hidden. Mutes are saved to your account.
describe('Muting players', () => {
  const JOSUE_ID = 'acct-josue'
  const ROHAMA_ID = 'acct-rohama'
  const ME_ID = 'acct-me'
  const MESSAGES = [
    { id: 'm1', senderId: JOSUE_ID, name: 'Josue', message: 'good luck' },
    { id: 'm2', senderId: ME_ID, name: 'Preston', message: 'you too' },
    { id: 'm3', senderId: ROHAMA_ID, name: 'Rohama', message: 'nice hand' },
  ]

  // Answers by "METHOD url", like the real server
  function installServer({ muted = [], overrides = {} } = {}) {
    let saved = [...muted]
    global.fetch = jest.fn((url, options = {}) => {
      const key = `${options.method || 'GET'} ${url}`
      const ok = body => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
      if (overrides[key]) return overrides[key](url, options)
      if (key === 'GET /api/tables/t1/chat') return ok({ messages: MESSAGES })
      if (key === 'GET /api/chat/mutes') return ok({ muted: saved })
      if (key === 'POST /api/chat/mutes') {
        saved = [...saved, JSON.parse(options.body).playerId]
        return ok({ message: 'muted' })
      }
      if (key.startsWith('DELETE /api/chat/mutes/')) {
        saved = saved.filter(id => !url.endsWith(id))
        return ok({ message: 'unmuted' })
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: `Unhandled ${key}` }) })
    })
  }

  const fetchCalls = key => global.fetch.mock.calls.filter(([url, o = {}]) => `${o.method || 'GET'} ${url}` === key)

  async function open({ isMember = true, isSeated = true, ...server } = {}) {
    installServer(server)
    render(<TableChat tableId="t1" isMember={isMember} isSeated={isSeated} myName="Preston" />)
    // Your own message is never hidden, so it shows the chat has loaded
    await screen.findByText('you too')
    if (isMember) await waitFor(() => expect(fetchCalls('GET /api/chat/mutes')).toHaveLength(1))
  }

  const muteButton = name => screen.getByRole('button', { name: `Mute ${name}` })

  test('members see a Mute button on other players, not on themselves', async () => {
    await open()
    expect(muteButton('Josue')).toBeInTheDocument()
    expect(muteButton('Rohama')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mute Preston' })).not.toBeInTheDocument()
  })

  test('guests do not see Mute buttons and never ask for mutes', async () => {
    await open({ isMember: false })
    expect(screen.queryByRole('button', { name: /^Mute / })).not.toBeInTheDocument()
    expect(fetchCalls('GET /api/chat/mutes')).toHaveLength(0)
  })

  test('members watching a table can still mute', async () => {
    await open({ isSeated: false })
    expect(muteButton('Josue')).toBeInTheDocument()
  })

  test('messages without a sender have no Mute button', async () => {
    installServer({ overrides: { 'GET /api/tables/t1/chat': () => Promise.resolve({ ok: true, json: () => Promise.resolve({ messages: [{ id: 'old', name: 'Old', message: 'hi' }] }) }) } })
    render(<TableChat tableId="t1" isMember isSeated myName="Preston" />)
    await screen.findByText('hi')
    expect(screen.queryByRole('button', { name: 'Mute Old' })).not.toBeInTheDocument()
  })

  test('muting saves it to your account and hides their messages', async () => {
    await open()
    fireEvent.click(muteButton('Josue'))

    await waitFor(() => expect(screen.queryByText('good luck')).not.toBeInTheDocument())
    expect(screen.getByText('nice hand')).toBeInTheDocument()
    expect(screen.getByText('you too')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Josue is muted')
    const [[, options]] = fetchCalls('POST /api/chat/mutes')
    expect(JSON.parse(options.body)).toEqual({ playerId: JOSUE_ID })
    expect(options.credentials).toBe('include')
  })

  test('players you muted before stay hidden when you open the table', async () => {
    await open({ muted: [ROHAMA_ID] })
    await waitFor(() => expect(screen.queryByText('nice hand')).not.toBeInTheDocument())
    expect(screen.getByText('good luck')).toBeInTheDocument()
  })

  test('muted players are listed with an Unmute button', async () => {
    await open({ muted: [ROHAMA_ID] })
    const list = await screen.findByLabelText('Muted players')
    expect(list).toHaveTextContent('Rohama')
    expect(screen.getByRole('button', { name: 'Unmute Rohama' })).toBeInTheDocument()
  })

  test('muted players with no messages here are not listed', async () => {
    await open({ muted: ['acct-someone-else'] })
    await waitFor(() => expect(fetchCalls('GET /api/chat/mutes')).toHaveLength(1))
    expect(screen.queryByLabelText('Muted players')).not.toBeInTheDocument()
  })

  test('Unmute shows their messages again', async () => {
    await open({ muted: [ROHAMA_ID] })
    fireEvent.click(await screen.findByRole('button', { name: 'Unmute Rohama' }))

    expect(await screen.findByText('nice hand')).toBeInTheDocument()
    expect(screen.queryByLabelText('Muted players')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Rohama is unmuted')
    expect(fetchCalls(`DELETE /api/chat/mutes/${ROHAMA_ID}`)).toHaveLength(1)
  })

  test('new live messages from a muted player stay hidden', async () => {
    await open({ muted: [JOSUE_ID] })
    await waitFor(() => expect(screen.queryByText('good luck')).not.toBeInTheDocument())
    serverSends('chat:message', { id: 'm9', senderId: JOSUE_ID, name: 'Josue', message: 'still here' })
    serverSends('chat:message', { id: 'm10', senderId: ROHAMA_ID, name: 'Rohama', message: 'gg' })
    expect(screen.queryByText('still here')).not.toBeInTheDocument()
    expect(screen.getByText('gg')).toBeInTheDocument()
  })

  test('if muting fails, the message stays and the error pops up', async () => {
    await open({ overrides: { 'POST /api/chat/mutes': () => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'Player not found' }) }) } })
    fireEvent.click(muteButton('Josue'))
    expect(await screen.findByRole('status')).toHaveTextContent('Player not found')
    expect(screen.getByText('good luck')).toBeInTheDocument()
  })

  test('a mute failure that is not a normal error uses a fallback', async () => {
    await open({ overrides: { 'POST /api/chat/mutes': () => Promise.reject('down') } })
    fireEvent.click(muteButton('Josue'))
    expect(await screen.findByRole('status')).toHaveTextContent('Could not mute that player')
  })

  test('if unmuting fails, they stay muted and the error pops up', async () => {
    await open({ muted: [ROHAMA_ID], overrides: { [`DELETE /api/chat/mutes/${ROHAMA_ID}`]: () => Promise.reject(new Error('Server error')) } })
    fireEvent.click(await screen.findByRole('button', { name: 'Unmute Rohama' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Server error')
    expect(screen.queryByText('nice hand')).not.toBeInTheDocument()
  })

  test('an unmute failure that is not a normal error uses a fallback', async () => {
    await open({ muted: [ROHAMA_ID], overrides: { [`DELETE /api/chat/mutes/${ROHAMA_ID}`]: () => Promise.reject('down') } })
    fireEvent.click(await screen.findByRole('button', { name: 'Unmute Rohama' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Could not unmute that player')
  })

  test('if loading your mutes fails, nobody is hidden', async () => {
    await open({ overrides: { 'GET /api/chat/mutes': () => Promise.reject(new Error('down')) } })
    await waitFor(() => expect(fetchCalls('GET /api/chat/mutes')).toHaveLength(1))
    expect(screen.getByText('good luck')).toBeInTheDocument()
    expect(screen.getByText('nice hand')).toBeInTheDocument()
  })

  test('a mutes reply with no list counts as nobody muted', async () => {
    await open({ overrides: { 'GET /api/chat/mutes': () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }) } })
    await waitFor(() => expect(fetchCalls('GET /api/chat/mutes')).toHaveLength(1))
    expect(screen.getByText('nice hand')).toBeInTheDocument()
  })

  test('if every message is from muted players, it says no messages yet', async () => {
    const fromOthers = MESSAGES.filter(message => message.senderId !== ME_ID)
    installServer({
      muted: [JOSUE_ID, ROHAMA_ID],
      overrides: { 'GET /api/tables/t1/chat': () => Promise.resolve({ ok: true, json: () => Promise.resolve({ messages: fromOthers }) }) },
    })
    render(<TableChat tableId="t1" isMember isSeated myName="Preston" />)
    await waitFor(() => expect(fetchCalls('GET /api/tables/t1/chat')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByText('nice hand')).not.toBeInTheDocument())
    expect(screen.queryByText('good luck')).not.toBeInTheDocument()
    expect(screen.getByText('No messages yet.')).toBeInTheDocument()
  })

  describe('with more than one muted player', () => {
    const AYANA_ID = 'acct-ayana'
    async function openWithThreeMuted() {
      installServer({
        muted: [JOSUE_ID, ROHAMA_ID, AYANA_ID],
        overrides: {
          'GET /api/tables/t1/chat': () => Promise.resolve({ ok: true, json: () => Promise.resolve({
            messages: [...MESSAGES, { id: 'm4', senderId: AYANA_ID, name: 'Ayana', message: 'hey' }],
          }) }),
        },
      })
      render(<TableChat tableId="t1" isMember isSeated myName="Preston" />)
      await screen.findByText('you too')
      await screen.findByLabelText('Muted players')
    }
    const dots = () => screen.getByRole('button', { name: /more muted|Hide other muted players/ })

    test('only the first shows, with dots for the rest', async () => {
      await openWithThreeMuted()
      expect(screen.getByRole('button', { name: 'Unmute Josue' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Unmute Rohama' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Unmute Ayana' })).not.toBeInTheDocument()
      expect(dots()).toHaveTextContent('•••')
      expect(dots()).toHaveAccessibleName('Show 2 more muted')
      expect(dots()).toHaveAttribute('aria-expanded', 'false')
    })

    test('clicking the dots shows the rest, lined up under the first one', async () => {
      await openWithThreeMuted()
      fireEvent.click(dots())

      const rohama = screen.getByRole('button', { name: 'Unmute Rohama' })
      const ayana = screen.getByRole('button', { name: 'Unmute Ayana' })
      expect(dots()).toHaveAttribute('aria-expanded', 'true')
      // Each extra one sits in the same column as the first, under "Muted:"
      expect(rohama.closest('div')).toHaveStyle({ gridColumn: '2' })
      expect(ayana.closest('div')).toHaveStyle({ gridColumn: '2' })
    })

    test('clicking the dots again folds them back up', async () => {
      await openWithThreeMuted()
      fireEvent.click(dots())
      fireEvent.click(dots())
      expect(screen.queryByRole('button', { name: 'Unmute Rohama' })).not.toBeInTheDocument()
      expect(dots()).toHaveAttribute('aria-expanded', 'false')
    })

    test('one muted player shows no dots', async () => {
      await open({ muted: [ROHAMA_ID] })
      await screen.findByLabelText('Muted players')
      expect(screen.queryByRole('button', { name: /more muted/ })).not.toBeInTheDocument()
    })

    test('unmuting down to one player hides the dots and folds the list', async () => {
      await openWithThreeMuted()
      fireEvent.click(dots())
      fireEvent.click(screen.getByRole('button', { name: 'Unmute Josue' }))
      await screen.findByText('good luck')
      fireEvent.click(screen.getByRole('button', { name: 'Unmute Rohama' }))
      await screen.findByText('nice hand')

      expect(screen.getByRole('button', { name: 'Unmute Ayana' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /more muted|Hide other/ })).not.toBeInTheDocument()

      // Muting someone again starts folded
      fireEvent.click(screen.getByRole('button', { name: 'Mute Josue' }))
      await waitFor(() => expect(screen.queryByText('good luck')).not.toBeInTheDocument())
      expect(dots()).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('button', { name: 'Unmute Josue' })).not.toBeInTheDocument()
    })
  })
})
