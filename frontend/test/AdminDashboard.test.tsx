/**
@jest-environment jsdom
/
import '@testing-library/jest-dom'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminDashboard } from '../src/views/AdminDashboard.tsx'
// ---------------------------------------------------------------
// The dashboard only talks to the server through fetch, so these tests
// replace fetch with a fake. No network, no other modules to mock.
// ---------------------------------------------------------------
function reply(body, { ok = true, status = 200 } = {}) {
return { ok, status, json: async () => body }
}
// lists: what each section's GET returns. mutate: what PATCH / DELETE / logout return.
function setupFetch(lists = {}, mutate = () => reply({})) {
global.fetch = jest.fn((url, options = {}) => {
if (options.method) return Promise.resolve(mutate(url, options))
const section = String(url).split('?')[0].replace('/api/', '')
const body = lists[section] ?? { docs: [], totalDocs: 0 }
return Promise.resolve(typeof body === 'function' ? body() : reply(body))
})
}
function renderDashboard() {
const onLeave = jest.fn()
const onSessionExpired = jest.fn()
render(<AdminDashboard onLeave={onLeave} onSessionExpired={onSessionExpired} />)
return { onLeave, onSessionExpired }
}
const callsTo = (prefix) => global.fetch.mock.calls.filter(([url]) => String(url).startsWith(prefix))
const MARA = { id: 'u1', displayName: 'Mara', username: 'mara', email: 'mara@x.com', chips: 500, wins: 3, status: 'active' }
// Opens the Users tab with one player and waits for the row to show
async function openUsers(users = [MARA], mutate) {
setupFetch({ users: { docs: users, totalDocs: users.length } }, mutate)
const handlers = renderDashboard()
await userEvent.click(screen.getByRole('button', { name: /Player accounts, balances, and status/ }))
await screen.findByText(users[0].displayName ?? users[0].name ?? users[0].email)
return handlers
}
afterEach(() => {
jest.clearAllMocks()
})
describe('AdminDashboard: loading records', () => {
test('starts on the Ads section and asks the server for ads', async () => {
setupFetch()
renderDashboard()
await waitFor(() => expect(global.fetch).toHaveBeenCalled())
expect(global.fetch).toHaveBeenCalledWith(
'/api/ads?limit=50&sort=-updatedAt',
expect.objectContaining({ credentials: 'include' })
)
expect(screen.getByRole('heading', { level: 1, name: 'Ads' })).toBeInTheDocument()
})
test('shows a loading message while waiting', () => {
global.fetch = jest.fn(() => new Promise(() => {})) // never answers
renderDashboard()
expect(screen.getByText('Loading secure records…')).toBeInTheDocument()
})
test('lists the records that come back', async () => {
setupFetch({
ads: { docs: [{ id: 1, name: 'Welcome Bonus', placement: 'Lobby', rewardChips: 25 }], totalDocs: 1 },
})
renderDashboard()
expect(await screen.findByText('Welcome Bonus')).toBeInTheDocument()
expect(screen.getByText('Lobby · 25 reward chips')).toBeInTheDocument()
})
test('shows the total number of records and the active section', async () => {
setupFetch({ ads: { docs: [{ id: 1, name: 'A' }], totalDocs: 7 } })
renderDashboard()
await screen.findByText('A')
expect(screen.getByText('Records').nextSibling).toHaveTextContent('7')
expect(screen.getByText('Active section').nextSibling).toHaveTextContent('Ads')
})
test('shows an empty message when there are no records', async () => {
setupFetch()
renderDashboard()
expect(await screen.findByText('No ads found')).toBeInTheDocument()
expect(screen.getByText('Records created in Payload will appear here.')).toBeInTheDocument()
})
test('shows a friendly error when the server fails', async () => {
global.fetch = jest.fn(() => Promise.resolve(reply({}, { ok: false, status: 500 })))
renderDashboard()
expect(await screen.findByText('This section could not be loaded. Please try again.')).toBeInTheDocument()
})
test('shows the same error when the network is down', async () => {
global.fetch = jest.fn(() => Promise.reject(new Error('offline')))
renderDashboard()
expect(await screen.findByText('This section could not be loaded. Please try again.')).toBeInTheDocument()
})
test('an aborted request is not reported as an error', async () => {
const abort = new Error('aborted')
abort.name = 'AbortError'
global.fetch = jest.fn(() => Promise.reject(abort))
renderDashboard()
expect(await screen.findByText('No ads found')).toBeInTheDocument()
expect(screen.queryByText('This section could not be loaded. Please try again.')).not.toBeInTheDocument()
})
test.each([401, 403])('a %i response sends the admin back to sign in', async (status) => {
global.fetch = jest.fn(() => Promise.resolve(reply({}, { ok: false, status })))
const { onSessionExpired } = renderDashboard()
await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1))
})
})
describe('AdminDashboard: record text', () => {
test('a record without a name falls back to display name, then email, then "Untitled record"', async () => {
setupFetch({
ads: {
docs: [{ id: 1, displayName: 'By Display Name' }, { id: 2, email: 'only@email.com' }, { id: 3 }],
totalDocs: 3,
},
})
renderDashboard()
expect(await screen.findByText('By Display Name')).toBeInTheDocument()
expect(screen.getByText('only@email.com')).toBeInTheDocument()
expect(screen.getByText('Untitled record')).toBeInTheDocument()
})
test('ads use sensible defaults for missing details', async () => {
setupFetch({ ads: { docs: [{ id: 1, name: 'Promo' }], totalDocs: 1 } })
renderDashboard()
expect(await screen.findByText('No placement · 0 reward chips')).toBeInTheDocument()
})
test('users show email, chips and wins', async () => {
await openUsers()
expect(screen.getByText('mara@x.com · 500 chips · 3 wins')).toBeInTheDocument()
})
test('users use sensible defaults for missing details', async () => {
await openUsers([{ id: 'u2', displayName: 'New Player' }])
expect(screen.getByText('No email · 0 chips · 0 wins')).toBeInTheDocument()
})
test('tables show stakes, seated players and average pot', async () => {
setupFetch({
'poker-tables': {
docs: [{ id: 't1', name: 'High Roller', stakes: 'high', playerCount: 3, seats: 6, averagePot: '$120' }],
totalDocs: 1,
},
})
renderDashboard()
await userEvent.click(screen.getByRole('button', { name: /Stakes, seats, bots, and availability/ }))
expect(await screen.findByText('high stakes · 3/6 players seated · avg pot $120')).toBeInTheDocument()
})
test('tables show a dash when there is no average pot', async () => {
setupFetch({ 'poker-tables': { docs: [{ id: 't1', name: 'Quiet', stakes: 'low', playerCount: 0, seats: 4 }], totalDocs: 1 } })
renderDashboard()
await userEvent.click(screen.getByRole('button', { name: /Stakes, seats, bots, and availability/ }))
expect(await screen.findByText('low stakes · 0/4 players seated · avg pot —')).toBeInTheDocument()
})
test('a record with no status is labelled Configured, a banned one is labelled banned', async () => {
setupFetch({
users: { docs: [{ id: 'a', displayName: 'Fine' }, { id: 'b', displayName: 'Blocked', status: 'banned' }], totalDocs: 2 },
})
renderDashboard()
await userEvent.click(screen.getByRole('button', { name: /Player accounts, balances, and status/ }))
await screen.findByText('Blocked')
expect(screen.getByText('Configured')).toBeInTheDocument()
expect(screen.getByText('banned')).toBeInTheDocument()
})
})
describe('AdminDashboard: switching sections', () => {
test('clicking Users loads users and updates the heading', async () => {
await openUsers()
expect(callsTo('/api/users?limit=50&sort=-updatedAt')).toHaveLength(1)
expect(screen.getByRole('heading', { level: 1, name: 'Users' })).toBeInTheDocument()
})
test('clicking Tables loads poker tables', async () => {
setupFetch()
renderDashboard()
await userEvent.click(screen.getByRole('button', { name: /Stakes, seats, bots, and availability/ }))
await waitFor(() => expect(callsTo('/api/poker-tables?limit=50&sort=-updatedAt')).toHaveLength(1))
expect(screen.getByRole('heading', { level: 1, name: 'Tables' })).toBeInTheDocument()
})
test('the search box is cleared when you change section', async () => {
setupFetch({ ads: { docs: [{ id: 1, name: 'Promo' }], totalDocs: 1 } })
renderDashboard()
await screen.findByText('Promo')
await userEvent.type(screen.getByPlaceholderText('Search ads'), 'zzz')
await userEvent.click(screen.getByRole('button', { name: /Player accounts, balances, and status/ }))
expect(screen.getByPlaceholderText('Search users')).toHaveValue('')
})
test('only the Users section has Edit, Ban and Delete buttons', async () => {
setupFetch({ ads: { docs: [{ id: 1, name: 'Promo' }], totalDocs: 1 } })
renderDashboard()
await screen.findByText('Promo')
expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
expect(screen.queryByRole('button', { name: 'Ban' })).not.toBeInTheDocument()
expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
})
})
describe('AdminDashboard: search', () => {
const ads = { docs: [{ id: 1, name: 'Welcome Bonus' }, { id: 2, name: 'Lobby Banner' }], totalDocs: 2 }
test('filters the list by name, ignoring upper and lower case', async () => {
setupFetch({ ads })
renderDashboard()
await screen.findByText('Welcome Bonus')
await userEvent.type(screen.getByPlaceholderText('Search ads'), 'LOBBY')
expect(screen.getByText('Lobby Banner')).toBeInTheDocument()
expect(screen.queryByText('Welcome Bonus')).not.toBeInTheDocument()
})
test('ignores spaces around the search words', async () => {
setupFetch({ ads })
renderDashboard()
await screen.findByText('Welcome Bonus')
await userEvent.type(screen.getByPlaceholderText('Search ads'), ' lobby ')
expect(screen.getByText('Lobby Banner')).toBeInTheDocument()
})
test('says so when nothing matches', async () => {
setupFetch({ ads })
renderDashboard()
await screen.findByText('Welcome Bonus')
await userEvent.type(screen.getByPlaceholderText('Search ads'), 'nothing like this')
expect(screen.getByText('No ads found')).toBeInTheDocument()
expect(screen.getByText('Try a different search.')).toBeInTheDocument()
})
})
describe('AdminDashboard: ban and unban', () => {
test('Ban sends status banned for an active player and reloads the list', async () => {
await openUsers()
await userEvent.click(screen.getByRole('button', { name: 'Ban' }))
await waitFor(() =>
expect(global.fetch).toHaveBeenCalledWith(
'/api/admin/players/u1',
expect.objectContaining({ method: 'PATCH', credentials: 'include', body: JSON.stringify({ status: 'banned' }) })
)
)
await waitFor(() => expect(callsTo('/api/users?')).toHaveLength(2))
})
test('a banned player shows Unban, which sends status active', async () => {
await openUsers([{ ...MARA, status: 'banned' }])
await userEvent.click(screen.getByRole('button', { name: 'Unban' }))
await waitFor(() =>
expect(global.fetch).toHaveBeenCalledWith(
'/api/admin/players/u1',
expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'active' }) })
)
)
})
test('shows the servers message when the update fails', async () => {
await openUsers([MARA], () => reply({ errors: [{ message: 'Cannot ban an admin' }] }, { ok: false, status: 400 }))
await userEvent.click(screen.getByRole('button', { name: 'Ban' }))
expect(await screen.findByText('Cannot ban an admin')).toBeInTheDocument()
})
test('shows a general message when the failure has no details', async () => {
await openUsers([MARA], () => ({ ok: false, status: 500, json: async () => { throw new Error('not json') } }))
await userEvent.click(screen.getByRole('button', { name: 'Ban' }))
expect(await screen.findByText('The player could not be updated.')).toBeInTheDocument()
})
test('an expired session during an update sends the admin back to sign in', async () => {
const { onSessionExpired } = await openUsers([MARA], () => reply({}, { ok: false, status: 401 }))
await userEvent.click(screen.getByRole('button', { name: 'Ban' }))
await waitFor(() => expect(onSessionExpired).toHaveBeenCalled())
})
})
describe('AdminDashboard: editing a player', () => {
async function openEditor(mutate) {
const handlers = await openUsers([MARA], mutate)
await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
return handlers
}
test('opens a dialog filled with the players current chips', async () => {
await openEditor()
expect(screen.getByRole('dialog')).toBeInTheDocument()
expect(screen.getByRole('heading', { name: 'Edit Mara' })).toBeInTheDocument()
expect(screen.getByLabelText('Chip balance')).toHaveValue(500)
expect(screen.getByLabelText('New password')).toHaveValue('')
})
test.each([
[{ id: 'u8', displayName: 'Shown', username: 'nick', status: 'active' }, 'Shown', 'Edit Shown'],
[{ id: 'u9', name: 'Only Name', username: 'nick', status: 'active' }, 'Only Name', 'Edit nick'],
[{ id: 'u7', name: 'Nameless', status: 'active' }, 'Nameless', 'Edit player'],
])('the heading uses the display name, then the username (%#)', async (user, listed, heading) => {
await openUsers([user])
await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
})
test('Cancel and Close both shut the dialog without saving', async () => {
await openEditor()
await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
await userEvent.click(screen.getByRole('button', { name: 'Close player editor' }))
expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
expect(callsTo('/api/admin/players')).toHaveLength(0)
})
test('saves the new chip balance (rounded down) and closes', async () => {
await openEditor()
fireEvent.change(screen.getByLabelText('Chip balance'), { target: { value: '750.9' } })
await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
await waitFor(() =>
expect(global.fetch).toHaveBeenCalledWith(
'/api/admin/players/u1',
expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ chips: 750 }) })
)
)
await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})
test('sends a new password only when one is typed', async () => {
await openEditor()
await userEvent.type(screen.getByLabelText('New password'), 'n3w-secret')
await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
await waitFor(() =>
expect(global.fetch).toHaveBeenCalledWith(
'/api/admin/players/u1',
expect.objectContaining({ body: JSON.stringify({ chips: 500, password: 'n3w-secret' }) })
)
)
})
test.each(['-5', '-0.5'])('rejects a negative chip balance (%p) without calling the server', async (value) => {
await openEditor()
fireEvent.change(screen.getByLabelText('Chip balance'), { target: { value } })
await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
expect((await screen.findAllByText('Chip balance must be zero or greater.')).length).toBeGreaterThan(0)
expect(callsTo('/api/admin/players')).toHaveLength(0)
expect(screen.getByRole('dialog')).toBeInTheDocument()
})
test('keeps the dialog open and shows the error when saving fails', async () => {
await openEditor(() => reply({ errors: [{ message: 'Password too short' }] }, { ok: false, status: 400 }))
await userEvent.type(screen.getByLabelText('New password'), 'x')
await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
expect((await screen.findAllByText('Password too short')).length).toBeGreaterThan(0)
expect(screen.getByRole('dialog')).toBeInTheDocument()
})
test('clears an old error when the dialog is opened again', async () => {
await openEditor(() => reply({ errors: [{ message: 'Password too short' }] }, { ok: false, status: 400 }))
await userEvent.type(screen.getByLabelText('New password'), 'x')
await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
await screen.findAllByText('Password too short')
await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
expect(screen.queryByText('Password too short')).not.toBeInTheDocument()
})
})
describe('AdminDashboard: deleting a player', () => {
async function openDeleteConfirm(mutate) {
const handlers = await openUsers([MARA], mutate)
await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
return handlers
}
test('asks for confirmation and names the player', async () => {
await openDeleteConfirm()
expect(screen.getByRole('alertdialog')).toBeInTheDocument()
expect(screen.getByText('Delete this player account?')).toBeInTheDocument()
expect(screen.getByText(/Mara will lose access permanently/)).toBeInTheDocument()
})
test('"Keep account" closes the dialog and deletes nothing', async () => {
await openDeleteConfirm()
await userEvent.click(screen.getByRole('button', { name: 'Keep account' }))
expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
expect(global.fetch.mock.calls.some(([, options]) => options?.method === 'DELETE')).toBe(false)
})
test('"Delete permanently" sends DELETE, closes and reloads the list', async () => {
await openDeleteConfirm()
await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
await waitFor(() =>
expect(global.fetch).toHaveBeenCalledWith(
'/api/admin/players/u1',
expect.objectContaining({ method: 'DELETE', credentials: 'include' })
)
)
await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
await waitFor(() => expect(callsTo('/api/users?')).toHaveLength(2))
})
test('keeps the dialog open and explains when the delete fails', async () => {
await openDeleteConfirm(() => reply({}, { ok: false, status: 500 }))
await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
expect((await screen.findAllByText('The player account could not be deleted.')).length).toBeGreaterThan(0)
expect(screen.getByRole('alertdialog')).toBeInTheDocument()
})
test('an expired session during a delete sends the admin back to sign in', async () => {
const { onSessionExpired } = await openDeleteConfirm(() => reply({}, { ok: false, status: 403 }))
await userEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
await waitFor(() => expect(onSessionExpired).toHaveBeenCalled())
})
})
describe('AdminDashboard: header buttons', () => {
test('"View public site" leaves the dashboard', async () => {
setupFetch()
const { onLeave } = renderDashboard()
await userEvent.click(screen.getByRole('button', { name: 'View public site' }))
expect(onLeave).toHaveBeenCalledTimes(1)
})
test('Sign out calls the logout endpoint, then leaves', async () => {
setupFetch()
const { onLeave } = renderDashboard()
await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1))
expect(global.fetch).toHaveBeenCalledWith(
'/api/users/logout',
expect.objectContaining({ method: 'POST', credentials: 'include' })
)
})
})
