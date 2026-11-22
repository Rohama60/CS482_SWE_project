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
jest.mock('../src/socket', () => ({ socket: { on: jest.fn(), off: jest.fn(), emit: jest.fn(), connect: jest.fn(), connected: true } }))

const SESSION = { user: { id: 'user-1', name: 'Preston' } }
const FRIEND = { id: 'f1', username: 'Josue', displayName: 'Josue', chips: 900, status: 'playing', activity: 'At the Velvet Room', tableId: 't9' }

function reply(body, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) })
}

function installFetch({ requests = [], requestsOk = true, supportUnread = 0 } = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    const key = `${options.method || 'GET'} ${url}`
    if (key === 'GET /api/tables') return reply({ tables: [] })
    if (key === 'GET /api/tables/mine') return reply({ tables: [] })
    if (key === 'GET /api/friends') return reply({ friends: [FRIEND] })
    if (key === 'GET /api/friends/requests') return requestsOk ? reply({ requests }) : reply({ error: 'nope' }, false)
    if (key === 'GET /api/support/unread') return reply({ unread: supportUnread })
    if (key === 'GET /api/support') return reply({ playerId: 'acct-1', messages: [] })
    if (key === 'GET /api/history') return reply({ stats: { hands: 1, wins: 1, losses: 0, winRate: 100, netChips: 40 }, games: [] })
    return reply({ error: `Unhandled ${key}` }, false)
  })
}

