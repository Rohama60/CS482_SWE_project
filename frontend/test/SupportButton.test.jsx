/**
 * @jest-environment jsdom
 */
// P18: the Chat with admin button in the bottom-left corner of the lobby.
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { SupportButton } from '../src/components/support/SupportButton.tsx'

const label = () => screen.queryByTestId('support-button-label')
const badge = () => screen.queryByTestId('support-button-badge')

describe('Chat with admin button (P18)', () => {
  test('is a small round button that calls onClick', () => {
    const onClick = jest.fn()
    render(<SupportButton open={false} unread={0} onClick={onClick} />)
    const button = screen.getByRole('button', { name: 'Chat with admin' })
    expect(button).toHaveStyle({ height: '52px', minWidth: '52px' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(label()).not.toBeInTheDocument()
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalled()
  })

  test('stays in the bottom-left corner, away from the ads on the right', () => {
    render(<SupportButton open={false} unread={0} onClick={jest.fn()} />)
    expect(screen.getByRole('button')).toHaveStyle({ position: 'fixed', left: '16px', bottom: '16px' })
  })

  test('says "Chat with admin" when you hover over it, and goes back small after', () => {
    render(<SupportButton open={false} unread={0} onClick={jest.fn()} />)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(label()).toHaveTextContent('Chat with admin')
    fireEvent.mouseLeave(screen.getByRole('button'))
    expect(label()).not.toBeInTheDocument()
  })

  test('also says it when you tab to it with the keyboard', () => {
    render(<SupportButton open={false} unread={0} onClick={jest.fn()} />)
    fireEvent.focus(screen.getByRole('button'))
    expect(label()).toHaveTextContent('Chat with admin')
    fireEvent.blur(screen.getByRole('button'))
    expect(label()).not.toBeInTheDocument()
  })

  test('shows how many admin replies are waiting as a badge', () => {
    render(<SupportButton open={false} unread={2} onClick={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Chat with admin, 2 new replies' })).toBeInTheDocument()
    expect(badge()).toHaveTextContent('2')
  })

  test('says "reply" for just one', () => {
    render(<SupportButton open={false} unread={1} onClick={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Chat with admin, 1 new reply' })).toBeInTheDocument()
  })

  test('no badge when there are no replies', () => {
    render(<SupportButton open={false} unread={0} onClick={jest.fn()} />)
    expect(badge()).not.toBeInTheDocument()
  })

  test('becomes a Close button while the chat is open, with no badge', () => {
    render(<SupportButton open unread={3} onClick={jest.fn()} />)
    const button = screen.getByRole('button', { name: 'Close chat with admin' })
    expect(button).toHaveTextContent('✕')
    expect(badge()).not.toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'true')
    fireEvent.mouseEnter(button)
    expect(label()).toHaveTextContent('Close')
  })
})
