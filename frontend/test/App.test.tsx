/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { jest, beforeEach, afterEach, describe, test, expect } from '@jest/globals'

const mockUseSession = jest.fn()
const mockSignOut = jest.fn()
const mockJoinTable = jest.fn()
const mockStopSpectating = jest.fn()

jest.mock('../src/AuthClient.ts', () => ({
  authClient: {
    useSession: () => mockUseSession(),
    signOut: (...args) => mockSignOut(...args),
  },
}))
jest.mock('../src/views/Home.tsx', () => ({
  __esModule: true,
  default: ({ onSignUp, onSignIn, onProfile, onHistory }) => (
    <main>
      <div>Home view</div>
      <button onClick={onSignUp}>Sign up from home</button>
      <button onClick={onSignIn}>Log in from home</button>
      <button onClick={onProfile}>Profile from home</button>
      <button onClick={onHistory}>History from home</button>
    </main>
  ),
}))
jest.mock('../src/views/SignUpView.tsx', () => ({
  SignUpView: ({ onClose, onSuccess }) => (
    <main>
      <div>Sign-up view</div>
      <button onClick={onClose}>Close sign-up</button>
      <button onClick={onSuccess}>Finish sign-up</button>
    </main>
  ),
}))
jest.mock('../src/views/Lobby.tsx', () => ({
  Lobby: ({ onBack, onJoin, onSpectate, onSignUp, onProfile, onHistory, onLeaderboard }) => (
    <main>
      <div>Lobby view</div>
      <button onClick={onBack}>Lobby back</button>
      <button onClick={() => onJoin({ id: 42, name: 'Open Table' })}>Join table</button>
      <button onClick={() => onSpectate({ id: 43, name: 'Watched Table' })}>Spectate table</button>
      <button onClick={onSignUp}>Sign up from lobby</button>
      <button onClick={onProfile}>Profile from lobby</button>
      <button onClick={onHistory}>History from lobby</button>
      <button onClick={onLeaderboard}>Leaderboard from lobby</button>
    </main>
  ),
}))
jest.mock('../src/views/PokerTableView.tsx', () => ({
  PokerTable: ({ table, spectating, onTakeSeat, onLeave }) => (
    <main>
      <div data-testid="table-view">{table.name} · spectating: {String(spectating)}</div>
      <button onClick={onTakeSeat}>Take seat</button>
      <button onClick={onLeave}>Leave table</button>
    </main>
  ),
}))
jest.mock('../src/tableJoin.ts', () => ({
  joinTable: (...args) => mockJoinTable(...args),
  stopSpectating: (...args) => mockStopSpectating(...args),
}))
jest.mock('../src/components/LoginModal.tsx', () => ({
  LoginModal: ({ onClose, onSuccess, onSignUp }) => (
    <main>
      <div>Login modal</div>
      <button onClick={() => onSuccess('admin')}>Finish admin login</button>
      <button onClick={() => onSuccess('player')}>Finish player login</button>
      <button onClick={onClose}>Close login</button>
      <button onClick={onSignUp}>Sign up from login</button>
    </main>
  ),
}))
jest.mock('../src/views/AdminDashboard.tsx', () => ({
  AdminDashboard: ({ onLeave, onSignOut, onSessionExpired }) => (
    <main>
      <div>Admin dashboard</div>
      <button onClick={onLeave}>View public site</button>
      <button onClick={onSignOut}>Sign out admin</button>
      <button onClick={onSessionExpired}>Admin session expired</button>
    </main>
  ),
}))
jest.mock('../src/views/ProfileTab.tsx', () => ({
  __esModule: true,
  default: ({ user, onBack, onLogout }) => (
    <main>
      <div>Profile for {user.displayName}</div>
      <button onClick={onBack}>Profile back</button>
      <button onClick={onLogout}>Profile logout</button>
    </main>
  ),
}))
jest.mock('../src/views/LeaderboardView.tsx', () => ({
  __esModule: true,
  default: ({ currentUser, onBack, onProfile, onLogout }) => (
    <main>
      <div>Leaderboard view</div>
      <div>Leaderboard user: {currentUser?.id ?? 'guest'}</div>
      <button onClick={onBack}>Leaderboard back</button>
      <button onClick={onProfile}>Profile from leaderboard</button>
      <button onClick={onLogout}>Leaderboard logout</button>
    </main>
  ),
}))
jest.mock('../src/views/HistoryPage.tsx', () => ({
  HistoryPage: ({ onBack, backLabel }) => (
    <main>
      <div>History view</div>
      <div>{backLabel}</div>
      <button onClick={onBack}>History back</button>
    </main>
  ),
}))

import App from '../src/App.tsx'

