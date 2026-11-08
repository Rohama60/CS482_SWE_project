/**
 * @jest-environment jsdom
 */
// P11: the lobby's Friends button (request badge) and joining a friend's table from the Friends page.
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { Lobby } from '../src/views/Lobby.tsx'
import { authClient } from '../lib/auth-client.ts'
import { getGuest } from '../src/guestSession.ts'
import { joinTable } from '../src/tableJoin.ts'

jest.mock('../lib/auth-client.ts', () => ({ authClient: { useSession: jest.fn(), signOut: jest.fn() } }))
jest.mock('../src/guestSession.ts', () => ({ getGuest: jest.fn() }))
jest.mock('../src/tableJoin.ts', () => ({ joinTable: jest.fn(), joinTableByCode: jest.fn(), spectateTable: jest.fn() }))
jest.mock('../src/components/ComplaintForm.tsx', () => ({ ComplaintForm: () => null }))
jest.mock('../src/components/AudioSettings.tsx', () => ({ AudioSettings: () => null }))

const SESSION = { user: { id: 'user-1', name: 'Preston' } }
const FRIEND = { id: 'f1', username: 'Josue', displayName: 'Josue', chips: 900, status: 'playing', activity: 'At the Velvet Room', tableId: 't9' }

function reply(body, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) })
}

function installFetch({ requests = [], requestsOk = true } = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    const key = `${options.method || 'GET'} ${url}`
    if (key === 'GET /api/tables') return reply({ tables: [] })
    if (key === 'GET /api/tables/mine') return reply({ tables: [] })
    if (key === 'GET /api/friends') return reply({ friends: [FRIEND] })
    if (key === 'GET /api/friends/requests') return requestsOk ? reply({ requests }) : reply({ error: 'nope' }, false)
    return reply({ error: `Unhandled ${key}` }, false)
  })
}

async function setup(options) {
  authClient.useSession.mockReturnValue({ data: SESSION })
  getGuest.mockReturnValue(null)
  installFetch(options)
  const props = { onBack: jest.fn(), onJoin: jest.fn(), onSpectate: jest.fn(), onSignUp: jest.fn() }
  render(<Lobby {...props} />)
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/friends/requests', expect.anything()))
  return props
}

const friendsButton = () => screen.getByRole('button', { name: /Friends/ })

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  delete global.fetch
})

describe('Friends button badge (P11)', () => {
  test('shows how many friend requests are waiting', async () => {
    await setup({ requests: [{ id: 'r1' }, { id: 'r2' }] })
    expect(await within(friendsButton()).findByText('2')).toBeInTheDocument()
  })

  test('no badge when there are no requests', async () => {
    await setup({ requests: [] })
    expect(within(friendsButton()).queryByTitle('Friend requests waiting')).not.toBeInTheDocument()
  })

  test('no badge if the requests cannot load', async () => {
    await setup({ requestsOk: false })
    expect(within(friendsButton()).queryByTitle('Friend requests waiting')).not.toBeInTheDocument()
  })

  test('guests do not ask for friend requests', async () => {
    authClient.useSession.mockReturnValue({ data: null })
    getGuest.mockReturnValue(null)
    installFetch()
    render(<Lobby onBack={jest.fn()} onJoin={jest.fn()} onSpectate={jest.fn()} onSignUp={jest.fn()} />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/tables'))
    expect(global.fetch).not.toHaveBeenCalledWith('/api/friends/requests', expect.anything())
  })
})

describe('Joining a friend from the Friends page (P11)', () => {
  test('Join takes you to your friend\'s table', async () => {
    const seated = { id: 't9', name: 'Velvet Room', players: 2, max: 4 }
    joinTable.mockResolvedValue(seated)
    const { onJoin } = await setup()

    fireEvent.click(friendsButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Join' }))

    await waitFor(() => expect(onJoin).toHaveBeenCalledWith(seated))
    expect(joinTable).toHaveBeenCalledWith('t9')
  })

  test('Back to lobby closes the Friends page', async () => {
    await setup()
    fireEvent.click(friendsButton())
    fireEvent.click(await screen.findByRole('button', { name: /Back to lobby/ }))
    expect(await screen.findByRole('button', { name: /Friends/ })).toBeInTheDocument()
  })
})
