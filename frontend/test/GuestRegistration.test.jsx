/**
 * @jest-environment jsdom
 */
// G2: a guest who signs up keeps their chips. These tests cover the sign up screen's part.
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SignUpView } from '../src/views/SignUpView.tsx'

const GUEST = { id: 'g1', displayName: 'Guest-1234', chipamount: 500, role: 'guest' }

function reply(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) })
}

function setup() {
  const onClose = jest.fn()
  const onSuccess = jest.fn()
  render(<SignUpView onClose={onClose} onSuccess={onSuccess} />)
  return { onClose, onSuccess }
}

function fillForm() {
  fireEvent.change(screen.getByPlaceholderText('John Doe'), { target: { value: 'Preston' } })
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'preston@example.com' } })
  const textboxes = screen.getAllByRole('textbox')
  fireEvent.change(textboxes[textboxes.length - 1], { target: { value: 'PrestonA7' } })
  document.querySelectorAll('input[type="password"]').forEach(input =>
    fireEvent.change(input, { target: { value: 'password123' } })
  )
}

const submit = () => fireEvent.submit(document.querySelector('form'))
const sentBody = () => JSON.parse(global.fetch.mock.calls[0][1].body)

beforeEach(() => {
  sessionStorage.clear()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  delete global.fetch
})

describe('Sign up as a guest (G2)', () => {
  test('a guest is told their chips will be saved', () => {
    sessionStorage.setItem('guest', JSON.stringify(GUEST))
    setup()
    expect(screen.getByText('Your guest chips will be saved to your new account.')).toBeInTheDocument()
  })

  test('someone who is not a guest does not see that message', () => {
    setup()
    expect(screen.queryByText(/guest chips will be saved/)).not.toBeInTheDocument()
  })

  test('the guest id is sent with the sign up', async () => {
    sessionStorage.setItem('guest', JSON.stringify(GUEST))
    global.fetch = jest.fn(() => reply({ user: { id: 'u1' }, savedChips: 500 }))
    const { onSuccess } = setup()

    fillForm()
    submit()

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(sentBody().guestId).toBe('g1')
  })

  test('after signing up, the browser forgets the guest', async () => {
    sessionStorage.setItem('guest', JSON.stringify(GUEST))
    global.fetch = jest.fn(() => reply({ user: { id: 'u1' }, savedChips: 500 }))
    const { onSuccess } = setup()

    fillForm()
    submit()

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(sessionStorage.getItem('guest')).toBeNull()
  })

  test('if sign up fails, the guest is kept so their chips are not lost', async () => {
    sessionStorage.setItem('guest', JSON.stringify(GUEST))
    global.fetch = jest.fn(() => reply({ error: 'Email already in use' }, false))
    const { onSuccess } = setup()

    fillForm()
    submit()

    expect(await screen.findByText('Email already in use')).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(JSON.parse(sessionStorage.getItem('guest'))).toEqual(GUEST)
  })

  test('a normal sign up sends no guest id', async () => {
    global.fetch = jest.fn(() => reply({ user: { id: 'u1' } }))
    const { onSuccess } = setup()

    fillForm()
    submit()

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(sentBody()).not.toHaveProperty('guestId')
  })
})
