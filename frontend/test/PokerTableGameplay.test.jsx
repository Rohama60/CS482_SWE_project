/**
 * @jest-environment jsdom
 */
// The regular (seated) table screen: picking cards, drawing, standing pat,
// dealing the next hand, and the How to play guide.
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { PokerTable } from '../src/views/PokerTableView.tsx'

const TABLE = {
  id: 't1', name: 'Velvet Room', stakes: 'low', blind: '1 / 2',
  players: 2, max: 6, status: 'active', avgPot: '$18', hands: 4, spectators: [],
}

function setup() {
  render(<PokerTable table={TABLE} onLeave={jest.fn()} />)
}

// Your cards are buttons labeled like "10 of ♦; keep" or "7 of ♣; selected to discard"
const card = (rank, suit) => screen.getByRole('button', { name: new RegExp(`^${rank} of ${suit};`) })
const isMarked = (rank, suit) => card(rank, suit).getAttribute('aria-pressed') === 'true'

describe('Picking cards to discard', () => {
  test('the hand starts with the 10, 7 and 3 marked', () => {
    setup()
    expect(isMarked('A', '♠')).toBe(false)
    expect(isMarked('A', '♥')).toBe(false)
    expect(isMarked('10', '♦')).toBe(true)
    expect(isMarked('7', '♣')).toBe(true)
    expect(isMarked('3', '♥')).toBe(true)
    expect(screen.getByRole('button', { name: 'Draw 3' })).toBeInTheDocument()
    expect(screen.getByText('3 cards marked to discard')).toBeInTheDocument()
  })

  test('clicking a kept card marks it', () => {
    setup()
    fireEvent.click(card('A', '♠'))
    expect(isMarked('A', '♠')).toBe(true)
    expect(screen.getByRole('button', { name: 'Draw 4' })).toBeInTheDocument()
  })

  test('clicking a marked card unmarks it', () => {
    setup()
    fireEvent.click(card('3', '♥'))
    expect(isMarked('3', '♥')).toBe(false)
    expect(screen.getByRole('button', { name: 'Draw 2' })).toBeInTheDocument()
  })

  test('with nothing marked the button just says Draw', () => {
    setup()
    fireEvent.click(card('10', '♦'))
    fireEvent.click(card('7', '♣'))
    fireEvent.click(card('3', '♥'))
    expect(screen.getByRole('button', { name: 'Draw' })).toBeInTheDocument()
    expect(screen.getByText('A pair of aces with a 10 kicker')).toBeInTheDocument()
  })
})

describe('Drawing and finishing the hand', () => {
  test('Draw replaces the marked cards', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Draw 3' }))

    expect(card('A', '♦')).toBeInTheDocument()
    expect(card('K', '♣')).toBeInTheDocument()
    expect(card('3', '♠')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^10 of ♦;/ })).not.toBeInTheDocument()
    expect(screen.getByText('Three of a kind — Aces')).toBeInTheDocument()
    expect(screen.getByText('Three aces with a king kicker')).toBeInTheDocument()
  })

  test('after drawing, the cards are locked', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Draw 3' }))
    fireEvent.click(card('A', '♠'))
    expect(isMarked('A', '♠')).toBe(false)
  })

  test('Stand pat ends the turn without changing any cards', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Stand pat' }))

    expect(card('10', '♦')).toBeInTheDocument()
    expect(isMarked('10', '♦')).toBe(false)
    expect(screen.getByRole('button', { name: 'Deal next hand' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Draw/ })).not.toBeInTheDocument()
  })

  test('Deal next hand brings back the starting hand', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Draw 3' }))
    fireEvent.click(screen.getByRole('button', { name: 'Deal next hand' }))

    expect(card('10', '♦')).toBeInTheDocument()
    expect(isMarked('10', '♦')).toBe(true)
    expect(screen.getByRole('button', { name: 'Draw 3' })).toBeInTheDocument()
    expect(screen.getByText('One pair — Aces')).toBeInTheDocument()
  })
})

describe('How to play guide', () => {
  // The ? at the top, then the How to play button in the side panel
  const helpButtons = () => screen.getAllByRole('button', { name: /how to play$/i })
  const guideTitle = () => screen.queryByText('How to play 5-card draw')

  test('the ? button at the top opens the guide', () => {
    setup()
    expect(guideTitle()).not.toBeInTheDocument()
    fireEvent.click(helpButtons()[0])
    expect(guideTitle()).toBeInTheDocument()
  })

  test('the How to play button on the side opens it too', () => {
    setup()
    fireEvent.click(helpButtons()[1])
    expect(guideTitle()).toBeInTheDocument()
  })

  test('Got it closes the guide', () => {
    setup()
    fireEvent.click(helpButtons()[0])
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(guideTitle()).not.toBeInTheDocument()
  })

  test('the X closes the guide', () => {
    setup()
    fireEvent.click(helpButtons()[0])
    fireEvent.click(screen.getByRole('button', { name: 'Close how to play' }))
    expect(guideTitle()).not.toBeInTheDocument()
  })

  test('clicking the dark area outside closes the guide, clicking inside does not', () => {
    setup()
    fireEvent.click(helpButtons()[0])

    fireEvent.click(guideTitle())
    expect(guideTitle()).toBeInTheDocument()

    fireEvent.click(guideTitle().closest('.fixed'))
    expect(guideTitle()).not.toBeInTheDocument()
  })
})
