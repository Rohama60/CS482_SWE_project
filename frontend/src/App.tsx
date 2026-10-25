import { useState } from 'react'
import Home from './views/Home.tsx'
import { SignUpView } from './views/SignUpView.tsx'
import { Lobby } from './views/Lobby.tsx'
import type { View } from './components/types.ts'
import type { PokerTableData } from './views/TableCreation.tsx'

import { PokerTable } from './views/PokerTableView.tsx'
import { joinTable, stopSpectating } from './tableJoin.ts'
import { LoginModal } from './components/LoginModal.tsx'



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
      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => { setShowLogin(false); setView('lobby') }}
          onSignUp={() => { setShowLogin(false); openSignUp() }}
        />
      )}
    </>
  )
}
