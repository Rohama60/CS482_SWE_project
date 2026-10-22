import { useState , useEffect} from 'react'
import { TableCreation , type PokerTableData, type TableConfig} from './TableCreation.tsx'
import { authClient } from '../../lib/auth-client.ts'
type LobbyProps = {
  onBack: () => void;
  onJoin: (table: PokerTableData) => void;
  onSignUp: () => void;
};


const STAKE_COLORS: Record<string, string> = { low: '#22c55e', medium: '#f59e0b', high: '#c0392b' }


function AdSlot({ chips, label, sub, accent = false }: { chips: string; label: string; sub: string; accent?: boolean }) {
  const [watching, setWatching] = useState(false)
  const [done, setDone] = useState(false)
  
  
  function handleWatch() {
    setWatching(true)
    setTimeout(() => { setWatching(false); setDone(true) }, 2000)
  }

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: accent ? 'linear-gradient(135deg, rgba(192,57,43,0.18) 0%, rgba(139,26,26,0.1) 100%)' : '#161820',
        border: `1px solid ${accent ? 'rgba(192,57,43,0.4)' : '#222430'}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: '#e8e4dc' }}>{chips}</span>
        <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: 'rgba(192,57,43,0.2)', color: '#c0392b', border: '1px solid rgba(192,57,43,0.3)' }}>
          +chips
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: '#e8e4dc' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: '#e8e4dc', opacity: 0.4 }}>{sub}</p>
      </div>
      {done ? (
        <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#4ade80' }}>
          ✓ Chips added to your stack!
        </div>
      ) : (
        <button
          onClick={handleWatch}
          disabled={watching}
          className="w-full py-2 rounded-lg text-xs font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }}
        >
          {watching ? '▶ Playing ad…' : '▶ Watch Ad'}
        </button>
      )}
    </div>
  )
}

const STAKE_LABELS: Record<string, string> = { low: 'Low Stakes', medium: 'Mid Stakes', high: 'High Stakes' }

type StakeFilter = 'all' | 'low' | 'medium' | 'high'

function SeatDots({ filled, max }: { filled: number; max: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ background: i < filled ? '#c0392b' : '#2a2d38' }}
        />
      ))}
    </div>
  )
}
export function Lobby({ onBack, onJoin , onSignUp }: LobbyProps) {
  const {data: session, isPending} = authClient.useSession()
  
  const [filter, setFilter] = useState<StakeFilter>('all')
  const [hovered, setHovered] = useState<string | number | null>(null)
  const [showCreateTable, setShowCreateTable] = useState(false)
  const [tables, setTables] = useState<PokerTableData[]>([])
  const [myTables, setMyTables] = useState<PokerTableData[]>([])
  const filtered = filter === 'all' ? tables : tables.filter(t => t.stakes === filter)
 

  useEffect(() => {
    fetch('/api/tables')
      .then(res => res.json())
      .then(data => setTables(data.tables))
      .catch(err => console.error('Failed to load tables', err))
  }, [])
   useEffect(() => {
    if (!session?.user) {
      setTables([])
      return
    }

    let cancelled = false
    
    async function loadMyTables() {
      try {
        const res = await fetch('/api/tables/mine', { credentials: 'include' })
        
        if (!res.ok) throw new Error(`Failed to load hosted tables: ${res.status}`)
       
          const data = await res.json()
        if (!cancelled) setMyTables(data.tables)
      } catch (error) {
        if (!cancelled) console.error('Failed to load my tables', error)
      }
    }
    loadMyTables()
    return () => { cancelled = true }
  }, [session?.user?.id])

  async function handleCreate(config: TableConfig) {
    try {
      const res = await fetch('http://localhost:3000/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Failed to create table')
        return
      }
    setTables(prev =>
        data.table.isPrivate ? prev : [data.table, ...prev]
    )

    setMyTables(prev => [data.table, ...prev])
      setShowCreateTable(false)
      onJoin(data.table)
    } catch {
      alert('Could not reach the server')
    }
  }
  async function handleDelete(tableId: string) {
    const confirmed = window.confirm(
        'Are you sure you want to delete this table?'
    )

    if (!confirmed) return

    try {
        const res = await fetch(`/api/tables/${tableId}`, {
            method: 'DELETE',
            credentials: 'include'
        })

        const data = await res.json()

        if (!res.ok) {
            alert(data.error || 'Failed to delete table')
            return
        }

        // Remove from My Tables
        setMyTables(prev =>
            prev.filter(table => String(table.id) !== String(tableId))
        )

        // Remove from All Tables
        setTables(prev =>
            prev.filter(table => String(table.id) !== String(tableId))
        )

    } catch (error) {
        console.error('Failed to delete table:', error)
        alert('Could not reach the server')
    }
}



  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0b' }}>
      {/* Red top line */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #c0392b 30%, #c0392b 70%, transparent)' }} />
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(90,10,10,0.45) 0%, transparent 70%)' }} />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#1c1e25' }}>
        <div className="flex items-center gap-4">
        <button
             onClick={onBack}
             className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all hover:bg-white/5 hover:brightness-125"
              style={{
                backgroundColor: '#1c1e25',
                border: 'none',
                color: '#fff'
              }} >
              ← Back
            </button>
          <div className="w-px h-4" style={{ background: '#2a2d38' }} />
          <div className="flex items-center gap-2">
            <span style={{ color: '#c0392b' }}>♠</span>
            <span style={{ fontFamily: 'var(--font-display)', color: '#e8e4dc', fontSize: '0.95rem', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
              Royal Draw
            </span>
          </div>
        </div>

        {/* User or Guest */}
            <div className="flex items-center gap-3">
        {session?.user ? (
            <>
                {/* Logged-in user */}
                <span className="px-4 py-2 text-sm text-white rounded-lg bg-[#1c1e25]">
                    👤 {session.user.name}
                </span>

                <span className="px-4 py-2 text-sm text-yellow-400 rounded-lg bg-[#1c1e25]">
                    🪙 500 Chips
                </span>
            </>
        ) : (
            <>
                {/* Guest user */}
                <div
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{
                        background: '#1c1e25',
                        border: '1px solid #2a2d38'
                    }}
                >
                    <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: '#c0392b' }}
                    />

                    <span className="text-xs font-medium" style={{ color: '#e8e4dc', opacity: 0.7 }}>
                        Guest · $500 chips
                    </span>
                </div>

                <button
                    onClick={onSignUp}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:brightness-110"
                    style={{
                        background: 'linear-gradient(135deg, #c0392b, #8b1a1a)',
                        color: '#fff'
                    }}
                >
                    Sign Up to Save
                </button>
            </>
        )}
    </div>
      </header>

      <div className="relative z-10 flex-1 w-full px-6 py-8" style={{ maxWidth: '72rem', margin: '0 auto' }}>
        {/* Page title + create */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', color: '#e8e4dc', fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>
              Game Lobby
            </h1>
            <p className="text-sm mt-1" style={{ color: '#e8e4dc', opacity: 0.35 }}>
              {tables.filter(t => t.status !== 'full').length} tables with open seats
            </p>
          </div>
           <button
            onClick= { () => setShowCreateTable(true) }
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff', border: '1px solid #c0392b' }}
          >
            <span aria-hidden="true">+</span> Create Table
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Tables Active', value: '8' },
            { label: 'Players Online', value: '31' },
            { label: 'Biggest Pot', value: '$1,840' },
          ].map(s => (
            <div key={s.label} className="rounded-xl px-5 py-4" style={{ background: '#1c1e25', border: '1px solid #2a2d38' }}>
              <p className="text-xs mb-1" style={{ color: '#e8e4dc', opacity: 0.4 }}>{s.label}</p>
              <p className="text-xl font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#e8e4dc' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Quick rules reminder */}
        <div className="mb-6 flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ background: 'rgba(107,16,16,0.14)', border: '1px solid rgba(192,57,43,0.22)' }}>
          <div>
            <p className="text-xs font-semibold" style={{ color: '#e8e4dc' }}>New to five-card draw?</p>
            <p className="mt-0.5 text-xs" style={{ color: '#e8e4dc', opacity: 0.4 }}>Bet, replace your cards once, then reveal the best five-card hand.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#f0a097' }}>
            <span>Choose a table</span>
            <span style={{ opacity: 0.35 }}>→</span>
            <span>Draw once</span>
            <span style={{ opacity: 0.35 }}>→</span>
            <span>Win the pot</span>
          </div>
        </div>

        {/* Two-column layout: tables + ad sidebar */}
        <div className="flex gap-6 items-start">

          {/* Left: filters + tables */}
          <div className="flex-1 min-w-0">
          {/* My Tables: same cards and Take a Seat button as the public list */}
        {session?.user && myTables.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#e8e4dc' }}>
                ♠ My Tables
              </h2>
              <span className="px-2 py-1 text-xs rounded-md" style={{ background: '#1c1e25', color: '#c0392b' }}>
                {myTables.length} Hosted
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {myTables.map(table => {
            const isFull = table.status === 'full'
            const isHovered = hovered === `mine-${table.id}`
            return (
              <div
                key={table.id}
                onClick={() => !isFull && onJoin(table)}
                onMouseEnter={() => !isFull && setHovered(`mine-${table.id}`)}
                onMouseLeave={() => setHovered(null)}
                className="rounded-2xl p-5 transition-all duration-150 cursor-pointer"
                style={{
                  background: isHovered ? '#1f2029' : '#161820',
                  border: `1px solid ${isHovered ? 'rgba(192,57,43,0.45)' : '#222430'}`,
                  opacity: isFull ? 0.5 : 1,
                  cursor: isFull ? 'not-allowed' : 'pointer',
                  transform: isHovered ? 'translateY(-1px)' : 'none',
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-base leading-tight" style={{ fontFamily: 'var(--font-display)', color: '#e8e4dc' }}>
                      {table.name}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: '#e8e4dc', opacity: 0.35 }}>
                      Blinds {table.blind} · {table.hands} hands played
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-xs font-semibold" style={{ color: '#facc15' }}>★ Host</span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-md"
                      style={{
                        background: `${STAKE_COLORS[table.stakes]}22`,
                        color: STAKE_COLORS[table.stakes],
                        border: `1px solid ${STAKE_COLORS[table.stakes]}44`,
                      }}
                    >
                      {STAKE_LABELS[table.stakes]}
                    </span>
                    {isFull && (
                      <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: '#2a2d38', color: '#e8e4dc', opacity: 0.5 }}>
                        Full
                      </span>
                    )}
                    {table.status === 'waiting' && (
                      <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: '#1c2a1c', color: '#4ade80', border: '1px solid #22c55e44' }}>
                        Waiting
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1.5">
                    <SeatDots filled={table.players} max={table.max} />
                    <p className="text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>
                      {table.players}/{table.max} seated · avg pot {table.avgPot}
                    </p>
                  </div>
                 <div className="flex flex-col items-center gap-2">
    {!isFull && (
        <button
            onClick={e => {
                e.stopPropagation()
                onJoin(table)
            }}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
                background: isHovered
                    ? 'linear-gradient(135deg, #c0392b, #8b1a1a)'
                    : '#1c1e25',
                color: isHovered ? '#fff' : '#c0392b',
                border: `1px solid ${
                    isHovered
                        ? 'transparent'
                        : 'rgba(192,57,43,0.35)'
                }`
            }}
        >
            Take a Seat
        </button>
    )}

    <button
        onClick={e => {
            e.stopPropagation()
            handleDelete(String(table.id))
        }}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-125"
        style={{
            background: 'rgba(192,57,43,0.12)',
            color: '#ef4444',
            border: '1px solid rgba(192,57,43,0.35)'
        }}
    >
        Delete
    </button>
</div>
                </div>
              </div>
            )
          })}
            </div>
          </section>
        )}

        <h2 className="text-xl font-semibold mb-4" style={{ fontFamily: 'var(--font-display)', color: '#e8e4dc' }}>
          All Tables
        </h2>
        {/* Filters */}
        <div className="flex gap-2 mb-5">
          {(['all', 'low', 'medium', 'high'] as StakeFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filter === f ? '#c0392b' : '#1c1e25',
                color: filter === f ? '#fff' : '#e8e4dc',
                border: `1px solid ${filter === f ? '#c0392b' : '#2a2d38'}`,
                opacity: filter === f ? 1 : 0.6,
              }}
            >
              {f === 'all' ? 'All Tables' : STAKE_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Table grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(table => {
            const isFull = table.status === 'full'
            const isHovered = hovered === table.id
            return (
              <div
                key={table.id}
              //  onClick={() => !isFull && onJoin(table)}
                onMouseEnter={() => !isFull && setHovered(table.id)}
                onMouseLeave={() => setHovered(null)}
                className="rounded-2xl p-5 transition-all duration-150 cursor-pointer"
                style={{
                  background: isHovered ? '#1f2029' : '#161820',
                  border: `1px solid ${isHovered ? 'rgba(192,57,43,0.45)' : '#222430'}`,
                  opacity: isFull ? 0.5 : 1,
                  cursor: isFull ? 'not-allowed' : 'pointer',
                  transform: isHovered ? 'translateY(-1px)' : 'none',
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-base leading-tight" style={{ fontFamily: 'var(--font-display)', color: '#e8e4dc' }}>
                      {table.name}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: '#e8e4dc', opacity: 0.35 }}>
                      Blinds {table.blind} · {table.hands} hands played
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-md"
                      style={{
                        background: `${STAKE_COLORS[table.stakes]}22`,
                        color: STAKE_COLORS[table.stakes],
                        border: `1px solid ${STAKE_COLORS[table.stakes]}44`,
                      }}
                    >
                      {STAKE_LABELS[table.stakes]}
                    </span>
                    {isFull && (
                      <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: '#2a2d38', color: '#e8e4dc', opacity: 0.5 }}>
                        Full
                      </span>
                    )}
                    {table.status === 'waiting' && (
                      <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: '#1c2a1c', color: '#4ade80', border: '1px solid #22c55e44' }}>
                        Waiting
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1.5">
                    <SeatDots filled={table.players} max={table.max} />
                    <p className="text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>
                      {table.players}/{table.max} seated · avg pot {table.avgPot}
                    </p>
                  </div>
                  {!isFull && (
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        onJoin(table)
                      }}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: isHovered ? 'linear-gradient(135deg, #c0392b, #8b1a1a)' : '#1c1e25',
                        color: isHovered ? '#fff' : '#c0392b',
                        border: `1px solid ${isHovered ? 'transparent' : 'rgba(192,57,43,0.35)'}`,
                      }}
                    >
                      Take a Seat
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

          </div>{/* end left col */}

          {/* Right: ad sidebar */}
          <div className="w-64 shrink-0 flex flex-col gap-4 sticky top-6">

            {/* Earn chips header */}
            <div className="rounded-2xl px-5 py-4" style={{ background: '#161820', border: '1px solid #222430' }}>
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#c0392b' }}>Low on chips?</p>
              <p className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#e8e4dc' }}>Watch ads, earn chips</p>
              <p className="text-xs mt-1" style={{ color: '#e8e4dc', opacity: 0.35 }}>Free chips, no purchase needed</p>
            </div>

            <AdSlot
              chips="+500"
              label="Quick Ad"
              sub="15-second spot · one per hour"
              accent
            />
            <AdSlot
              chips="+1,500"
              label="Feature Ad"
              sub="30-second spot · unlimited"
            />
            <AdSlot
              chips="+5,000"
              label="Premium Ad"
              sub="60-second spot · big reward"
            />

            {/* Banner ad placeholder */}
            <div
              className="rounded-2xl flex flex-col items-center justify-center gap-2 py-8"
              style={{ background: '#161820', border: '1px dashed #2a2d38' }}
            >
              <span className="text-2xl opacity-20">📢</span>
              <p className="text-xs text-center" style={{ color: '#e8e4dc', opacity: 0.25 }}>Ad banner · 256×200</p>
            </div>

          </div>{/* end sidebar */}

        </div>{/* end two-col */}
      </div>

      {/* Bottom line */}
      {showCreateTable && (
        <TableCreation
          onClose={() => setShowCreateTable(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}