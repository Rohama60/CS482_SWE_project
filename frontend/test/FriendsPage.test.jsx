/**
 * @jest-environment jsdom
 */
// P11: the Friends page (Rohama's design) talking to the real friends API.
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { FriendsPage } from '../src/views/FriendsPage.tsx'

const FRIENDS = [
  { id: 'f1', username: 'Josue', displayName: 'Josue S', chips: 1240, status: 'playing', activity: 'At the Velvet Room', tableId: 't9' },
  { id: 'f2', username: 'Ayana', displayName: 'Ayana', chips: 300, status: 'idle', activity: 'Not at a table' },
]
const REQUESTS = [
  { id: 'r1', from: { id: 'a1', username: 'Rohama60', displayName: 'Rohama', chips: 500 } },
]

function reply(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) })
}

// Answers the page's requests by "METHOD url". Overrides replace any answer.
function installFetch({ friends = FRIENDS, requests = REQUESTS, overrides = {} } = {}) {
  // Like the real server, an answered request stops showing up
  let pending = [...requests]
  global.fetch = jest.fn((url, options = {}) => {
    const key = `${options.method || 'GET'} ${url}`
    if (overrides[key]) return overrides[key](url, options)
    if (key === 'GET /api/friends') return reply({ friends })
    if (key === 'GET /api/friends/requests') return reply({ requests: pending })
    if (key === 'POST /api/friends/requests') return reply({ message: 'Friend request sent to Theo' })
    if (key === 'POST /api/friends/requests/r1/accept' || key === 'POST /api/friends/requests/r1/decline') {
      pending = pending.filter(r => r.id !== 'r1')
      return reply({ message: 'ok' })
    }
    return reply({ error: `Unhandled ${key}` }, false)
  })
}

const calls = key => global.fetch.mock.calls.filter(([url, o = {}]) => `${o.method || 'GET'} ${url}` === key)

async function setup(options) {
  installFetch(options)
  const onBack = jest.fn()
  const onJoinTable = jest.fn()
  render(<FriendsPage onBack={onBack} onJoinTable={onJoinTable} />)
  await waitFor(() => expect(screen.queryByText('Loading friends...')).not.toBeInTheDocument())
  return { onBack, onJoinTable }
}

const tab = name => screen.getByRole('tab', { name: new RegExp(`^${name}`) })
const inviteBox = () => screen.getByLabelText('Player name or email')

afterEach(() => {
  delete global.fetch
})

