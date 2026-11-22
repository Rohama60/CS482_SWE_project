import { useEffect, useState } from 'react'
import Home from './views/Home.tsx'
import { SignUpView } from './views/SignUpView.tsx'
import { Lobby } from './views/Lobby.tsx'
import type { View } from './components/types.ts'
import type { PokerTableData } from './views/TableCreation.tsx'

import { PokerTable } from './views/PokerTableView.tsx'
import { joinTable, stopSpectating } from './tableJoin.ts'
import { LoginModal } from './components/LoginModal.tsx'
import { AdminDashboard } from './views/AdminDashboard.tsx'
import ProfileTab from './views/ProfileTab.tsx'
import LeaderboardView from './views/LeaderboardView.tsx'
import { HistoryPage } from './views/HistoryPage.tsx'
import { authClient } from './AuthClient.ts'



const TABLES = [
  { id: 1, name: 'Velvet Room',    stakes: 'low',    blind: '$1 ante',     players: 4, max: 6, status: 'active',  avgPot: '$18',   hands: 142 },
  { id: 2, name: 'The Boneyard',   stakes: 'medium', blind: '$5 ante',    players: 3, max: 6, status: 'active',  avgPot: '$87',   hands: 58  },
  { id: 3, name: 'Crimson Lounge', stakes: 'high',   blind: '$25 ante',   players: 5, max: 6, status: 'active',  avgPot: '$420',  hands: 31  },
  { id: 4, name: 'Lucky Draw',     stakes: 'low',    blind: '$1 ante',     players: 2, max: 6, status: 'active',  avgPot: '$12',   hands: 209 },
  { id: 5, name: 'Dead Man\'s Hand',stakes:'medium', blind: '$5 ante',    players: 6, max: 6, status: 'full',    avgPot: '$95',   hands: 77  },
  { id: 6, name: 'High Roller',    stakes: 'high',   blind: '$25 ante', players: 2, max: 6, status: 'active',  avgPot: '$1,840',hands: 12  },
  { id: 7, name: 'Parlor No. 7',   stakes: 'low',    blind: '$1 ante',     players: 1, max: 6, status: 'waiting', avgPot: '—',     hands: 0   },
  { id: 8, name: 'Iron Curtain',   stakes: 'medium', blind: '$5 ante',   players: 4, max: 6, status: 'active',  avgPot: '$155',  hands: 44  },
]





export default function App() {
 
  const [view, setView] = useState<View>('home')
  const [selectedTable, setSelectedTable] = useState<PokerTableData>(TABLES[0])
  const [previousView, setPreviousView] = useState<View>('home')
  const [profileReturnView, setProfileReturnView] = useState<View>('home')
  const [historyReturnView, setHistoryReturnView] = useState<View>('home')
  const [spectating, setSpectating] = useState(false) // P3
  const [showLogin, setShowLogin] = useState(false)
  const { data: session } = authClient.useSession()

  useEffect(() => {
    if (!session?.user?.id) return

    const controller = new AbortController()
    async function restoreAdminView() {
      try {
        const response = await fetch('/api/users/me', {
          credentials: 'include',
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('Unable to load the current user role')
        }

        const result = await response.json() as { user?: { role?: string } }
        if (result.user?.role === 'admin') {
          setView('admin')
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Unable to restore the admin dashboard:', error)
        }
      }
    }

    void restoreAdminView()
    return () => controller.abort()
  }, [session?.user?.id])

  function openProfile(returnTo: View) {
    setProfileReturnView(returnTo)
    setView('profile')
  }

  function openHistory(returnTo: View) {
    setHistoryReturnView(returnTo)
    setView('history')
  }

  async function handleProfileLogout() {
    try {
      const { error } = await authClient.signOut()
      if (error) {
        console.error('Sign out failed:', error)
        return
      }
      setView('home')
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }


  function openSignUp() {
    setPreviousView(view);
    setView('signup');
  }

  if (view === 'admin') {
    return (
      <AdminDashboard
        onLeave={() => setView('lobby')}
        onSignOut={() => setView('home')}
        onSessionExpired={() => setView('home')}
      />
    )
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
          onProfile={() => openProfile('lobby')}
          onHistory={() => openHistory('lobby')}
          onLeaderboard={() => setView('leaderboard')}
          onSignUp={openSignUp}
      />
    )
  }

  if (view === 'leaderboard') {
    return (
      <LeaderboardView
        currentUser={session?.user ? {
          id: session.user.id,
          displayName: session.user.name,
          username: session.user.name,
          email: session.user.email,
          role: 'player',
        } : null}
        onBack={() => setView('lobby')}
        onProfile={() => openProfile('leaderboard')}
        onLogout={handleProfileLogout}
      />
    )
  }

  if (view === 'history') {
    return (
      <HistoryPage
        onBack={() => setView(historyReturnView)}
        backLabel={historyReturnView === 'home' ? 'Back to home' : 'Back to lobby'}
      />
    )
  }

  if (view === 'profile') {
    if (!session?.user) {
      return <Home view="home" setView={setView} onSignUp={openSignUp} onSignIn={() => setShowLogin(true)} onProfile={() => openProfile('home')} onHistory={() => openHistory('home')} />
    }

    return (
      <ProfileTab
        user={{
          id: session.user.id,
          displayName: session.user.name,
          username: session.user.name,
          email: session.user.email,
          role: 'player',
        }}
        onBack={() => setView(profileReturnView)}
        onLogout={handleProfileLogout}
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
      <Home
        view={view}
        setView={setView}
        onSignUp={openSignUp}
        onSignIn={() => setShowLogin(true)}
        onProfile={() => openProfile('home')}
        onHistory={() => openHistory('home')}
      />
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={(role) => {
            setShowLogin(false)
            setView(role === 'admin' ? 'admin' : 'lobby')
          }}
          onSignUp={() => { setShowLogin(false); openSignUp() }}
        />
      )}
    </>
  )
}
