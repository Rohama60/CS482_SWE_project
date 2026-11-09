/**
@jest-environment jsdom
*/
import '@testing-library/jest-dom'
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminUserManagement } from '../src/components/AdminUserManagement.tsx'
// ---------------------------------------------------------------
// The component only talks to the server through fetch, and uses the
// browser's confirm() and alert(), so these tests replace all three.
// ---------------------------------------------------------------
function reply(body, { ok = true, status = 200 } = {}) {
return { ok, status, json: async () => body }
}
// list: what the GET returns (array or { docs }). mutate: what PATCH / DELETE return.
function setupFetch({ list = [], mutate = () => reply({}) } = {}) {
global.fetch = jest.fn((url, options = {}) =>
Promise.resolve(options.method ? mutate(url, options) : reply(list))
)
}
const MARA = { _id: 'u1', name: 'Mara', email: 'mara@x.com', role: 'user', balance: 1500, lastActive: '2026-03-15T12:00:00Z' }
const THEO = { _id: 'u2', name: 'Theo', email: 'theo@x.com', role: 'admin', balance: 200, lastActive: '2026-03-10T12:00:00Z' }
async function renderLoaded(users = [MARA, THEO], mutate) {
setupFetch({ list: users, mutate })
render(<AdminUserManagement />)
await screen.findByText(users[0].name ?? users[0].displayName ?? users[0].username ?? 'Unnamed User')
}
const rowOf = (name) => screen.getByText(name).closest('tr')
const getCalls = () => global.fetch.mock.calls.filter(([, options]) => !options?.method)
const mutationCalls = () => global.fetch.mock.calls.filter(([, options]) => options?.method)
let confirmSpy
let alertSpy
beforeEach(() => {
confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true)
alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {})
})
afterEach(() => {
jest.restoreAllMocks()
})
describe('AdminUserManagement: loading users', () => {
test('asks the server for users on first render, newest activity first', async () => {
setupFetch()
render(<AdminUserManagement />)
await waitFor(() => expect(global.fetch).toHaveBeenCalled())
expect(global.fetch).toHaveBeenCalledWith(
'/api/admin/users?search=&sortBy=lastActive',
expect.objectContaining({ credentials: 'include' })
)
})
test('shows a loading message while waiting', () => {
global.fetch = jest.fn(() => new Promise(() => {})) // never answers
render(<AdminUserManagement />)
expect(screen.getByText('Loading user database...')).toBeInTheDocument()
})
test('lists the users and the total', async () => {
await renderLoaded()
expect(screen.getByText('Mara')).toBeInTheDocument()
expect(screen.getByText('Theo')).toBeInTheDocument()
expect(screen.getByText('Total Users: 2')).toBeInTheDocument()
})
test('accepts a plain array or an object with docs', async () => {
setupFetch({ list: { docs: [MARA] } })
render(<AdminUserManagement />)
expect(await screen.findByText('Mara')).toBeInTheDocument()
expect(screen.getByText('Total Users: 1')).toBeInTheDocument()
})
test('an object with no docs counts as no users', async () => {
setupFetch({ list: {} })
render(<AdminUserManagement />)
expect(await screen.findByText('No users found.')).toBeInTheDocument()
expect(screen.getByText('Total Users: 0')).toBeInTheDocument()
})
test('shows a message when there are no users', async () => {
setupFetch({ list: [] })
render(<AdminUserManagement />)
expect(await screen.findByText('No users found.')).toBeInTheDocument()
})
test('shows an error when the server says no', async () => {
global.fetch = jest.fn(() => Promise.resolve(reply({}, { ok: false, status: 500 })))
render(<AdminUserManagement />)
expect(await screen.findByText('Failed to retrieve user directory')).toBeInTheDocument()
})
test('shows the network error message when the request fails', async () => {
global.fetch = jest.fn(() => Promise.reject(new Error('offline')))
render(<AdminUserManagement />)
expect(await screen.findByText('offline')).toBeInTheDocument()
})
})
describe('AdminUserManagement: what each row shows', () => {
test('name, email, role, balance and last active date', async () => {
await renderLoaded()
const row = within(rowOf('Mara'))
expect(row.getByText('mara@x.com')).toBeInTheDocument()
expect(row.getByText('user')).toBeInTheDocument()
expect(row.getByText(`$${(1500).toLocaleString()}`)).toBeInTheDocument()
expect(row.getByText(new Date('2026-03-15T12:00:00Z').toLocaleDateString())).toBeInTheDocument()
})
test('an admin gets the admin role badge', async () => {
await renderLoaded()
expect(within(rowOf('Theo')).getByText('admin')).toBeInTheDocument()
})
test('the name falls back to display name, then username, then "Unnamed User"', async () => {
setupFetch({
list: [
{ _id: 'a', displayName: 'Shown Name' },
{ _id: 'b', username: 'just_a_username' },
{ _id: 'c' },
],
})
render(<AdminUserManagement />)
expect(await screen.findByText('Shown Name')).toBeInTheDocument()
expect(screen.getByText('just_a_username')).toBeInTheDocument()
expect(screen.getByText('Unnamed User')).toBeInTheDocument()
})
test('missing details get defaults: no email, role "user", balance $0, activity N/A', async () => {
await renderLoaded([{ _id: 'a', name: 'Blank' }])
const row = within(rowOf('Blank'))
expect(row.getByText('No email')).toBeInTheDocument()
expect(row.getByText('user')).toBeInTheDocument()
expect(row.getByText('$0')).toBeInTheDocument()
expect(row.getByText('N/A')).toBeInTheDocument()
})
test('uses chips when there is no balance, and updatedAt when there is no lastActive', async () => {
await renderLoaded([{ _id: 'a', name: 'Chippy', chips: 300, updatedAt: '2026-01-02T12:00:00Z' }])
const row = within(rowOf('Chippy'))
expect(row.getByText('$300')).toBeInTheDocument()
expect(row.getByText(new Date('2026-01-02T12:00:00Z').toLocaleDateString())).toBeInTheDocument()
})
test('a balance of zero is shown as $0, not skipped for chips', async () => {
await renderLoaded([{ _id: 'a', name: 'Broke', balance: 0, chips: 999 }])
expect(within(rowOf('Broke')).getByText('$0')).toBeInTheDocument()
})
})
describe('AdminUserManagement: search and sort', () => {
test('typing in the search box asks the server again with the (encoded) search', async () => {
await renderLoaded()
fireEvent.change(screen.getByPlaceholderText('Search users by name, username, or email...'), {
target: { value: 'mara & co' },
})
await waitFor(() =>
expect(global.fetch).toHaveBeenLastCalledWith(
'/api/admin/users?search=mara%20%26%20co&sortBy=lastActive',
expect.objectContaining({ credentials: 'include' })
)
)
})
test('changing the sort asks the server again with the new sort', async () => {
await renderLoaded()
await userEvent.selectOptions(screen.getByRole('combobox'), 'balance')
await waitFor(() =>
expect(global.fetch).toHaveBeenLastCalledWith(
'/api/admin/users?search=&sortBy=balance',
expect.objectContaining({ credentials: 'include' })
)
)
})
test('offers both sort choices, defaulting to last active', async () => {
await renderLoaded()
expect(screen.getByRole('combobox')).toHaveValue('lastActive')
expect(screen.getByRole('option', { name: 'Sort by Last Active' })).toBeInTheDocument()
expect(screen.getByRole('option', { name: 'Sort by Highest Balance' })).toBeInTheDocument()
})
test('shows the new results after a search', async () => {
setupFetch({ list: [MARA, THEO] })
render(<AdminUserManagement />)
await screen.findByText('Mara')
global.fetch.mockImplementation(() => Promise.resolve(reply([THEO])))
fireEvent.change(screen.getByPlaceholderText('Search users by name, username, or email...'), {
target: { value: 'theo' },
})
await waitFor(() => expect(screen.queryByText('Mara')).not.toBeInTheDocument())
expect(screen.getByText('Theo')).toBeInTheDocument()
})
})
describe('AdminUserManagement: editing a balance', () => {
test('Edit Balance swaps the balance for a number box holding the current balance, plus Save', async () => {
await renderLoaded()
await userEvent.click(within(rowOf('Mara')).getByRole('button', { name: 'Edit Balance' }))
const row = within(rowOf('Mara'))
expect(row.getByRole('spinbutton')).toHaveValue(1500)
expect(row.getByRole('button', { name: 'Save' })).toBeInTheDocument()
expect(row.queryByRole('button', { name: 'Edit Balance' })).not.toBeInTheDocument()
expect(row.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
})
test('starts from chips when the user has no balance', async () => {
await renderLoaded([{ _id: 'a', name: 'Chippy', chips: 300 }])
await userEvent.click(screen.getByRole('button', { name: 'Edit Balance' }))
expect(screen.getByRole('spinbutton')).toHaveValue(300)
})
test('only the row being edited changes', async () => {
await renderLoaded()
await userEvent.click(within(rowOf('Mara')).getByRole('button', { name: 'Edit Balance' }))
expect(screen.getAllByRole('spinbutton')).toHaveLength(1)
expect(within(rowOf('Theo')).getByRole('button', { name: 'Edit Balance' })).toBeInTheDocument()
})
test('Save sends the new balance and shows the updated user', async () => {
await renderLoaded([MARA, THEO], () => reply({ ...MARA, balance: 900 }))
await userEvent.click(within(rowOf('Mara')).getByRole('button', { name: 'Edit Balance' }))
fireEvent.change(within(rowOf('Mara')).getByRole('spinbutton'), { target: { value: '900' } })
await userEvent.click(within(rowOf('Mara')).getByRole('button', { name: 'Save' }))
await waitFor(() =>
expect(global.fetch).toHaveBeenCalledWith(
'/api/admin/users/u1/balance',
expect.objectContaining({
method: 'PATCH',
credentials: 'include',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ balance: 900 }),
})
)
)
expect(await within(rowOf('Mara')).findByText('$900')).toBeInTheDocument()
expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
expect(within(rowOf('Theo')).getByText('$200')).toBeInTheDocument() // the other user is untouched
})
test('saving with no change sends the current balance', async () => {
await renderLoaded([MARA], () => reply(MARA))
await userEvent.click(screen.getByRole('button', { name: 'Edit Balance' }))
await userEvent.click(screen.getByRole('button', { name: 'Save' }))
await waitFor(() =>
expect(global.fetch).toHaveBeenCalledWith(
'/api/admin/users/u1/balance',
expect.objectContaining({ body: JSON.stringify({ balance: 1500 }) })
)
)
})
test('tells the admin when the update fails and keeps the box open', async () => {
await renderLoaded([MARA], () => reply({}, { ok: false, status: 500 }))
await userEvent.click(screen.getByRole('button', { name: 'Edit Balance' }))
await userEvent.click(screen.getByRole('button', { name: 'Save' }))
await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Failed to update balance'))
expect(screen.getByRole('spinbutton')).toBeInTheDocument()
})
test('tells the admin when the network fails during an update', async () => {
await renderLoaded([MARA], () => { throw new Error('offline') })
await userEvent.click(screen.getByRole('button', { name: 'Edit Balance' }))
await userEvent.click(screen.getByRole('button', { name: 'Save' }))
await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('offline'))
})
})
describe('AdminUserManagement: deleting a user', () => {
test('asks for confirmation first', async () => {
await renderLoaded()
await userEvent.click(within(rowOf('Mara')).getByRole('button', { name: 'Delete' }))
expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to remove this user?')
})
test('does nothing if the admin cancels', async () => {
confirmSpy.mockReturnValue(false)
await renderLoaded()
await userEvent.click(within(rowOf('Mara')).getByRole('button', { name: 'Delete' }))
expect(mutationCalls()).toHaveLength(0)
expect(screen.getByText('Mara')).toBeInTheDocument()
})
test('sends DELETE and removes only that user from the list', async () => {
await renderLoaded()
await userEvent.click(within(rowOf('Mara')).getByRole('button', { name: 'Delete' }))
await waitFor(() =>
expect(global.fetch).toHaveBeenCalledWith(
'/api/admin/users/u1',
expect.objectContaining({ method: 'DELETE', credentials: 'include' })
)
)
await waitFor(() => expect(screen.queryByText('Mara')).not.toBeInTheDocument())
expect(screen.getByText('Theo')).toBeInTheDocument()
expect(screen.getByText('Total Users: 1')).toBeInTheDocument()
expect(getCalls()).toHaveLength(1) // the list is updated in place, not re-fetched
})
test('deleting the last user shows the empty message', async () => {
await renderLoaded([MARA])
await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
expect(await screen.findByText('No users found.')).toBeInTheDocument()
})
test('keeps the user and tells the admin when the server refuses', async () => {
await renderLoaded([MARA, THEO], () => reply({}, { ok: false, status: 403 }))
await userEvent.click(within(rowOf('Mara')).getByRole('button', { name: 'Delete' }))
await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Failed to delete user'))
expect(screen.getByText('Mara')).toBeInTheDocument()
})
test('keeps the user and shows the message when the network fails', async () => {
await renderLoaded([MARA], () => { throw new Error('offline') })
await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('offline'))
expect(screen.getByText('Mara')).toBeInTheDocument()
})
})
