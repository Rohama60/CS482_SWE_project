import { useState, type FormEvent } from 'react'
import { authClient } from '../AuthClient.ts'
import { MemberResetForm } from './MemberResetForm.tsx'

// Login: the "Log In" / "Sign In" popup. Sends the email and password to the backend,
// which checks them with Better Auth and sets the session cookie.
export function LoginModal({
  onClose,
  onSuccess,
  onSignUp,
}: {
  onClose: () => void
  onSuccess: () => void
  onSignUp?: () => void
}) {
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password')
      return
    }

    setError('')
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(result.error || 'Unable to log in')
        return
      }

      // Tell the rest of the app to re-check who is logged in, so the name shows right away
      try { authClient.$store.notify('$sessionSignal') } catch { /* page still works without it */ }
      onSuccess()
    } catch {
      setError('Could not reach the server')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="relative w-full max-w-sm mx-4 rounded-2xl p-8" style={{ background: '#1c1e25', border: '1px solid #2a2d38' }}>
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-xl opacity-40 hover:opacity-80 transition-opacity" style={{ color: '#e8e4dc' }}>✕</button>
        {showForgotPassword ? (
          <>
            <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: 'var(--font-display)', color: '#c0392b' }}>Reset your password</h2>
            <p className="text-sm mb-6 opacity-50" style={{ color: '#e8e4dc' }}>Enter your account email and a new password.</p>
            <MemberResetForm />
            <button onClick={() => setShowForgotPassword(false)} className="w-full text-sm underline opacity-60 hover:opacity-100" style={{ color: '#e8e4dc' }}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: 'var(--font-display)', color: '#c0392b' }}>Welcome back</h2>
            <p className="text-sm mb-6 opacity-50" style={{ color: '#e8e4dc' }}>Sign in to your account</p>
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div>
                <label htmlFor="login-email" className="block text-xs font-medium mb-1.5 opacity-60" style={{ color: '#e8e4dc' }}>EMAIL</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
                  style={{ background: '#131418', border: '1px solid #2a2d38', color: '#e8e4dc' }}
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-xs font-medium mb-1.5 opacity-60" style={{ color: '#e8e4dc' }}>PASSWORD</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
                  style={{ background: '#131418', border: '1px solid #2a2d38', color: '#e8e4dc' }}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm" style={{ color: '#f0a097' }}>{error}</p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-lg font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#0a0a0b', opacity: isSubmitting ? 0.6 : 1 }}
              >
                {isSubmitting ? 'Signing in' : 'Sign In'}
              </button>
            </form>
            <button onClick={() => setShowForgotPassword(true)} className="block mx-auto mt-4 text-xs underline opacity-70 hover:opacity-100" style={{ color: '#c0392b' }}>
              Forgot password?
            </button>
            <p className="text-center text-xs mt-5 opacity-40" style={{ color: '#e8e4dc' }}>
              Don't have an account?{' '}
              <button type="button" onClick={onSignUp} className="underline" style={{ color: '#c0392b', opacity: 1, background: 'none', border: 'none', padding: 0 }}>
                Create one
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
