/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom'

import { render, screen, within, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Lobby } from '../src/views/Lobby.tsx'
import { authClient } from '../lib/auth-client.ts'
import { getGuest } from '../src/guestSession.ts'
import { joinTable, joinTableByCode, spectateTable } from '../src/tableJoin.ts'

// ---------------------------------------------------------------
// Module mocks
//
// Each factory creates its own jest.fn() and the test file imports the
// mocked module above to reach it. (Referencing outer variables inside a
// jest.mock factory fails because jest.mock is hoisted above them.)
// The real TableCreation is NOT mocked, so create/edit run end to end.
// ---------------------------------------------------------------

jest.mock('../lib/auth-client.ts', () => ({
  authClient: { useSession: jest.fn(), signOut: jest.fn() },
}))

jest.mock('../src/guestSession.ts', () => ({
  getGuest: jest.fn(),
}))

jest.mock('../src/tableJoin.ts', () => ({
  joinTable: jest.fn(),
  joinTableByCode: jest.fn(),
  spectateTable: jest.fn(),
}))

jest.mock('../src/components/ComplaintForm.tsx', () => {
  const React = require('react')
  return {
    ComplaintForm: ({ reporterId }) =>
      React.createElement('div', { 'data-testid': 'complaint-form' }, `reporter:${reporterId}`),
  }
})

jest.mock('../src/components/AudioSettings.tsx', () => {
  const React = require('react')
  return {
    AudioSettings: ({ userId }) =>
      React.createElement('div', { 'data-testid': 'audio-settings' }, `user:${userId}`),
  }
})

// ---------------------------------------------------------------
// Test data
// ---------------------------------------------------------------

const TABLES = [
  { id: '1', name: 'Velvet Room',    stakes: 'low',    blind: '1 / 2',   players: 4, max: 6, status: 'active',  avgPot: '$18',  hands: 142 },
  { id: '2', name: 'The Boneyard',   stakes: 'medium', blind: '5 / 10',  players: 3, max: 6, status: 'active',  avgPot: '$87',  hands: 58 },
  { id: '3', name: 'Crimson Lounge', stakes: 'high',   blind: '25 / 50', players: 5, max: 6, status: 'active',  avgPot: '$420', hands: 31 },
  { id: '4', name: 'Dead Mans Hand', stakes: 'medium', blind: '5 / 10',  players: 6, max: 6, status: 'full',    avgPot: '$95',  hands: 77 },
  { id: '5', name: 'Parlor No. 7',   stakes: 'low',    blind: '1 / 2',   players: 1, max: 6, status: 'waiting', avgPot: '—',    hands: 0 },
]

const HOSTED = {
  id: 'm1', name: 'My Hosted Table', stakes: 'medium', blind: '5 / 10',
  players: 3, max: 4, status: 'active', avgPot: '$50', hands: 12,
  bots: 2, isPrivate: false,
}

const HOSTED_PRIVATE = {
  id: 'm2', name: 'Secret Club', stakes: 'low', blind: '1 / 2',
  players: 1, max: 6, status: 'waiting', avgPot: '—', hands: 0,
  bots: 0, isPrivate: true, inviteCode: 'K7Q2MX',
}

const SESSION = { user: { id: 'user-1', name: 'Jane Doe' } }

const CREATE_URL = 'http://localhost:3000/api/tables'

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return Promise.resolve({ ok, status, json: async () => data })
}

// Routes fetch calls by "METHOD url". `overrides` replaces any route.
function installFetch({ tables = TABLES, mine = [], overrides = {} } = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    const key = `${options.method || 'GET'} ${url}`
    if (overrides[key]) return overrides[key](url, options)
    if (key === 'GET /api/tables') return jsonResponse({ tables })
    if (key === 'GET /api/tables/mine') return jsonResponse({ tables: mine })
    return jsonResponse({ error: `Unhandled request: ${key}` }, { ok: false, status: 404 })
  })
}

// Finds a recorded fetch call by "METHOD url"
const callFor = key =>
  global.fetch.mock.calls.find(
    ([url, options]) => `${(options && options.method) || 'GET'} ${url}` === key
  )

