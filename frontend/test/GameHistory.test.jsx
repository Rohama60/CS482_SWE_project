/**
 * @jest-environment jsdom
 */
// P13: As a Player, I want to be able to see the games that I have played,
// so that I can see how I've been doing.
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { GameHistory, formatChips, formatPlayedAt } from '../src/components/history/GameHistory.tsx'
import { HistoryPage } from '../src/views/HistoryPage.tsx'

const STATS = { hands: 3, wins: 1, losses: 2, winRate: 33, netChips: 25 }
const GAMES = [
  { id: 'g3', tableName: 'Velvet Room', playedAt: '2026-11-18T20:00:00Z', result: 'won', folded: false, chipsChange: 40, handName: 'Two Pair', summary: 'Preston wins $80 with Two Pair', players: 2, opponents: ['Ace (CPU)'] },
  { id: 'g2', tableName: 'High Rollers', playedAt: '2026-11-18T19:00:00Z', result: 'lost', folded: false, chipsChange: -10, handName: null, summary: 'Josue wins $20 with a Flush', players: 3, opponents: ['Josue', 'Duke (CPU)'] },
  { id: 'g1', tableName: 'Velvet Room', playedAt: '2026-11-17T18:00:00Z', result: 'lost', folded: true, chipsChange: -5, handName: null, summary: '', players: 2, opponents: [] },
]

function reply(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) })
}

function installFetch(answer = () => reply({ stats: STATS, games: GAMES })) {
  global.fetch = jest.fn(answer)
}

async function showHistory(answer) {
  installFetch(answer)
  render(<GameHistory />)
  await waitFor(() => expect(screen.queryByText('Loading your games...')).not.toBeInTheDocument())
}

const stat = label => within(screen.getByLabelText('Your stats')).getByText(label).nextSibling
const rows = () => within(screen.getByRole('list', { name: 'Recent games' })).getAllByRole('listitem')

afterEach(() => {
  delete global.fetch
})

describe('Game history (P13)', () => {
  test('asks the server for your history with the login cookie', async () => {
    await showHistory()
    expect(global.fetch).toHaveBeenCalledWith('/api/history', expect.objectContaining({ credentials: 'include' }))
  })

  test('shows Loading while waiting', () => {
    installFetch(() => new Promise(() => {}))
    render(<GameHistory />)
    expect(screen.getByText('Loading your games...')).toBeInTheDocument()
  })

  test('shows your stats', async () => {
    await showHistory()
    expect(stat('Hands')).toHaveTextContent('3')
    expect(stat('Wins')).toHaveTextContent('1')
    expect(stat('Losses')).toHaveTextContent('2')
    expect(stat('Win rate')).toHaveTextContent('33%')
    expect(stat('Chips')).toHaveTextContent('+$25')
  })

  test('chips you are up show green', async () => {
    await showHistory()
    expect(stat('Chips')).toHaveStyle({ color: '#86efac' })
  })

  test('chips you are down show red', async () => {
    await showHistory(() => reply({ stats: { ...STATS, netChips: -30 }, games: GAMES }))
    expect(stat('Chips')).toHaveTextContent('-$30')
    expect(stat('Chips')).toHaveStyle({ color: '#f0a097' })
  })

  test('lists your games newest first', async () => {
    await showHistory()
    const list = rows()
    expect(list).toHaveLength(3)
    expect(list[0]).toHaveTextContent('Velvet Room')
    expect(list[1]).toHaveTextContent('High Rollers')
  })

  test('a win shows Won, the chips you won and your winning hand', async () => {
    await showHistory()
    const row = rows()[0]
    expect(row).toHaveTextContent('Won')
    expect(row).toHaveTextContent('+$40')
    expect(row).toHaveTextContent('Two Pair')
    expect(row).toHaveTextContent('Preston wins $80 with Two Pair')
    expect(row).toHaveTextContent('vs Ace (CPU)')
  })

  test('a loss shows Lost, the chips you lost and who you played', async () => {
    await showHistory()
    const row = rows()[1]
    expect(row).toHaveTextContent('Lost')
    expect(row).toHaveTextContent('-$10')
    expect(row).toHaveTextContent('vs Josue, Duke (CPU)')
  })

  test('a hand you folded says Folded', async () => {
    await showHistory()
    expect(rows()[2]).toHaveTextContent('Folded')
    expect(rows()[2]).toHaveTextContent('-$5')
  })

  test('a hand with no result line shows how many played', async () => {
    await showHistory()
    expect(rows()[2]).toHaveTextContent('2 players')
  })

  test('shows when each hand was played', async () => {
    await showHistory()
    expect(rows()[0]).toHaveTextContent(formatPlayedAt('2026-11-18T20:00:00Z'))
  })

  test('no games yet says so', async () => {
    await showHistory(() => reply({ stats: { hands: 0, wins: 0, losses: 0, winRate: 0, netChips: 0 }, games: [] }))
    expect(screen.getByText('No games yet')).toBeInTheDocument()
    expect(stat('Win rate')).toHaveTextContent('-')
    expect(stat('Chips')).toHaveTextContent('$0')
    expect(screen.queryByRole('list', { name: 'Recent games' })).not.toBeInTheDocument()
  })

  test('a reply missing the lists counts as no games', async () => {
    await showHistory(() => reply({}))
    expect(screen.getByText('No games yet')).toBeInTheDocument()
    expect(stat('Hands')).toHaveTextContent('0')
  })

  test('a server error is shown', async () => {
    await showHistory(() => reply({ error: 'Log in to see your game history' }, false))
    expect(screen.getByRole('alert')).toHaveTextContent('Log in to see your game history')
  })

  test('a failure that is not a normal error uses a fallback', async () => {
    await showHistory(() => Promise.reject('down'))
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your game history')
  })

  test('closing the page before it loads does not cause errors', async () => {
    let finish
    installFetch(() => new Promise(resolve => { finish = resolve }))
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(<GameHistory />)
    unmount()
    finish({ ok: true, json: () => Promise.resolve({ stats: STATS, games: GAMES }) })
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  test('closing the page before an error comes back does not cause errors', async () => {
    let fail
    installFetch(() => new Promise((_, reject) => { fail = reject }))
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(<GameHistory />)
    unmount()
    fail(new Error('down'))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })
})

describe('formatting helpers', () => {
  test('formatChips adds a sign and commas', () => {
    expect(formatChips(1240)).toBe('+$1,240')
    expect(formatChips(-15)).toBe('-$15')
    expect(formatChips(0)).toBe('$0')
  })

  test('formatPlayedAt handles missing or bad dates', () => {
    expect(formatPlayedAt(undefined)).toBe('')
    expect(formatPlayedAt('not a date')).toBe('')
    expect(formatPlayedAt('2026-11-18T20:00:00Z')).not.toBe('')
  })
})

describe('History page (P13)', () => {
  test('shows the title and your history', async () => {
    installFetch()
    render(<HistoryPage onBack={jest.fn()} />)
    expect(screen.getByRole('heading', { name: 'Game History' })).toBeInTheDocument()
    expect(await screen.findByText('High Rollers')).toBeInTheDocument()
  })

  test('Back to lobby calls onBack', async () => {
    installFetch()
    const onBack = jest.fn()
    render(<HistoryPage onBack={onBack} />)
    await screen.findByText('High Rollers')
    fireEvent.click(screen.getByRole('button', { name: /Back to lobby/ }))
    expect(onBack).toHaveBeenCalled()
  })
})
