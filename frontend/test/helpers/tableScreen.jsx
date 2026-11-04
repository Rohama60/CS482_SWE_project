// Shared setup for the table screen tests (SpectatorView and PokerTableGameplay).
// The screen now talks to the server with fetch and gets live updates through Socket.IO,
// so these helpers fake both.
import { render, screen, waitFor, act } from '@testing-library/react'
import { PokerTable } from '../../src/views/PokerTableView.tsx'
import { socket } from '../../src/socket'
import { authClient } from '../../src/AuthClient.ts'
import { getGuest } from '../../src/guestSession.ts'

export const TABLE = {
  id: 't1', name: 'Velvet Room', stakes: 'low', blind: '1 / 2',
  players: 3, max: 4, status: 'active', avgPot: '$18', hands: 4,
  spectators: [{ kind: 'guest', refId: 'g9', displayName: 'Watcher' }],
}

export const SEATS = [
  { kind: 'user', refId: 'u1', displayName: 'Preston' },
  { kind: 'user', refId: 'u2', displayName: 'Josue' },
  { kind: 'guest', refId: 'g1', displayName: 'Guest-1234' },
]

export const GAME = {
  _id: 'game1', smallBlind: 1, bigBlind: 2, smallBlindPlayerId: 'u2', bigBlindPlayerId: 'g1',
  currentBet: 2, currentTurn: 'u1', playerBets: {}, potSize: 3, round: 'pre-draw',
}

// What the server deals: A♠ A♥ 10♦ 7♣ 3♥ (sent with suit names, the screen turns them into symbols)
export const DEALT = [
  { rank: 'A', suit: 'spades' }, { rank: 'A', suit: 'hearts' }, { rank: '10', suit: 'diamonds' },
  { rank: '7', suit: 'clubs' }, { rank: '3', suit: 'hearts' },
]

function reply(body, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) })
}

// Answers the screen's requests by "METHOD url". Pass overrides to change any answer.
export function installFetch({ seats = SEATS, overrides = {} } = {}) {
  global.fetch = jest.fn((url, options = {}) => {
    const key = `${options.method || 'GET'} ${url}`
    if (overrides[key]) return overrides[key](url, options)
    if (key === `GET /api/tables/${TABLE.id}`) return reply({ table: { ...TABLE, seats } })
    if (key === 'POST /api/games') return reply({ game: GAME, seats })
    if (key === `GET /api/games/${GAME._id}/hand`) return reply({ cards: DEALT })
    if (key === `POST /api/tables/${TABLE.id}/leave`) return reply({ message: 'Left table' })
    return reply({ error: `Unhandled ${key}` }, false)
  })
}

export const callFor = key =>
  global.fetch.mock.calls.find(([url, options = {}]) => `${options.method || 'GET'} ${url}` === key)

// Lets a test pretend the server sent a live event, like 'table-updated'
export function serverSends(event, data) {
  const handler = socket.on.mock.calls.filter(([name]) => name === event).pop()?.[1]
  act(() => { handler(data) })
}

export async function renderTable({
  table = TABLE, spectating = false, seats = SEATS, overrides = {},
  user = { id: 'auth1', name: 'Preston' }, guest = null,
} = {}) {
  authClient.useSession.mockReturnValue({ data: user ? { user } : null })
  getGuest.mockReturnValue(guest)
  installFetch({ seats, overrides })
  const onLeave = jest.fn()
  const onTakeSeat = jest.fn()
  const view = render(<PokerTable table={table} spectating={spectating} onLeave={onLeave} onTakeSeat={onTakeSeat} />)
  // Wait for the seats to load
  await waitFor(() => expect(callFor(`GET /api/tables/${table.id}`)).toBeTruthy())
  if (seats.length) await screen.findByText(`${seats.length} / ${table.max}`)
  return { onLeave, onTakeSeat, ...view }
}

export async function startGame() {
  const { fireEvent } = await import('@testing-library/react')
  fireEvent.click(screen.getByRole('button', { name: 'Start Game' }))
  await screen.findByText('Current pot')
}
