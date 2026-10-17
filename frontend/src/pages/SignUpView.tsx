

export function SignUpView({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="relative w-full max-w-sm mx-4 rounded-2xl p-8" style={{ background: '#1c1e25', border: '1px solid #2a2d38' }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-xl opacity-40 hover:opacity-80 transition-opacity" style={{ color: '#e8e4dc' }}>✕</button>
        <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: 'var(--font-display)', color: '#c0392b' }}>Join the table</h2>
        <p className="text-sm mb-6 opacity-50" style={{ color: '#e8e4dc' }}>Create your account to track wins</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-60" style={{ color: '#e8e4dc' }}>USERNAME</label>
            <input
              type="text"
              placeholder="RoyalFlushKing"
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
              style={{ background: '#131418', border: '1px solid #2a2d38', color: '#e8e4dc' }}
              onFocus={e => (e.target.style.borderColor = '#c0392b')}
              onBlur={e => (e.target.style.borderColor = '#2a2d38')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-60" style={{ color: '#e8e4dc' }}>EMAIL</label>
            <input
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
              style={{ background: '#131418', border: '1px solid #2a2d38', color: '#e8e4dc' }}
              onFocus={e => (e.target.style.borderColor = '#c0392b')}
              onBlur={e => (e.target.style.borderColor = '#2a2d38')}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-60" style={{ color: '#e8e4dc' }}>PASSWORD</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all"
              style={{ background: '#131418', border: '1px solid #2a2d38', color: '#e8e4dc' }}
              onFocus={e => (e.target.style.borderColor = '#c0392b')}
              onBlur={e => (e.target.style.borderColor = '#2a2d38')}
            />
          </div>
          <button
            className="w-full py-3 rounded-lg font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#0a0a0b' }}
          >
            Create Account
          </button>
        </div>
        <p className="text-center text-xs mt-5 opacity-40" style={{ color: '#e8e4dc' }}>
          Already have an account?{' '}
          <span className="underline cursor-pointer" style={{ color: '#c0392b', opacity: 1 }}>Sign in</span>
        </p>
      </div>
    </div>
  )
}