/**
@jest-environment jsdom
*/
import '@testing-library/jest-dom'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminUserManagement } from '../src/components/AdminUserManagement.tsx'

function reply(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body }
}

function setupFetch({ users = [], mutate = () => reply({}) } = {}) {
  global.fetch = jest.fn((url, options = {}) =>
    Promise.resolve(options.method ? mutate(url, options) : reply({ users })),
  )
}

const MARA = {
  id: 'u1',
  name: 'Mara',
  email: 'mara@example.com',
  role: 'user',
  chips: 1500,
  gamesPlayed: 12,
  lastActiveAt: '2026-03-15T12:00:00Z',
}
const THEO = {
  id: 'u2',
  name: 'Theo',
  email: 'theo@example.com',
  role: 'admin',
  chips: 200,
  gamesPlayed: 4,
  lastActiveAt: '2026-03-10T12:00:00Z',
}

async function renderLoaded(users = [MARA, THEO], mutate) {
  setupFetch({ users, mutate })
  render(<AdminUserManagement />)
  await screen.findByText(users[0]?.name ?? 'No users found.')
}

const rowOf = name => screen.getByText(name).closest('tr')

afterEach(() => {
  jest.restoreAllMocks()
})

describe('AdminUserManagement', () => {
  test('loads users using the default frequent sort', async () => {
    setupFetch({ users: [MARA] })
    render(<AdminUserManagement />)

    expect(await screen.findByText('Mara')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/admin/users?sort=frequent',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  test('shows a loading message while the request is pending', () => {
    global.fetch = jest.fn(() => new Promise(() => {}))
    render(<AdminUserManagement />)

    expect(screen.getByText('Loading users...')).toBeInTheDocument()
  })

  test('renders the user details', async () => {
    await renderLoaded()

    const mara = within(rowOf('Mara'))
    expect(mara.getByText('mara@example.com')).toBeInTheDocument()
    expect(mara.getByText('user')).toBeInTheDocument()
    expect(mara.getByText('12')).toBeInTheDocument()
    expect(mara.getByRole('spinbutton')).toHaveValue(1500)
  })

  test('shows an empty state when no users are returned', async () => {
    setupFetch({ users: [] })
    render(<AdminUserManagement />)
    expect(await screen.findByText('No users found.')).toBeInTheDocument()
  })

  test('shows the server error when loading fails', async () => {
    global.fetch = jest.fn(() => Promise.resolve(reply(
      { error: 'Could not load directory' },
      { ok: false, status: 500 },
    )))
    render(<AdminUserManagement />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load directory')
  })

  test('shows the network error when loading fails', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('offline')))
    render(<AdminUserManagement />)

    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
  })

  test('searches on submit and reloads when the sort changes', async () => {
    const user = userEvent.setup()
    await renderLoaded([MARA])

    await user.type(screen.getByRole('searchbox', { name: 'Search users' }), 'mara & co')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        '/api/admin/users?sort=frequent&search=mara+%26+co',
        expect.objectContaining({ credentials: 'include' }),
      )
    })

    await user.click(screen.getByRole('button', { name: 'Recent Users' }))
    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(
        '/api/admin/users?sort=recent&search=mara+%26+co',
        expect.objectContaining({ credentials: 'include' }),
      )
    })
  })

  test('updates a user balance and displays the returned balance', async () => {
    const updatedMara = { ...MARA, chips: 900 }
    await renderLoaded([MARA], () => reply({ user: updatedMara }))
    const user = userEvent.setup()
    const row = within(rowOf('Mara'))

    await user.clear(row.getByRole('spinbutton'))
    await user.type(row.getByRole('spinbutton'), '900')
    await user.click(row.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/users/u1/balance',
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          body: JSON.stringify({ balance: 900 }),
        }),
      )
    })
    expect(row.getByRole('spinbutton')).toHaveValue(900)
  })

  test('shows an update error and keeps the entered balance', async () => {
    await renderLoaded([MARA], () => reply(
      { error: 'Could not update balance' },
      { ok: false, status: 500 },
    ))
    const user = userEvent.setup()
    const row = within(rowOf('Mara'))

    await user.clear(row.getByRole('spinbutton'))
    await user.type(row.getByRole('spinbutton'), '900')
    await user.click(row.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not update balance')
    expect(row.getByRole('spinbutton')).toHaveValue(900)
  })

  test('does not send a negative balance', async () => {
    await renderLoaded([MARA])
    const user = userEvent.setup()
    const row = within(rowOf('Mara'))

    await user.clear(row.getByRole('spinbutton'))
    await user.type(row.getByRole('spinbutton'), '-1')
    await user.click(row.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Balance must be 0 or greater')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  test('resets the selected user password', async () => {
    await renderLoaded([MARA], () => reply({ message: 'Password updated for Mara' }))
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Reset Password' }))
    await user.type(screen.getByLabelText('New password for Mara'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Update Password' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/reset-password',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ targetUserId: 'u1', newPassword: 'new-password' }),
        }),
      )
    })
    expect(await screen.findByText('Password updated for Mara')).toBeInTheDocument()
  })

  test('requires confirmation before deleting and removes only the selected user', async () => {
    await renderLoaded()
    const user = userEvent.setup()
    const mara = within(rowOf('Mara'))

    await user.click(mara.getByRole('button', { name: 'Delete' }))
    expect(mara.getByRole('button', { name: 'Confirm Delete' })).toBeInTheDocument()
    await user.click(mara.getByRole('button', { name: 'Confirm Delete' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/users/u1',
        expect.objectContaining({ method: 'DELETE', credentials: 'include' }),
      )
      expect(screen.queryByText('Mara')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Theo')).toBeInTheDocument()
  })

  test('cancelling deletion does not send a request', async () => {
    await renderLoaded([MARA])
    const user = userEvent.setup()
    const mara = within(rowOf('Mara'))

    await user.click(mara.getByRole('button', { name: 'Delete' }))
    await user.click(mara.getByRole('button', { name: 'Cancel' }))

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Mara')).toBeInTheDocument()
  })

  test('keeps the user and shows an error when deletion fails', async () => {
    await renderLoaded([MARA], () => reply(
      { error: 'Could not delete user' },
      { ok: false, status: 500 },
    ))
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Confirm Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete user')
    expect(screen.getByText('Mara')).toBeInTheDocument()
  })
})
