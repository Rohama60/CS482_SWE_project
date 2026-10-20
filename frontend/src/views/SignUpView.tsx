import { useState } from 'react'

export function SignUpView({ onClose }: { onClose: () => void }) {
 
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSignUp() {
        try {
          setError('')
        
        const response = await fetch('http://localhost:3000/api/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
             name, 
             email, 
             username, 
             password 
          })
        })
        const result = await response.json()
        
        if (!response.ok) {
          throw new Error(result.message || 'Failed to sign up')
        }
        console.log('Sign up successful')
        onClose() 
      }
      catch (err) {
        if (err instanceof Error) {
          setError(err.message)
        }
      }
    }
 
  return (
     
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(2px)' }}>
      <div className="relative w-full max-w-sm mx-4 rounded-2xl p-8" style={{ background: '#1c1e25', border: '1px solid #2a2d38' }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-xl bg-transparentborder-none opacity-40 hover:opacity-80 transition-opacity" style={{ background : '#1c1e25', border : 'none',color: '#d4c6c6' }}>✕</button>
        <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: 'var(--font-display)', color: '#c0392b' }}>Join the table</h2>
        <p className="text-sm mb-6 opacity-50" style={{ color: '#e8e4dc' }}>Create your account to track wins</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-60" style={{ color: '#e8e4dc' }}>NAME</label>
            <input
              type="text"
              placeholder="John Doe"
              value={name}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
              style={{ background: '#131418', border: '1px solid #2a2d38', color: '#e8e4dc' }}
              onChange={e => setName(e.target.value)}       
              onFocus={e => (e.target.style.borderColor = '#c0392b')}
              onBlur={e => (e.target.style.borderColor = '#2a2d38')}
            />
          </div>
           <div>
            <label className="block text-xs font-medium mb-1.5 opacity-60" style={{ color: '#e8e4dc' }}>EMAIL</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
              style={{ background: '#131418', border: '1px solid #2a2d38', color: '#e8e4dc' }}
              onChange={e => setEmail(e.target.value)}
              onFocus={e => (e.target.style.borderColor = '#c0392b')}
              onBlur={e => (e.target.style.borderColor = '#2a2d38')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-60" style={{ color: '#e8e4dc' }}>USERNAME</label>
            <input
              type="text"
              placeholder="RoyalFlushKing"
              value={username} 
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
              style={{ background: '#131418', border: '1px solid #2a2d38', color: '#e8e4dc' }}
              onChange={e => setUsername(e.target.value)}
              onFocus={e => (e.target.style.borderColor = '#c0392b')}
              onBlur={e => (e.target.style.borderColor = '#2a2d38')}
            />
          </div>
         
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-60" style={{ color: '#e8e4dc' }}>PASSWORD</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
              style={{ background: '#131418', border: '1px solid #2a2d38', color: '#e8e4dc' }}
              onChange={e => setPassword(e.target.value)}
              onFocus={e => (e.target.style.borderColor = '#c0392b')}
              onBlur={e => (e.target.style.borderColor = '#2a2d38')}
            />
          </div>
          <button
            onClick={handleSignUp}
            
            className="w-full py-3 rounded-lg font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#0a0a0b' }}
          >
            Create Account
          </button>
          {error && (<p className="text-xs mt-2 text-red-400">{error}</p>)}
        </div>
        <p className="text-center text-xs mt-5 opacity-40" style={{ color: '#e8e4dc' }}>
          Already have an account?{' '}
          <span className="underline cursor-pointer" style={{ color: '#c0392b', opacity: 1 }}>Sign in</span>
        </p>
      </div>
    </div>
  )
}