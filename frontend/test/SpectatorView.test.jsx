/**
 * @jest-environment jsdom
 */
// P3 (Spectating) and P7 (invite code): the table screen when you are watching,
// compared with when you are seated.
import '@testing-library/jest-dom'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { PokerTable } from '../src/views/PokerTableView.tsx'

const TABLE = {
  id: 't1', name: 'Velvet Room', stakes: 'low', blind: '1 / 2',
  players: 3, max: 4, status: 'active', avgPot: '$18', hands: 4,
  spectators: [{ kind: 'guest', refId: 'g1', displayName: 'Guest-1234' }],
}

function setup({ table = TABLE, spectating = false } = {}) {
  const onLeave = jest.fn()
  const onTakeSeat = jest.fn()
  render(<PokerTable table={table} spectating={spectating} onLeave={onLeave} onTakeSeat={onTakeSeat} />)
  return { onLeave, onTakeSeat }
}

// Your own cards are buttons you can click to mark for discarding
const yourCards = () => screen.queryAllByRole('button', { name: /selected to discard|keep/ })

describe('Table screen while spectating (P3)', () => {
  test('shows the Spectating panel instead of your hand', () => {
    setup({ spectating: true })
    expect(screen.getByText('Spectating')).toBeInTheDocument()
    expect(screen.queryByText('Your hand')).not.toBeInTheDocument()
  })

  test('your cards are hidden, so there is nothing to click', () => {
    setup({ spectating: true })
    expect(yourCards()).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /Draw/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Stand pat' })).not.toBeInTheDocument()
  })

  test('says how many seats are open', () => {
    setup({ spectating: true })
    expect(screen.getByText('1 seat open')).toBeInTheDocument()
  })

  test('uses "seats" when more than one is open', () => {
    setup({ spectating: true, table: { ...TABLE, players: 2, max: 6 } })
    expect(screen.getByText('4 seats open')).toBeInTheDocument()
  })

  test('shows how many people are watching', () => {
    setup({ spectating: true, table: { ...TABLE, spectators: [TABLE.spectators[0], { kind: 'user', refId: 'u2', displayName: 'Jo' }] } })
    expect(screen.getByText(/2 watching/)).toBeInTheDocument()
  })

  test('counts you as the one watcher if the list is missing', () => {
    setup({ spectating: true, table: { ...TABLE, spectators: undefined } })
    expect(screen.getByText(/1 watching/)).toBeInTheDocument()
  })

  test('Take a Seat is clickable when a seat is open', () => {
    const { onTakeSeat } = setup({ spectating: true })
    const button = screen.getByRole('button', { name: 'Take a Seat' })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(onTakeSeat).toHaveBeenCalledTimes(1)
  })

  test('a full table says so and the seat button is disabled', () => {
    const { onTakeSeat } = setup({ spectating: true, table: { ...TABLE, players: 4, max: 4 } })
    expect(screen.getByText('Table is full')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'No seats open' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onTakeSeat).not.toHaveBeenCalled()
  })

  test('the leave button says Stop watching', () => {
    const { onLeave } = setup({ spectating: true })
    fireEvent.click(screen.getByRole('button', { name: '← Stop watching' }))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  test('table details show real player and watcher counts', () => {
    setup({ spectating: true })
    expect(screen.getByText('3 / 4')).toBeInTheDocument()
    expect(screen.getByText('Watching')).toBeInTheDocument()
  })
})

describe('Table screen while seated', () => {
  test('shows your hand and lets you pick cards', () => {
    setup()
    expect(screen.queryByText('Spectating')).not.toBeInTheDocument()
    expect(yourCards()).toHaveLength(5)
    expect(screen.queryByRole('button', { name: 'Take a Seat' })).not.toBeInTheDocument()
  })

  test('the leave button says Leave table', () => {
    const { onLeave } = setup()
    fireEvent.click(screen.getByRole('button', { name: '← Leave table' }))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})

describe('Invite code on the table screen (P7)', () => {
  test('the host of a private table sees the code', () => {
    setup({ table: { ...TABLE, isPrivate: true, inviteCode: 'K7Q2MX' } })
    const box = screen.getByText('Invite code').parentElement
    expect(within(box).getByText('K7Q2MX')).toBeInTheDocument()
  })

  test('players who joined get no code, so none is shown', () => {
    setup({ table: { ...TABLE, isPrivate: true, inviteCode: undefined } })
    expect(screen.queryByText('Invite code')).not.toBeInTheDocument()
  })

  test('public tables never show a code', () => {
    setup({ table: { ...TABLE, isPrivate: false, inviteCode: null } })
    expect(screen.queryByText('Invite code')).not.toBeInTheDocument()
  })
})
