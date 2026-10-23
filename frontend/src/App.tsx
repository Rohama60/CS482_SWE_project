import { useState } from 'react'
import Home from './views/Home.tsx'
import { SignUpView } from './views/SignUpView.tsx'
import { Lobby } from './views/Lobby.tsx'
import type { View } from './components/types.ts'
import type { PokerTableData } from './views/TableCreation.tsx'

import { PokerTable } from './views/PokerTableView.tsx'
import { joinTable, stopSpectating } from './tableJoin.ts'
import { MemberResetForm } from './components/MemberResetForm.tsx'



const TABLES = [
  { id: 1, name: 'Velvet Room',    stakes: 'low',    blind: '1 / 2',     players: 4, max: 6, status: 'active',  avgPot: '$18',   hands: 142 },
  { id: 2, name: 'The Boneyard',   stakes: 'medium', blind: '5 / 10',    players: 3, max: 6, status: 'active',  avgPot: '$87',   hands: 58  },
  { id: 3, name: 'Crimson Lounge', stakes: 'high',   blind: '25 / 50',   players: 5, max: 6, status: 'active',  avgPot: '$420',  hands: 31  },
  { id: 4, name: 'Lucky Draw',     stakes: 'low',    blind: '1 / 2',     players: 2, max: 6, status: 'active',  avgPot: '$12',   hands: 209 },
  { id: 5, name: 'Dead Man\'s Hand',stakes:'medium', blind: '5 / 10',    players: 6, max: 6, status: 'full',    avgPot: '$95',   hands: 77  },
  { id: 6, name: 'High Roller',    stakes: 'high',   blind: '100 / 200', players: 2, max: 6, status: 'active',  avgPot: '$1,840',hands: 12  },
  { id: 7, name: 'Parlor No. 7',   stakes: 'low',    blind: '1 / 2',     players: 1, max: 6, status: 'waiting', avgPot: '—',     hands: 0   },
  { id: 8, name: 'Iron Curtain',   stakes: 'medium', blind: '10 / 20',   players: 4, max: 6, status: 'active',  avgPot: '$155',  hands: 44  },
]





function LoginModal({ onClose }: { onClose: () => void }) {
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="relative w-full max-w-sm mx-4 rounded-2xl p-8" style={{ background: '#1c1e25', border: '1px solid #2a2d38' }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-xl opacity-40 hover:opacity-80 transition-opacity" style={{ color: '#e8e4dc' }}>✕</button>
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
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5 opacity-60" style={{ color: '#e8e4dc' }}>EMAIL</label>
                <input type="email" placeholder="you@example.com" className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all" style={{ background: '#131418', border: '1px solid #2a2d38', color: '#e8e4dc' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 opacity-60" style={{ color: '#e8e4dc' }}>PASSWORD</label>
                <input type="password" placeholder="••••••••" className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-all" style={{ background: '#131418', border: '1px solid #2a2d38', color: '#e8e4dc' }} />
              </div>
              <button className="w-full py-3 rounded-lg font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#0a0a0b' }}>
                Sign In
              </button>
            </div>
            <button onClick={() => setShowForgotPassword(true)} className="block mx-auto mt-4 text-xs underline opacity-70 hover:opacity-100" style={{ color: '#c0392b' }}>
              Forgot password?
            </button>
            <p className="text-center text-xs mt-5 opacity-40" style={{ color: '#e8e4dc' }}>
              Don't have an account? <span className="underline cursor-pointer" style={{ color: '#c0392b', opacity: 1 }}>Create one</span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}



export default function App() {
 
  const [view, setView] = useState<View>('home')
  const [selectedTable, setSelectedTable] = useState<PokerTableData>(TABLES[0])
  const [previousView, setPreviousView] = useState<View>('home')
  const [spectating, setSpectating] = useState(false) // P3
  const [showLogin, setShowLogin] = useState(false)


  function openSignUp() {
    setPreviousView(view);
    setView('signup');
  }
 
  if (view === 'lobby') {
    return (
      <Lobby
          onBack={() => setView('home')}
          onJoin={(table : PokerTableData) => {
            setSelectedTable(table);
            setSpectating(false);
            setView('table');
        }}
          onSpectate={(table: PokerTableData) => {
            setSelectedTable(table);
            setSpectating(true);
            setView('table');
          }}
       
        onSignUp={openSignUp}
      />
    )
  }
 
  // P3: a spectator who sees an open seat can take it without going back to the lobby
  async function takeSeatFromSpectating() {
    try {
      const table = await joinTable(selectedTable.id, selectedTable.inviteCode ?? undefined)
      setSelectedTable(table)
      setSpectating(false)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not take a seat')
    }
  }

  if (view === 'table') {
    return (
      <PokerTable
        table={selectedTable}
        spectating={spectating}
        onTakeSeat={takeSeatFromSpectating}
        onLeave={() => {
          if (spectating) stopSpectating(selectedTable.id)
          setSpectating(false)
          setView('lobby')
        }}
      />
    )
  }

  if (view === 'signup') {
    return (
  <SignUpView
    onClose={() => setView(previousView)}
    onSuccess={() => setView('lobby')}
    />
  )
}

 
  return (
    <>
      <Home view={view} setView={setView} onSignUp={openSignUp} onSignIn={() => setShowLogin(true)} />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  )
}