async function setup({ session = null, guest = null, tables = TABLES, mine = [], overrides = {} } = {}) {
  authClient.useSession.mockReturnValue({ data: session })
  getGuest.mockReturnValue(guest)
  installFetch({ tables, mine, overrides })

  const props = {
    onBack: jest.fn(),
    onJoin: jest.fn(),
    onSpectate: jest.fn(),
    onSignUp: jest.fn(),
  }
  const user = userEvent.setup()

  render(<Lobby {...props} />)

  // Wait for the initial loads so state updates finish inside the test
  if (tables.length) await screen.findAllByText(tables[0].name)
  else await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/tables'))
  if (session && mine.length) await screen.findByText(`${mine.length} Hosted`)

  return { user, ...props }
}

// The card that contains a table's heading (index 0 = My Tables if listed there)
const cardOf = (name, index = 0) =>
  screen.getAllByRole('heading', { name })[index].closest('.rounded-2xl')

const takeSeatIn = name => within(cardOf(name)).getByRole('button', { name: 'Take a Seat' })

beforeEach(() => {
  jest.resetAllMocks()
  authClient.signOut.mockResolvedValue({ error: null })
  jest.spyOn(window, 'alert').mockImplementation(() => {})
  jest.spyOn(window, 'confirm').mockImplementation(() => true)
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

// ---------------------------------------------------------------
// Loading and listing tables
// ---------------------------------------------------------------

describe('Lobby: table list', () => {
  test('loads tables from the API and renders each card', async () => {
    await setup()

    expect(global.fetch).toHaveBeenCalledWith('/api/tables')
    for (const table of TABLES) {
      expect(screen.getByRole('heading', { name: table.name })).toBeInTheDocument()
    }
    expect(screen.getByText(/Blinds 1 \/ 2 · 142 hands played/)).toBeInTheDocument()
    expect(screen.getByText('4/6 seated · avg pot $18')).toBeInTheDocument()
  })

  test('subtitle counts only tables that are not full', async () => {
    await setup()

    expect(screen.getByText('4 tables with open seats')).toBeInTheDocument()
  })

  test('full tables show a Full badge and no Take a Seat button', async () => {
    await setup()

    const full = cardOf('Dead Mans Hand')
    expect(within(full).getByText('Full')).toBeInTheDocument()
    expect(within(full).queryByRole('button', { name: 'Take a Seat' })).not.toBeInTheDocument()
    // ...but spectating is still allowed
    expect(within(full).getByRole('button', { name: /👁 Watch/ })).toBeInTheDocument()
  })

  test('waiting tables show a Waiting badge', async () => {
    await setup()

    expect(within(cardOf('Parlor No. 7')).getByText('Waiting')).toBeInTheDocument()
  })

  test('every open table has Take a Seat and every table has Watch', async () => {
    await setup()

    expect(screen.getAllByRole('button', { name: 'Take a Seat' })).toHaveLength(4)
    expect(screen.getAllByRole('button', { name: /👁 Watch/ })).toHaveLength(5)
  })

  test('shows an empty lobby when there are no tables', async () => {
    await setup({ tables: [] })

    expect(screen.getByText('0 tables with open seats')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Take a Seat' })).not.toBeInTheDocument()
  })

  test('logs an error and stays empty when the table list fails to load', async () => {
    authClient.useSession.mockReturnValue({ data: null })
    getGuest.mockReturnValue(null)
    installFetch({ overrides: { 'GET /api/tables': () => Promise.reject(new Error('down')) } })

    render(<Lobby onBack={jest.fn()} onJoin={jest.fn()} onSpectate={jest.fn()} onSignUp={jest.fn()} />)

    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('Failed to load tables', expect.any(Error))
    )
    expect(screen.getByText('0 tables with open seats')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------
// Filters
// ---------------------------------------------------------------

describe('Lobby: stakes filters', () => {
  test('Low Stakes shows only low tables', async () => {
    const { user } = await setup()

    await user.click(screen.getByRole('button', { name: 'Low Stakes' }))

    expect(screen.getByRole('heading', { name: 'Velvet Room' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Parlor No. 7' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'The Boneyard' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Crimson Lounge' })).not.toBeInTheDocument()
  })

  test('Mid Stakes shows only medium tables', async () => {
    const { user } = await setup()

    await user.click(screen.getByRole('button', { name: 'Mid Stakes' }))

    expect(screen.getByRole('heading', { name: 'The Boneyard' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dead Mans Hand' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Velvet Room' })).not.toBeInTheDocument()
  })

  test('High Stakes shows only high tables', async () => {
    const { user } = await setup()

    await user.click(screen.getByRole('button', { name: 'High Stakes' }))

    expect(screen.getByRole('heading', { name: 'Crimson Lounge' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Velvet Room' })).not.toBeInTheDocument()
  })

  test('All Tables brings every table back', async () => {
    const { user } = await setup()

    await user.click(screen.getByRole('button', { name: 'High Stakes' }))
    await user.click(screen.getByRole('button', { name: 'All Tables' }))

    for (const table of TABLES) {
      expect(screen.getByRole('heading', { name: table.name })).toBeInTheDocument()
    }
  })
})

// ---------------------------------------------------------------
// Joining, spectating, invite codes
// ---------------------------------------------------------------

describe('Lobby: take a seat', () => {
  test('asks the server for a seat, updates the card and calls onJoin', async () => {
    const { user, onJoin } = await setup()
    const updated = { ...TABLES[0], players: 5 }
    joinTable.mockResolvedValue(updated)

    await user.click(takeSeatIn('Velvet Room'))

    expect(joinTable).toHaveBeenCalledWith('1')
    expect(await screen.findByText('5/6 seated · avg pot $18')).toBeInTheDocument()
    expect(onJoin).toHaveBeenCalledWith(updated)
  })

  test('alerts with the server message when joining fails', async () => {
    const { user, onJoin } = await setup()
    joinTable.mockRejectedValue(new Error('Table is full'))

    await user.click(takeSeatIn('Velvet Room'))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Table is full'))
    expect(onJoin).not.toHaveBeenCalled()
  })

  test('uses a generic message when the failure is not an Error', async () => {
    const { user } = await setup()
    joinTable.mockRejectedValue('nope')

    await user.click(takeSeatIn('Velvet Room'))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Could not join the table'))
  })
})

describe('Lobby: watch a table', () => {
  test('spectators are sent to onSpectate', async () => {
    const { user, onSpectate, onJoin } = await setup()
    spectateTable.mockResolvedValue({ table: TABLES[0], role: 'spectator' })

    await user.click(within(cardOf('Velvet Room')).getByRole('button', { name: /👁 Watch/ }))

    expect(spectateTable).toHaveBeenCalledWith('1')
    await waitFor(() => expect(onSpectate).toHaveBeenCalledWith(TABLES[0]))
    expect(onJoin).not.toHaveBeenCalled()
  })

  test('a player who is already seated is taken to their seat instead', async () => {
    const { user, onSpectate, onJoin } = await setup()
    spectateTable.mockResolvedValue({ table: TABLES[0], role: 'player' })

    await user.click(within(cardOf('Velvet Room')).getByRole('button', { name: /👁 Watch/ }))

    await waitFor(() => expect(onJoin).toHaveBeenCalledWith(TABLES[0]))
    expect(onSpectate).not.toHaveBeenCalled()
  })

  test('full tables can still be watched', async () => {
    const { user, onSpectate } = await setup()
    spectateTable.mockResolvedValue({ table: TABLES[3], role: 'spectator' })

    await user.click(within(cardOf('Dead Mans Hand')).getByRole('button', { name: /👁 Watch/ }))

    await waitFor(() => expect(onSpectate).toHaveBeenCalledWith(TABLES[3]))
  })

  test('alerts when watching fails', async () => {
    const { user, onSpectate } = await setup()
    spectateTable.mockRejectedValue(new Error('Table closed'))

    await user.click(within(cardOf('Velvet Room')).getByRole('button', { name: /👁 Watch/ }))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Table closed'))
    expect(onSpectate).not.toHaveBeenCalled()
  })

  test('uses a generic message when the failure is not an Error', async () => {
    const { user } = await setup()
    spectateTable.mockRejectedValue('nope')

    await user.click(within(cardOf('Velvet Room')).getByRole('button', { name: /👁 Watch/ }))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Could not watch the table'))
  })
})

describe('Lobby: join with an invite code', () => {
  const codeInput = () => screen.getByLabelText('Have an invite code?')
  const joinButton = () => screen.getByRole('button', { name: /join private table|joining/i })

  test('join button is disabled until a code is typed', async () => {
    const { user } = await setup()

    expect(joinButton()).toBeDisabled()

    await user.type(codeInput(), 'A')

    expect(joinButton()).toBeEnabled()
  })

  test('the code is upper-cased and limited to six characters', async () => {
    const { user } = await setup()

    await user.type(codeInput(), 'abcdefgh')

    expect(codeInput()).toHaveValue('ABCDEF')
  })

  test('submitting joins the table, clears the input and calls onJoin', async () => {
    const { user, onJoin } = await setup()
    joinTableByCode.mockResolvedValue(TABLES[4])

    await user.type(codeInput(), 'k7q2mx')
    await user.click(joinButton())

    expect(joinTableByCode).toHaveBeenCalledWith('K7Q2MX')
    await waitFor(() => expect(onJoin).toHaveBeenCalledWith(TABLES[4]))
    expect(codeInput()).toHaveValue('')
  })

  test('alerts and keeps the code when the join fails', async () => {
    const { user, onJoin } = await setup()
    joinTableByCode.mockRejectedValue(new Error('Invalid invite code'))

    await user.type(codeInput(), 'bad123')
    await user.click(joinButton())

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Invalid invite code'))
    expect(onJoin).not.toHaveBeenCalled()
    expect(codeInput()).toHaveValue('BAD123')
  })

  test('uses a generic message when the failure is not an Error', async () => {
    const { user } = await setup()
    joinTableByCode.mockRejectedValue('nope')

    await user.type(codeInput(), 'bad123')
    await user.click(joinButton())

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Could not join the table'))
  })

  test('shows "Joining" while pending and blocks other joins meanwhile', async () => {
    const { user, onJoin } = await setup()
    let resolveJoin
    joinTableByCode.mockReturnValue(new Promise(resolve => { resolveJoin = resolve }))

    await user.type(codeInput(), 'k7q2mx')
    await user.click(joinButton())

    expect(await screen.findByRole('button', { name: 'Joining' })).toBeDisabled()

    // A second join attempt while the first is pending is ignored
    await user.click(takeSeatIn('Velvet Room'))
    expect(joinTable).not.toHaveBeenCalled()

    await act(async () => resolveJoin(TABLES[4]))
    await waitFor(() => expect(onJoin).toHaveBeenCalledWith(TABLES[4]))
  })
})

// ---------------------------------------------------------------
// Create
// ---------------------------------------------------------------

describe('Lobby: create a table', () => {
  const NEW_TABLE = {
    id: 'new1', name: 'Midnight Draw', stakes: 'low', blind: '1 / 2',
    players: 1, max: 6, status: 'waiting', avgPot: '—', hands: 0, isPrivate: false,
  }

  const openCreateModal = async user => {
    await user.click(screen.getByRole('button', { name: 'Create Table' }))
    return screen.findByRole('heading', { name: 'Create your table' })
  }

  const submitCreate = user =>
    user.click(screen.getByRole('button', { name: /create & take a seat/i }))

  test('the Create Table button opens the creation modal', async () => {
    const { user } = await setup()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await openCreateModal(user)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  test('closing the modal removes it without creating anything', async () => {
    const { user } = await setup()
    await openCreateModal(user)

    await user.click(screen.getByRole('button', { name: /close table setup/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(callFor(`POST ${CREATE_URL}`)).toBeUndefined()
  })

  test('posts the form to the API with credentials', async () => {
    const { user } = await setup({
      overrides: { [`POST ${CREATE_URL}`]: () => jsonResponse({ table: NEW_TABLE }) },
    })
    await openCreateModal(user)

    await submitCreate(user)

    await waitFor(() => expect(callFor(`POST ${CREATE_URL}`)).toBeDefined())
    const [, options] = callFor(`POST ${CREATE_URL}`)
    expect(options.credentials).toBe('include')
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(options.body)).toEqual(
      expect.objectContaining({ name: 'Midnight Draw', stakes: 'low', seats: 6, isPrivate: false })
    )
  })

  test('a public table is added to the list, the modal closes and onJoin is called', async () => {
    const { user, onJoin } = await setup({
      overrides: { [`POST ${CREATE_URL}`]: () => jsonResponse({ table: NEW_TABLE }) },
    })
    await openCreateModal(user)

    await submitCreate(user)

    expect(await screen.findByRole('heading', { name: 'Midnight Draw' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onJoin).toHaveBeenCalledWith(NEW_TABLE)
  })

  test('a private table skips the public list but appears under My Tables', async () => {
    const privateTable = { ...NEW_TABLE, id: 'new2', name: 'Secret Room', isPrivate: true, inviteCode: 'ZZZ999' }
    const { user, onJoin } = await setup({
      session: SESSION,
      mine: [],
      overrides: { [`POST ${CREATE_URL}`]: () => jsonResponse({ table: privateTable }) },
    })
    await openCreateModal(user)
    await user.click(screen.getByRole('switch', { name: /make table private/i }))

    await submitCreate(user)

    expect(await screen.findByText('1 Hosted')).toBeInTheDocument()
    // Only one card: My Tables. The public list does not show private tables.
    expect(screen.getAllByRole('heading', { name: 'Secret Room' })).toHaveLength(1)
    expect(screen.getByText('Code: ZZZ999')).toBeInTheDocument()
    expect(onJoin).toHaveBeenCalledWith(privateTable)
  })

  test('shows the server error and keeps the modal open', async () => {
    const { user, onJoin } = await setup({
      overrides: {
        [`POST ${CREATE_URL}`]: () => jsonResponse({ error: 'Unauthorized' }, { ok: false, status: 401 }),
      },
    })
    await openCreateModal(user)

    await submitCreate(user)

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Unauthorized'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(onJoin).not.toHaveBeenCalled()
  })

  test('falls back to a generic message when the error has no text', async () => {
    const { user } = await setup({
      overrides: { [`POST ${CREATE_URL}`]: () => jsonResponse({}, { ok: false, status: 500 }) },
    })
    await openCreateModal(user)

    await submitCreate(user)

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to create table'))
  })

  test('alerts when the server cannot be reached', async () => {
    const { user, onJoin } = await setup({
      overrides: { [`POST ${CREATE_URL}`]: () => Promise.reject(new Error('network')) },
    })
    await openCreateModal(user)

    await submitCreate(user)

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Could not reach the server'))
    expect(onJoin).not.toHaveBeenCalled()
  })

  test.todo('create posts "bots" as a number (the backend reads req.body.bots, but the form sends Bots/botCount)')
})

// ---------------------------------------------------------------
// My Tables (hosted)
// ---------------------------------------------------------------

describe('Lobby: my tables', () => {
  test('signed-in users get their hosted tables from the API', async () => {
    await setup({ session: SESSION, mine: [HOSTED], tables: TABLES })

    expect(global.fetch).toHaveBeenCalledWith('/api/tables/mine', { credentials: 'include' })
    expect(screen.getByRole('heading', { name: /my tables/i })).toBeInTheDocument()
    expect(screen.getByText('1 Hosted')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'My Hosted Table' })).toBeInTheDocument()
    expect(screen.getByText('★ Host')).toBeInTheDocument()
  })

  test('guests do not request or see hosted tables', async () => {
    await setup({ session: null, mine: [HOSTED] })

    expect(callFor('GET /api/tables/mine')).toBeUndefined()
    expect(screen.queryByRole('heading', { name: /my tables/i })).not.toBeInTheDocument()
  })

  test('the My Tables section is hidden when the user hosts nothing', async () => {
    await setup({ session: SESSION, mine: [] })

    await waitFor(() => expect(callFor('GET /api/tables/mine')).toBeDefined())
    expect(screen.queryByRole('heading', { name: /my tables/i })).not.toBeInTheDocument()
  })

  test('private hosted tables show their invite code, public ones do not', async () => {
    await setup({ session: SESSION, mine: [HOSTED_PRIVATE, HOSTED] })

    expect(screen.getByText('Code: K7Q2MX')).toBeInTheDocument()
    expect(screen.getAllByText(/^Code:/)).toHaveLength(1)
  })

  test('logs an error and hides the section when hosted tables fail to load', async () => {
    authClient.useSession.mockReturnValue({ data: SESSION })
    getGuest.mockReturnValue(null)
    installFetch({
      overrides: { 'GET /api/tables/mine': () => jsonResponse({}, { ok: false, status: 500 }) },
    })

    render(<Lobby onBack={jest.fn()} onJoin={jest.fn()} onSpectate={jest.fn()} onSignUp={jest.fn()} />)

    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith('Failed to load my tables', expect.any(Error))
    )
    expect(screen.queryByRole('heading', { name: /my tables/i })).not.toBeInTheDocument()
  })

  test('Take a Seat works from a hosted table card', async () => {
    const { user, onJoin } = await setup({ session: SESSION, mine: [HOSTED], tables: TABLES })
    joinTable.mockResolvedValue({ ...HOSTED, players: 4 })

    await user.click(takeSeatIn('My Hosted Table'))

    expect(joinTable).toHaveBeenCalledWith('m1')
    await waitFor(() => expect(onJoin).toHaveBeenCalledWith({ ...HOSTED, players: 4 }))
  })
})

// ---------------------------------------------------------------
// Delete
// ---------------------------------------------------------------

describe('Lobby: delete a hosted table', () => {
  // HOSTED appears in both My Tables and the public list
  const withHosted = overrides => ({
    session: SESSION,
    mine: [HOSTED],
    tables: [...TABLES, HOSTED],
    overrides,
  })

  const clickDelete = user =>
    user.click(within(cardOf('My Hosted Table')).getByRole('button', { name: 'Delete' }))

  test('confirming deletes the table from both lists', async () => {
    const { user } = await setup(
      withHosted({ 'DELETE /api/tables/m1': () => jsonResponse({ message: 'Table deleted successfully' }) })
    )
    expect(screen.getAllByRole('heading', { name: 'My Hosted Table' })).toHaveLength(2)

    await clickDelete(user)

    await waitFor(() =>
      expect(screen.queryAllByRole('heading', { name: 'My Hosted Table' })).toHaveLength(0)
    )
    expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this table?')
    const [, options] = callFor('DELETE /api/tables/m1')
    expect(options).toEqual({ method: 'DELETE', credentials: 'include' })
  })

  test('cancelling the confirmation keeps the table and sends nothing', async () => {
    window.confirm.mockReturnValue(false)
    const { user } = await setup(withHosted())

    await clickDelete(user)

    expect(callFor('DELETE /api/tables/m1')).toBeUndefined()
    expect(screen.getAllByRole('heading', { name: 'My Hosted Table' })).toHaveLength(2)
  })

  test('shows the server error and keeps the table', async () => {
    const { user } = await setup(
      withHosted({
        'DELETE /api/tables/m1': () =>
          jsonResponse({ error: 'You can only delete tables you host' }, { ok: false, status: 403 }),
      })
    )

    await clickDelete(user)

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith('You can only delete tables you host')
    )
    expect(screen.getAllByRole('heading', { name: 'My Hosted Table' })).toHaveLength(2)
  })

  test('falls back to a generic message when the error has no text', async () => {
    const { user } = await setup(
      withHosted({ 'DELETE /api/tables/m1': () => jsonResponse({}, { ok: false, status: 500 }) })
    )

    await clickDelete(user)

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to delete table'))
  })

  test('alerts when the server cannot be reached', async () => {
    const { user } = await setup(
      withHosted({ 'DELETE /api/tables/m1': () => Promise.reject(new Error('network')) })
    )

    await clickDelete(user)

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Could not reach the server'))
    expect(console.error).toHaveBeenCalledWith('Failed to delete table:', expect.any(Error))
    expect(screen.getAllByRole('heading', { name: 'My Hosted Table' })).toHaveLength(2)
  })
})

// ---------------------------------------------------------------
// Edit
// ---------------------------------------------------------------

describe('Lobby: edit a hosted table', () => {
  const PUT_KEY = 'PUT /api/tables/m1'

  const withHosted = (overrides, hosted = HOSTED) => ({
    session: SESSION,
    mine: [hosted],
    tables: [...TABLES, hosted],
    overrides,
  })

  const openEdit = async user => {
    await user.click(within(cardOf('My Hosted Table')).getByRole('button', { name: /edit table/i }))
    return screen.findByRole('heading', { name: 'Update your table' })
  }

  test('Edit Table opens the modal pre-filled with the table', async () => {
    const { user } = await setup(withHosted())

    await openEdit(user)

    expect(screen.getByLabelText(/table name/i)).toHaveValue('My Hosted Table')
    expect(screen.getByLabelText('Seats')).toHaveValue('4')
    expect(screen.getByRole('button', { name: 'Update Table' })).toBeInTheDocument()
  })

  test('saving sends the changes with the right field names and updates both lists', async () => {
    const renamed = { ...HOSTED, name: 'Renamed Table' }
    const { user } = await setup(withHosted({ [PUT_KEY]: () => jsonResponse({ table: renamed }) }))
    await openEdit(user)

    await user.clear(screen.getByLabelText(/table name/i))
    await user.type(screen.getByLabelText(/table name/i), 'Renamed Table')
    await user.click(screen.getByRole('button', { name: 'Update Table' }))

    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: 'Renamed Table' })).toHaveLength(2)
    )
    expect(screen.queryByRole('heading', { name: 'Update your table' })).not.toBeInTheDocument()

    const [, options] = callFor(PUT_KEY)
    expect(options.credentials).toBe('include')
    expect(JSON.parse(options.body)).toEqual({
      name: 'Renamed Table',
      stakes: 'medium',
      max: 4,
      isPrivate: false,
      bots: 2,
    })
  })

  test('a table with no bots is saved with bots: 0', async () => {
    const noBots = { ...HOSTED, bots: 0 }
    const { user } = await setup(withHosted({ [PUT_KEY]: () => jsonResponse({ table: noBots }) }, noBots))
    await openEdit(user)

    await user.click(screen.getByRole('button', { name: 'Update Table' }))

    await waitFor(() => expect(callFor(PUT_KEY)).toBeDefined())
    expect(JSON.parse(callFor(PUT_KEY)[1].body)).toEqual(expect.objectContaining({ bots: 0 }))
  })

  test('making a table private removes it from the public list but keeps it in My Tables', async () => {
    const nowPrivate = { ...HOSTED, isPrivate: true, inviteCode: 'NEW123' }
    const { user } = await setup(withHosted({ [PUT_KEY]: () => jsonResponse({ table: nowPrivate }) }))
    await openEdit(user)

    await user.click(screen.getByRole('switch', { name: /make table private/i }))
    await user.click(screen.getByRole('button', { name: 'Update Table' }))

    await waitFor(() =>
      expect(screen.getAllByRole('heading', { name: 'My Hosted Table' })).toHaveLength(1)
    )
    expect(JSON.parse(callFor(PUT_KEY)[1].body)).toEqual(expect.objectContaining({ isPrivate: true }))
    expect(screen.getByText('Code: NEW123')).toBeInTheDocument()
  })

  test('shows the server error and keeps the modal open', async () => {
    const { user } = await setup(
      withHosted({
        [PUT_KEY]: () => jsonResponse({ error: 'Invalid table settings' }, { ok: false, status: 400 }),
      })
    )
    await openEdit(user)

    await user.click(screen.getByRole('button', { name: 'Update Table' }))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Invalid table settings'))
    expect(screen.getByRole('heading', { name: 'Update your table' })).toBeInTheDocument()
  })

  test('falls back to a generic message when the error has no text', async () => {
    const { user } = await setup(
      withHosted({ [PUT_KEY]: () => jsonResponse({}, { ok: false, status: 500 }) })
    )
    await openEdit(user)

    await user.click(screen.getByRole('button', { name: 'Update Table' }))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to update table'))
  })

  test('alerts when the server cannot be reached', async () => {
    const { user } = await setup(
      withHosted({ [PUT_KEY]: () => Promise.reject(new Error('network')) })
    )
    await openEdit(user)

    await user.click(screen.getByRole('button', { name: 'Update Table' }))

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Could not reach the server'))
    expect(console.error).toHaveBeenCalledWith('Failed to update table:', expect.any(Error))
  })

  test('closing the edit modal leaves the table unchanged', async () => {
    const { user } = await setup(withHosted())
    await openEdit(user)

    await user.click(screen.getByRole('button', { name: /close table setup/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(callFor(PUT_KEY)).toBeUndefined()
  })
})

// ---------------------------------------------------------------
// Header: guest, signed-in user, navigation, audio
// ---------------------------------------------------------------

describe('Lobby: header', () => {
  test('Back calls onBack', async () => {
    const { user, onBack } = await setup()

    await user.click(screen.getByRole('button', { name: /back/i }))

    expect(onBack).toHaveBeenCalledTimes(1)
  })

  test('guests without a saved profile see the default chip balance', async () => {
    await setup({ guest: null })

    expect(screen.getByText('Guest · $500 chips')).toBeInTheDocument()
  })

  test('guests with a saved profile see their name and chips', async () => {
    await setup({ guest: { id: 'guest-9', displayName: 'Guest42', chipamount: 750 } })

    expect(screen.getByText('Guest42 · $750 chips')).toBeInTheDocument()
  })

  test('Sign Up to Save calls onSignUp', async () => {
    const { user, onSignUp } = await setup()

    await user.click(screen.getByRole('button', { name: 'Sign Up to Save' }))

    expect(onSignUp).toHaveBeenCalledTimes(1)
  })

  test('signed-in users see their name and chips instead of the guest badge', async () => {
    await setup({ session: SESSION })

    expect(screen.getByRole('button', { name: /jane doe/i })).toBeInTheDocument()
    expect(screen.getByText('🪙 500 Chips')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign Up to Save' })).not.toBeInTheDocument()
  })

  test('the profile menu opens and closes', async () => {
    const { user } = await setup({ session: SESSION })
    const profile = screen.getByRole('button', { name: /jane doe/i })

    expect(profile).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    await user.click(profile)
    expect(profile).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()

    await user.click(profile)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  test('signing out calls the auth client, closes the menu and goes back', async () => {
    const { user, onBack } = await setup({ session: SESSION })

    await user.click(screen.getByRole('button', { name: /jane doe/i }))
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }))

    expect(authClient.signOut).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  test('a sign-out error is logged and the user stays on the lobby', async () => {
    const error = { message: 'session expired' }
    authClient.signOut.mockResolvedValue({ error })
    const { user, onBack } = await setup({ session: SESSION })

    await user.click(screen.getByRole('button', { name: /jane doe/i }))
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }))

    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Sign out failed:', error))
    expect(onBack).not.toHaveBeenCalled()
  })

  test('a sign-out exception is logged and the user stays on the lobby', async () => {
    const failure = new Error('network')
    authClient.signOut.mockRejectedValue(failure)
    const { user, onBack } = await setup({ session: SESSION })

    await user.click(screen.getByRole('button', { name: /jane doe/i }))
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }))

    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Sign out failed:', failure))
    expect(onBack).not.toHaveBeenCalled()
  })

  test('the audio dropdown toggles and receives the user id', async () => {
    const { user } = await setup({ session: SESSION })
    const audio = screen.getByRole('button', { name: /audio/i })

    expect(audio).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('audio-settings')).not.toBeInTheDocument()

    await user.click(audio)
    expect(audio).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('audio-settings')).toHaveTextContent('user:user-1')

    await user.click(audio)
    expect(screen.queryByTestId('audio-settings')).not.toBeInTheDocument()
  })

  test('guests get an empty user id in the audio settings', async () => {
    const { user } = await setup()

    await user.click(screen.getByRole('button', { name: /audio/i }))

    expect(screen.getByTestId('audio-settings')).toHaveTextContent('user:')
    expect(screen.getByTestId('audio-settings')).not.toHaveTextContent('user:user')
  })
})

// ---------------------------------------------------------------
// Complaint form, ad slots
// ---------------------------------------------------------------

describe('Lobby: report a player', () => {
  test('uses the signed-in user id as the reporter', async () => {
    await setup({ session: SESSION })

    expect(screen.getByRole('heading', { name: 'Report a player' })).toBeInTheDocument()
    expect(screen.getByTestId('complaint-form')).toHaveTextContent('reporter:user-1')
  })

  test('uses the guest id when not signed in', async () => {
    await setup({ guest: { id: 'guest-9', displayName: 'Guest42', chipamount: 500 } })

    expect(screen.getByTestId('complaint-form')).toHaveTextContent('reporter:guest-9')
  })

  test('uses an empty reporter id when there is no session and no guest', async () => {
    await setup()

    expect(screen.getByTestId('complaint-form')).toHaveTextContent(/^reporter:$/)
  })
})

describe('Lobby: ad slots', () => {
  test('watching an ad shows progress and then confirms the chips', async () => {
    await setup()
    const watchButtons = screen.getAllByRole('button', { name: /watch ad/i })
    expect(watchButtons).toHaveLength(3)

    jest.useFakeTimers()
    fireEvent.click(watchButtons[0])

    expect(screen.getByRole('button', { name: /playing ad/i })).toBeDisabled()

    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(screen.getByText('✓ Chips added to your stack!')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /watch ad/i })).toHaveLength(2)
  })
})