describe('Friends tab', () => {
  test('shows your real friends with chips and what they are doing', async () => {
    await setup()
    expect(screen.getByText('Josue S')).toBeInTheDocument()
    expect(screen.getByText('$1,240')).toBeInTheDocument()
    expect(screen.getByText('At the Velvet Room')).toBeInTheDocument()
    expect(screen.getByText('Not at a table')).toBeInTheDocument()
  })

  test('asks the server for friends and requests with the login cookie', async () => {
    await setup()
    const [[, options]] = calls('GET /api/friends')
    expect(options.credentials).toBe('include')
    expect(calls('GET /api/friends/requests')).toHaveLength(1)
  })

  test('the tabs show real counts', async () => {
    await setup()
    expect(tab('Friends 2')).toBeInTheDocument()
    expect(tab('Requests 1')).toBeInTheDocument()
  })

  test('the header counts friends who are playing', async () => {
    await setup()
    expect(screen.getByText('1 friend is at the tables now')).toBeInTheDocument()
  })

  test('the header uses "friends" for more than one', async () => {
    await setup({ friends: [FRIENDS[0], { ...FRIENDS[1], status: 'playing' }] })
    expect(screen.getByText('2 friends are at the tables now')).toBeInTheDocument()
  })

  test('avatars show the first two letters', async () => {
    await setup()
    expect(screen.getByText('JO')).toBeInTheDocument()
    expect(screen.getByText('AY')).toBeInTheDocument()
  })

  test('shows Loading friends while waiting', async () => {
    installFetch({ overrides: { 'GET /api/friends': () => new Promise(() => {}) } })
    render(<FriendsPage onBack={jest.fn()} />)
    expect(screen.getByText('Loading friends...')).toBeInTheDocument()
  })

  test('search matches display name or username', async () => {
    await setup()
    fireEvent.change(screen.getByLabelText('Search friends'), { target: { value: 'josue' } })
    expect(screen.getByText('Josue S')).toBeInTheDocument()
    expect(screen.queryByText('Ayana')).not.toBeInTheDocument()
  })

  test('a search with no matches says so', async () => {
    await setup()
    fireEvent.change(screen.getByLabelText('Search friends'), { target: { value: 'zzz' } })
    expect(screen.getByText('No friends found')).toBeInTheDocument()
  })

  test('someone with no friends is pointed to the Invite tab', async () => {
    await setup({ friends: [] })
    expect(screen.getByText('No friends yet')).toBeInTheDocument()
    expect(screen.getByText('Send a request from the Invite tab.')).toBeInTheDocument()
  })

  test('a load error is shown', async () => {
    await setup({ overrides: { 'GET /api/friends': () => reply({ error: 'Log in to see your friends' }, false) } })
    expect(screen.getByRole('alert')).toHaveTextContent('Log in to see your friends')
  })

  test('a load error with no message uses a general one', async () => {
    await setup({ overrides: { 'GET /api/friends': () => Promise.resolve({ ok: false, json: () => Promise.reject(new Error('x')) }) } })
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  test('a server that cannot be reached shows a fallback message', async () => {
    await setup({ overrides: { 'GET /api/friends': () => Promise.reject('down') } })
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your friends')
  })

  test('missing lists from the server count as empty', async () => {
    await setup({ overrides: { 'GET /api/friends': () => reply({}), 'GET /api/friends/requests': () => reply({}) } })
    expect(tab('Friends 0')).toBeInTheDocument()
    expect(tab('Requests 0')).toBeInTheDocument()
  })

  test('a friend who is playing has a Join button that joins their table', async () => {
    const { onJoinTable } = await setup()
    const row = screen.getByText('Josue S').closest('div.rounded-xl')
    fireEvent.click(within(row).getByRole('button', { name: 'Join' }))
    expect(onJoinTable).toHaveBeenCalledWith('t9')
  })

  test('a friend who is not at a table has no Join button', async () => {
    await setup()
    const row = screen.getByText('Ayana').closest('div.rounded-xl')
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()
  })

  test('no Join button if the page was opened without a way to join', async () => {
    installFetch()
    render(<FriendsPage onBack={jest.fn()} />)
    await screen.findByText('Josue S')
    expect(screen.queryByRole('button', { name: 'Join' })).not.toBeInTheDocument()
  })

  test('Back to lobby calls onBack', async () => {
    const { onBack } = await setup()
    fireEvent.click(screen.getByRole('button', { name: /Back to lobby/ }))
    expect(onBack).toHaveBeenCalled()
  })
})

describe('Requests tab', () => {
  test('shows who sent you a request', async () => {
    await setup()
    fireEvent.click(tab('Requests'))
    expect(screen.getByText('Rohama')).toBeInTheDocument()
    expect(screen.getByText('Sent you a friend request')).toBeInTheDocument()
  })

  test('Accept tells the server, removes the request and reloads friends', async () => {
    await setup()
    fireEvent.click(tab('Requests'))
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))

    expect(await screen.findByText('You’re all caught up')).toBeInTheDocument()
    expect(calls('POST /api/friends/requests/r1/accept')).toHaveLength(1)
    await waitFor(() => expect(calls('GET /api/friends')).toHaveLength(2))
  })

  test('Ignore tells the server and removes the request without reloading', async () => {
    await setup()
    fireEvent.click(tab('Requests'))
    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }))

    expect(await screen.findByText('You’re all caught up')).toBeInTheDocument()
    expect(calls('POST /api/friends/requests/r1/decline')).toHaveLength(1)
    expect(calls('GET /api/friends')).toHaveLength(1)
  })

  test('a failed answer shows an error and keeps the request', async () => {
    await setup({ overrides: { 'POST /api/friends/requests/r1/accept': () => reply({ error: 'Friend request not found' }, false) } })
    fireEvent.click(tab('Requests'))
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Friend request not found')
    expect(screen.getByText('Rohama')).toBeInTheDocument()
  })

  test('a failed answer that is not a normal error uses a fallback', async () => {
    await setup({ overrides: { 'POST /api/friends/requests/r1/decline': () => Promise.reject('down') } })
    fireEvent.click(tab('Requests'))
    fireEvent.click(screen.getByRole('button', { name: 'Ignore' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not answer the request')
  })

  test('no requests says you are all caught up', async () => {
    await setup({ requests: [] })
    fireEvent.click(tab('Requests'))
    expect(screen.getByText('You’re all caught up')).toBeInTheDocument()
  })
})

describe('Invite tab (send a friend request)', () => {
  async function openInvite(options) {
    await setup(options)
    fireEvent.click(tab('Invite'))
  }

  test('sends the name to the server and shows the result', async () => {
    await openInvite()
    fireEvent.change(inviteBox(), { target: { value: '  Theo ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByText('Friend request sent to Theo')).toBeInTheDocument()
    const [[, options]] = calls('POST /api/friends/requests')
    expect(JSON.parse(options.body)).toEqual({ player: 'Theo' })
    expect(inviteBox()).toHaveValue('')
  })

  test('pressing Enter sends too', async () => {
    await openInvite()
    fireEvent.change(inviteBox(), { target: { value: 'theo@example.com' } })
    fireEvent.keyDown(inviteBox(), { key: 'Enter' })
    expect(await screen.findByText('Friend request sent to Theo')).toBeInTheDocument()
  })

  test('other keys do not send', async () => {
    await openInvite()
    fireEvent.change(inviteBox(), { target: { value: 'Theo' } })
    fireEvent.keyDown(inviteBox(), { key: 'a' })
    expect(calls('POST /api/friends/requests')).toHaveLength(0)
  })

  test('Send is disabled until something is typed', async () => {
    await openInvite()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    fireEvent.keyDown(inviteBox(), { key: 'Enter' })
    expect(calls('POST /api/friends/requests')).toHaveLength(0)
  })

  test('the server error is shown, like a player who does not exist', async () => {
    await openInvite({ overrides: { 'POST /api/friends/requests': () => reply({ error: 'No player with that name or email' }, false) } })
    fireEvent.change(inviteBox(), { target: { value: 'Nobody' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No player with that name or email')
    expect(inviteBox()).toHaveValue('Nobody')
  })

  test('typing again clears the error', async () => {
    await openInvite({ overrides: { 'POST /api/friends/requests': () => reply({ error: 'Nope' }, false) } })
    fireEvent.change(inviteBox(), { target: { value: 'Nobody' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('alert')
    fireEvent.change(inviteBox(), { target: { value: 'Theo' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('a failure that is not a normal error uses a fallback', async () => {
    await openInvite({ overrides: { 'POST /api/friends/requests': () => Promise.reject('down') } })
    fireEvent.change(inviteBox(), { target: { value: 'Theo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send the request')
  })

  test('the button says Sending and blocks double clicks while waiting', async () => {
    let finish
    await openInvite({ overrides: { 'POST /api/friends/requests': () => new Promise(r => { finish = r }) } })
    fireEvent.change(inviteBox(), { target: { value: 'Theo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByRole('button', { name: 'Sending' })).toBeDisabled()
    fireEvent.keyDown(inviteBox(), { key: 'Enter' })
    expect(calls('POST /api/friends/requests')).toHaveLength(1)
    finish({ ok: true, json: () => Promise.resolve({ message: 'Friend request sent to Theo' }) })
    expect(await screen.findByText('Friend request sent to Theo')).toBeInTheDocument()
  })

  test('the bottom button switches between Invite and Friends', async () => {
    await setup()
    fireEvent.click(screen.getByRole('button', { name: 'Invite a player' }))
    expect(inviteBox()).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to friends' }))
    expect(screen.getByLabelText('Search friends')).toBeInTheDocument()
  })

  test('Copy link shows a confirmation', async () => {
    await openInvite()
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(screen.getByText('Invite link copied to your clipboard.')).toBeInTheDocument()
  })
})