function setCurrentUserResponse(role = 'player', ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: async () => ({ user: { role } }),
  })
}

describe('App navigation and session routing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-1', name: 'Mara', email: 'mara@example.com' } },
    })
    mockSignOut.mockResolvedValue({ error: null })
    mockJoinTable.mockResolvedValue({ id: 42, name: 'Seated Table' })
    setCurrentUserResponse()
  })

  afterEach(() => {
    delete global.fetch
    jest.restoreAllMocks()
  })

  test('shows home without a session and does not request the current user', () => {
    mockUseSession.mockReturnValue({ data: null })
    global.fetch = jest.fn()

    render(<App />)

    expect(screen.getByText('Home view')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('restores an authenticated admin to the admin dashboard', async () => {
    setCurrentUserResponse('admin')

    render(<App />)

    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/users/me',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  test('keeps a regular player on the home view', async () => {
    setCurrentUserResponse()

    render(<App />)

    expect(screen.getByText('Home view')).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument()
  })

  test('reports errors while restoring the current user role', async () => {
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {})
    setCurrentUserResponse('player', false)

    render(<App />)

    await waitFor(() => expect(logError).toHaveBeenCalledWith(
      'Unable to restore the admin dashboard:',
      expect.any(Error),
    ))
    expect(screen.getByText('Home view')).toBeInTheDocument()
  })

  test('does not report an aborted role request as an error', async () => {
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {})
    const abortError = new Error('Request aborted')
    abortError.name = 'AbortError'
    global.fetch = jest.fn().mockRejectedValue(abortError)

    render(<App />)

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(logError).not.toHaveBeenCalled()
  })

  test('opens sign-up from home and returns home when closed', async () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Sign up from home' }))
    expect(screen.getByText('Sign-up view')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close sign-up' }))
    expect(screen.getByText('Home view')).toBeInTheDocument()
  })

  test('successful sign-up opens the lobby', async () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Sign up from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finish sign-up' }))
    expect(screen.getByText('Lobby view')).toBeInTheDocument()
  })

  test.each([
    ['admin', 'Admin dashboard'],
    ['player', 'Lobby view'],
  ])('routes a successful %s login to the correct view', async (role, destination) => {
    mockUseSession.mockReturnValue({ data: null })
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Log in from home' }))
    await userEvent.click(screen.getByRole('button', { name: `Finish ${role} login` }))
    expect(screen.getByText(destination)).toBeInTheDocument()
  })

  test('closing login returns to home', async () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Log in from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close login' }))
    expect(screen.getByText('Home view')).toBeInTheDocument()
  })

  test('sign-up from login returns to the previous view when closed', async () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Log in from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sign up from login' }))
    expect(screen.getByText('Sign-up view')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close sign-up' }))
    expect(screen.getByText('Home view')).toBeInTheDocument()
  })

  test('admin dashboard actions return to the expected view', async () => {
    setCurrentUserResponse('admin')
    render(<App />)
    await screen.findByText('Admin dashboard')

    await userEvent.click(screen.getByRole('button', { name: 'View public site' }))
    expect(screen.getByText('Lobby view')).toBeInTheDocument()
  })

  test('admin sign-out and expired sessions return home', async () => {
    setCurrentUserResponse('admin')
    const { unmount } = render(<App />)
    await screen.findByText('Admin dashboard')
    await userEvent.click(screen.getByRole('button', { name: 'Sign out admin' }))
    expect(screen.getByText('Home view')).toBeInTheDocument()

    unmount()
    render(<App />)
    await screen.findByText('Admin dashboard')
    await userEvent.click(screen.getByRole('button', { name: 'Admin session expired' }))
    expect(screen.getByText('Home view')).toBeInTheDocument()
  })

  test('lobby navigation supports back, signup, leaderboard and history', async () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Log in from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finish player login' }))

    await userEvent.click(screen.getByRole('button', { name: 'Leaderboard from lobby' }))
    expect(screen.getByText('Leaderboard view')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Leaderboard back' }))
    expect(screen.getByText('Lobby view')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'History from lobby' }))
    expect(screen.getByText('Back to lobby')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'History back' }))
    expect(screen.getByText('Lobby view')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Sign up from lobby' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close sign-up' }))
    expect(screen.getByText('Lobby view')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Lobby back' }))
    expect(screen.getByText('Home view')).toBeInTheDocument()
  })

  test('home history returns home', async () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'History from home' }))
    expect(screen.getByText('Back to home')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'History back' }))
    expect(screen.getByText('Home view')).toBeInTheDocument()
  })

  test('profile navigation shows the current user and returns to its source view', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Profile from home' }))
    expect(screen.getByText('Profile for Mara')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Profile back' }))
    expect(screen.getByText('Home view')).toBeInTheDocument()

    setCurrentUserResponse()
    await userEvent.click(screen.getByRole('button', { name: 'Log in from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finish player login' }))
    await userEvent.click(screen.getByRole('button', { name: 'Profile from lobby' }))
    expect(screen.getByText('Profile for Mara')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Profile back' }))
    expect(screen.getByText('Lobby view')).toBeInTheDocument()
  })

  test('profile without an authenticated session falls back to home', async () => {
    mockUseSession.mockReturnValue({ data: null })
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Profile from home' }))
    expect(screen.getByText('Home view')).toBeInTheDocument()
  })

  test('profile logout signs out and returns home', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Profile from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Profile logout' }))

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Home view')).toBeInTheDocument()
  })

  test('profile logout stays on profile when sign-out returns an error', async () => {
    mockSignOut.mockResolvedValue({ error: new Error('Sign out failed') })
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Profile from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Profile logout' }))

    await waitFor(() => expect(logError).toHaveBeenCalledWith('Sign out failed:', expect.any(Error)))
    expect(screen.getByText('Profile for Mara')).toBeInTheDocument()
  })

  test('profile logout stays on profile when sign-out throws', async () => {
    mockSignOut.mockRejectedValue(new Error('Network unavailable'))
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Profile from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Profile logout' }))

    await waitFor(() => expect(logError).toHaveBeenCalledWith('Sign out failed:', expect.any(Error)))
    expect(screen.getByText('Profile for Mara')).toBeInTheDocument()
  })

  test('leaderboard logout returns home after signing out', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Log in from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finish player login' }))
    await userEvent.click(screen.getByRole('button', { name: 'Leaderboard from lobby' }))
    expect(screen.getByText('Leaderboard user: user-1')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Leaderboard logout' }))

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Home view')).toBeInTheDocument()
  })

  test('leaderboard profile returns to the leaderboard', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Log in from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finish player login' }))
    await userEvent.click(screen.getByRole('button', { name: 'Leaderboard from lobby' }))
    await userEvent.click(screen.getByRole('button', { name: 'Profile from leaderboard' }))
    expect(screen.getByText('Profile for Mara')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Profile back' }))
    expect(screen.getByText('Leaderboard view')).toBeInTheDocument()
  })

  test('joining a table opens a playable table and leaving returns to lobby', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Log in from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finish player login' }))
    await userEvent.click(screen.getByRole('button', { name: 'Join table' }))
    expect(screen.getByTestId('table-view')).toHaveTextContent('Open Table · spectating: false')
    await userEvent.click(screen.getByRole('button', { name: 'Leave table' }))
    expect(screen.getByText('Lobby view')).toBeInTheDocument()
    expect(mockStopSpectating).not.toHaveBeenCalled()
  })

  test('spectating can be left or converted to a seat', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Log in from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finish player login' }))
    await userEvent.click(screen.getByRole('button', { name: 'Spectate table' }))
    expect(screen.getByTestId('table-view')).toHaveTextContent('Watched Table · spectating: true')
    await userEvent.click(screen.getByRole('button', { name: 'Take seat' }))

    await waitFor(() => expect(mockJoinTable).toHaveBeenCalledWith(43, undefined))
    expect(screen.getByTestId('table-view')).toHaveTextContent('Seated Table · spectating: false')
    await userEvent.click(screen.getByRole('button', { name: 'Leave table' }))
    expect(mockStopSpectating).not.toHaveBeenCalled()
  })

  test('leaving a spectated table stops spectating', async () => {
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Log in from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finish player login' }))
    await userEvent.click(screen.getByRole('button', { name: 'Spectate table' }))
    await userEvent.click(screen.getByRole('button', { name: 'Leave table' }))

    expect(mockStopSpectating).toHaveBeenCalledWith(43)
    expect(screen.getByText('Lobby view')).toBeInTheDocument()
  })

  test('a failed attempt to take a seat displays an error', async () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {})
    mockJoinTable.mockRejectedValue(new Error('Table is full'))
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Log in from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finish player login' }))
    await userEvent.click(screen.getByRole('button', { name: 'Spectate table' }))
    await userEvent.click(screen.getByRole('button', { name: 'Take seat' }))

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Table is full'))
  })

  test('a non-error seat failure displays a fallback message', async () => {
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {})
    mockJoinTable.mockRejectedValue('unexpected failure')
    render(<App />)

    await userEvent.click(screen.getByRole('button', { name: 'Log in from home' }))
    await userEvent.click(screen.getByRole('button', { name: 'Finish player login' }))
    await userEvent.click(screen.getByRole('button', { name: 'Spectate table' }))
    await userEvent.click(screen.getByRole('button', { name: 'Take seat' }))

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not take a seat'))
  })
})
