/**
 * @jest-environment jsdom
 */
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

const mockNotify = jest.fn()

// Fake the auth client so no real login happens
jest.mock('../src/AuthClient.ts', () => ({
  authClient: { $store: { notify: (...args) => mockNotify(...args) } },
}))

// Ayana's reset form has its own tests, so a stand-in is enough here
jest.mock('../src/components/MemberResetForm.tsx', () => ({
  MemberResetForm: () => <div data-testid="reset-form">Reset form</div>,
}))

import { LoginModal } from '../src/components/LoginModal.tsx'

function mockFetchOnce({ ok = true, body = {}, badJson = false } = {}) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: badJson ? () => Promise.reject(new Error('not json')) : () => Promise.resolve(body),
  })
}

function setup() {
  const onClose = jest.fn()
  const onSuccess = jest.fn()
  const onSignUp = jest.fn()
  render(<LoginModal onClose={onClose} onSuccess={onSuccess} onSignUp={onSignUp} />)
  return { onClose, onSuccess, onSignUp }
}

function fillIn(email, password) {
  fireEvent.change(screen.getByLabelText('EMAIL'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('PASSWORD'), { target: { value: password } })
}

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Log In' }))

describe('Login popup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete global.fetch
  })

  test('shows the email and password boxes', () => {
    setup()
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByLabelText('EMAIL')).toBeInTheDocument()
    expect(screen.getByLabelText('PASSWORD')).toHaveAttribute('type', 'password')
  })

  test('a correct login calls the server, refreshes the session and closes', async () => {
    mockFetchOnce({ body: { user: { id: 'u1' } } })
    const { onSuccess } = setup()

    fillIn('preston@example.com', 'password123')
    submit()

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(global.fetch).toHaveBeenCalledWith('/api/login', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email: 'preston@example.com', password: 'password123' }),
    }))
    expect(mockNotify).toHaveBeenCalledWith('$sessionSignal')
  })

  test('still logs in if refreshing the session throws', async () => {
    mockFetchOnce({ body: { user: { id: 'u1' } } })
    mockNotify.mockImplementationOnce(() => { throw new Error('no store') })
    const { onSuccess } = setup()

    fillIn('preston@example.com', 'password123')
    submit()

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  test('empty boxes show an error without calling the server', () => {
    global.fetch = jest.fn()
    const { onSuccess } = setup()

    submit()

    expect(screen.getByRole('alert')).toHaveTextContent('Enter your email and password')
    expect(global.fetch).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test('a wrong password shows the server message and stays open', async () => {
    mockFetchOnce({ ok: false, body: { error: 'Incorrect email or password' } })
    const { onSuccess } = setup()

    fillIn('preston@example.com', 'wrong')
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test('a failure with no message shows a general error', async () => {
    mockFetchOnce({ ok: false, badJson: true })
    setup()

    fillIn('preston@example.com', 'password123')
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to log in')
  })

  test('a server that cannot be reached shows an error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'))
    setup()

    fillIn('preston@example.com', 'password123')
    submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server')
  })

  test('the button says Logging in while waiting', async () => {
    let finish
    global.fetch = jest.fn(() => new Promise(resolve => { finish = resolve }))
    setup()

    fillIn('preston@example.com', 'password123')
    submit()

    expect(await screen.findByRole('button', { name: 'Logging in' })).toBeDisabled()
    finish({ ok: true, json: () => Promise.resolve({}) })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Log In' })).toBeEnabled())
  })

  test('the X button closes the popup', () => {
    const { onClose } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  test('Create one opens sign up', () => {
    const { onSignUp } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Create one' }))
    expect(onSignUp).toHaveBeenCalled()
  })

  test('Forgot password switches to the reset form and back', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(screen.getByTestId('reset-form')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to log in' }))
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
  })
})
