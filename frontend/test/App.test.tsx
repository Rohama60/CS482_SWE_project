/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { jest, beforeEach, afterEach, test, expect } from '@jest/globals'

const mockUseSession = jest.fn()

jest.mock('../src/AuthClient.ts', () => ({
  authClient: { useSession: () => mockUseSession() },
}))
jest.mock('../src/views/Home.tsx', () => ({
  __esModule: true,
  default: () => <div>Home view</div>,
}))
jest.mock('../src/views/SignUpView.tsx', () => ({ SignUpView: () => null }))
jest.mock('../src/views/Lobby.tsx', () => ({ Lobby: () => null }))
jest.mock('../src/views/PokerTableView.tsx', () => ({ PokerTable: () => null }))
jest.mock('../src/tableJoin.ts', () => ({ joinTable: jest.fn(), stopSpectating: jest.fn() }))
jest.mock('../src/components/LoginModal.tsx', () => ({ LoginModal: () => null }))
jest.mock('../src/views/AdminDashboard.tsx', () => ({
  AdminDashboard: () => <div>Admin dashboard</div>,
}))
jest.mock('../src/views/ProfileTab.tsx', () => ({ __esModule: true, default: () => null }))
jest.mock('../src/views/LeaderboardView.tsx', () => ({ __esModule: true, default: () => null }))
jest.mock('../src/views/HistoryPage.tsx', () => ({ HistoryPage: () => null }))

import App from '../src/App.tsx'

describe('App session routing', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSession.mockReturnValue({ data: { user: { id: 'test-admin-id' } } })
  })

  afterEach(() => {
    delete global.fetch
  })

  test('restores an authenticated admin to the admin dashboard', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { role: 'admin' } }),
    })

    render(<App />)

    expect(await screen.findByText('Admin dashboard')).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/users/me',
      expect.objectContaining({ credentials: 'include' }),
    ))
  })

  test('keeps a regular player on the home view', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { role: 'player' } }),
    })

    render(<App />)

    expect(await screen.findByText('Home view')).toBeInTheDocument()
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(screen.queryByText('Admin dashboard')).not.toBeInTheDocument()
  })
})