async function setup(options) {
  authClient.useSession.mockReturnValue({ data: SESSION })
  getGuest.mockReturnValue(null)
  installFetch(options)
  const props = { onBack: jest.fn(), onJoin: jest.fn(), onSpectate: jest.fn(), onSignUp: jest.fn(), onProfile: jest.fn(), onHistory: jest.fn(), onLeaderboard: jest.fn() }
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

describe('History button (P13)', () => {
  test('members have a History button that opens their game history', async () => {
    await setup()
    fireEvent.click(screen.getByRole('button', { name: /History/ }))
    // Rohama's version shows the history right in the lobby screen with a Back button
    expect(await screen.findByText('No games yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Back to lobby/ })).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/api/history', expect.anything())
  })

  test('Back to lobby from History returns to the lobby', async () => {
    await setup()
    fireEvent.click(screen.getByRole('button', { name: /History/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Back to lobby/ }))
    expect(await screen.findByText('Game Lobby')).toBeInTheDocument()
  })

  test('guests do not see a History button', async () => {
    authClient.useSession.mockReturnValue({ data: null })
    getGuest.mockReturnValue(null)
    installFetch()
    render(<Lobby onBack={jest.fn()} onJoin={jest.fn()} onSpectate={jest.fn()} onSignUp={jest.fn()} />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/tables'))
    expect(screen.queryByRole('button', { name: /History/ })).not.toBeInTheDocument()
  })
})

describe('Help in the name menu: chat with an admin (P18)', () => {
  // Help lives in Rohama's dropdown under your name
  const nameButton = () => screen.getByRole('button', { name: /Preston/ })
  const openMenu = () => fireEvent.click(nameButton())
  const helpButton = () => {
    if (!screen.queryByRole('menu')) openMenu()
    return screen.getByRole('menuitem', { name: /Help/ })
  }

  test('opens the chat with an admin over the lobby and closes the menu', async () => {
    await setup()
    fireEvent.click(helpButton())
    expect(await screen.findByRole('dialog', { name: 'Chat with an admin' })).toBeInTheDocument()
    expect(screen.getByText('Game Lobby')).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  test('the top bar sits above the lobby, so the menu is not hidden behind it', async () => {
    await setup()
    expect(nameButton().closest('header')).toHaveStyle({ zIndex: '30' })
  })

  test('Help sits in the menu between History and Sign out', async () => {
    await setup()
    openMenu()
    const items = screen.getAllByRole('menuitem').map(item => item.textContent)
    expect(items.findIndex(text => /Help/.test(text))).toBe(items.findIndex(text => /History/.test(text)) + 1)
    expect(items[items.length - 1]).toMatch(/Sign out/)
  })

  test('closing the chat goes back to just the lobby', async () => {
    await setup()
    fireEvent.click(helpButton())
    fireEvent.click(await screen.findByRole('button', { name: 'Close chat' }))
    expect(screen.queryByRole('dialog', { name: 'Chat with an admin' })).not.toBeInTheDocument()
  })

  test('a red dot on your name and a count on Help show unread admin replies', async () => {
    await setup({ supportUnread: 2 })
    expect(await within(nameButton()).findByTitle('New replies from an admin')).toBeInTheDocument()
    expect(within(helpButton()).getByTitle('New replies from an admin')).toHaveTextContent('2')
  })

  test('no dot when there are no unread replies', async () => {
    await setup({ supportUnread: 0 })
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/support/unread', expect.anything()))
    expect(within(nameButton()).queryByTitle('New replies from an admin')).not.toBeInTheDocument()
  })

  test('opening the chat clears the dot and the count', async () => {
    await setup({ supportUnread: 2 })
    await within(nameButton()).findByTitle('New replies from an admin')
    fireEvent.click(helpButton())
    expect(within(nameButton()).queryByTitle('New replies from an admin')).not.toBeInTheDocument()
    openMenu()
    expect(within(screen.getByRole('menuitem', { name: /Help/ })).queryByTitle('New replies from an admin')).not.toBeInTheDocument()
  })

  test('no badge if the count cannot load', async () => {
    authClient.useSession.mockReturnValue({ data: SESSION })
    getGuest.mockReturnValue(null)
    installFetch()
    const original = global.fetch
    global.fetch = jest.fn((url, options) => (url === '/api/support/unread' ? Promise.reject(new Error('down')) : original(url, options)))
    render(<Lobby onBack={jest.fn()} onJoin={jest.fn()} onSpectate={jest.fn()} onSignUp={jest.fn()} />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/support/unread', expect.anything()))
    expect(within(nameButton()).queryByTitle('New replies from an admin')).not.toBeInTheDocument()
  })

  test('guests do not see a Help button or ask for replies', async () => {
    authClient.useSession.mockReturnValue({ data: null })
    getGuest.mockReturnValue(null)
    installFetch()
    render(<Lobby onBack={jest.fn()} onJoin={jest.fn()} onSpectate={jest.fn()} onSignUp={jest.fn()} />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/tables'))
    expect(screen.queryByRole('menuitem', { name: /Help/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Help/ })).not.toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalledWith('/api/support/unread', expect.anything())
  })

  describe('the Chat with admin button in the corner', () => {
    const cornerButton = () => screen.getByRole('button', { name: /^(Chat with admin|Close chat with admin)/ })

    test('opens the chat in the bottom-left, and clicking again closes it', async () => {
      await setup()
      fireEvent.click(cornerButton())
      expect(await screen.findByRole('dialog', { name: 'Chat with an admin' })).toHaveStyle({ left: '16px' })
      expect(cornerButton()).toHaveAccessibleName('Close chat with admin')
      fireEvent.click(cornerButton())
      expect(screen.queryByRole('dialog', { name: 'Chat with an admin' })).not.toBeInTheDocument()
    })

    test('shows the unread count and clears it when opened', async () => {
      await setup({ supportUnread: 2 })
      expect(await screen.findByRole('button', { name: 'Chat with admin, 2 new replies' })).toBeInTheDocument()
      fireEvent.click(cornerButton())
      fireEvent.click(cornerButton())
      expect(await screen.findByRole('button', { name: 'Chat with admin' })).toBeInTheDocument()
    })

    test('the lobby leaves room at the bottom so nothing gets stuck under the button', async () => {
      await setup()
      expect(screen.getByText('Game Lobby').closest('div.min-h-screen')).toHaveStyle({ paddingBottom: '96px' })
    })

    test('Help in the name menu opens the same chat', async () => {
      await setup()
      fireEvent.click(helpButton())
      expect(await screen.findByRole('dialog', { name: 'Chat with an admin' })).toBeInTheDocument()
      expect(cornerButton()).toHaveAccessibleName('Close chat with admin')
    })

    test('guests do not get the corner button or the extra space', async () => {
      authClient.useSession.mockReturnValue({ data: null })
      getGuest.mockReturnValue(null)
      installFetch()
      render(<Lobby onBack={jest.fn()} onJoin={jest.fn()} onSpectate={jest.fn()} onSignUp={jest.fn()} />)
      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/tables'))
      expect(screen.queryByRole('button', { name: /Chat with admin/ })).not.toBeInTheDocument()
      expect(screen.getByText('Game Lobby').closest('div.min-h-screen')).not.toHaveStyle({ paddingBottom: '96px' })
    })
  })
})
