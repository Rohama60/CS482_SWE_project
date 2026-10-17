import { useState } from 'react'
import Home from './pages/Home.tsx'
const SUITS = ['♠', '♥', '♦', '♣']

type StakeFilter = 'all' | 'low' | 'medium' | 'high'

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

const STAKE_LABELS: Record<string, string> = { low: 'Low Stakes', medium: 'Mid Stakes', high: 'High Stakes' }
const STAKE_COLORS: Record<string, string> = { low: '#22c55e', medium: '#f59e0b', high: '#c0392b' }

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

type PokerTableData = (typeof TABLES)[number]

function Lobby({ onBack, onJoin }: { onBack: () => void; onJoin: (table: PokerTableData) => void }) {
  const [filter, setFilter] = useState<StakeFilter>('all')
  const [hovered, setHovered] = useState<number | null>(null)

  const filtered = filter === 'all' ? TABLES : TABLES.filter(t => t.stakes === filter)

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
            className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
            style={{ color: '#e8e4dc', opacity: 0.5 }}
          >
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

        {/* Guest badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#1c1e25', border: '1px solid #2a2d38' }}>
            <div className="w-2 h-2 rounded-full" style={{ background: '#c0392b' }} />
            <span className="text-xs font-medium" style={{ color: '#e8e4dc', opacity: 0.7 }}>Guest · $500 chips</span>
          </div>
          <button
            className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }}
          >
            Sign Up to Save
          </button>
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
              {TABLES.filter(t => t.status !== 'full').length} tables with open seats
            </p>
          </div>
          <div className="relative group">
            <button
              disabled
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-not-allowed"
              style={{ background: '#1c1e25', color: '#e8e4dc', border: '1px solid #2a2d38', opacity: 0.45 }}
            >
              + Create Table
            </button>
            <div
              className="absolute right-0 top-full mt-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20"
              style={{ background: '#1c1e25', border: '1px solid #2a2d38', color: '#e8e4dc' }}
            >
              🔒 Sign up to create tables
            </div>
          </div>
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
                onClick={() => !isFull && onJoin(table)}
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
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #c0392b 30%, #c0392b 70%, transparent)' }} />
    </div>
  )
}

type CardData = { rank: string; suit: string }

const STARTING_HAND: CardData[] = [
  { rank: 'A', suit: '♠' },
  { rank: 'A', suit: '♥' },
  { rank: '10', suit: '♦' },
  { rank: '7', suit: '♣' },
  { rank: '3', suit: '♥' },
]

const DRAWN_HAND: CardData[] = [
  { rank: 'A', suit: '♠' },
  { rank: 'A', suit: '♥' },
  { rank: 'A', suit: '♦' },
  { rank: 'K', suit: '♣' },
  { rank: '3', suit: '♠' },
]

function PlayingCard({
  card,
  selected = false,
  onClick,
}: {
  card: CardData
  selected?: boolean
  onClick?: () => void
}) {
  const red = card.suit === '♥' || card.suit === '♦'
  return (
    <button
      onClick={onClick}
      className={`relative flex h-28 w-20 shrink-0 flex-col justify-between rounded-xl p-2.5 text-left shadow-2xl transition-all duration-200 sm:h-32 sm:w-24 ${
        selected ? '-translate-y-4' : 'hover:-translate-y-1'
      }`}
      style={{
        background: 'linear-gradient(145deg, #fffdf8, #ded9cf)',
        border: selected ? '2px solid #e05c4e' : '2px solid rgba(255,255,255,0.5)',
        color: red ? '#b4232a' : '#15171d',
        boxShadow: selected ? '0 16px 30px rgba(192,57,43,0.35)' : '0 14px 28px rgba(0,0,0,0.45)',
      }}
      aria-pressed={selected}
      aria-label={`${card.rank} of ${card.suit}; ${selected ? 'selected to discard' : 'keep'}`}
    >
      <span className="text-lg font-bold leading-none" style={{ fontFamily: 'var(--font-display)' }}>{card.rank}</span>
      <span className="self-center text-3xl leading-none">{card.suit}</span>
      <span className="rotate-180 self-end text-lg font-bold leading-none" style={{ fontFamily: 'var(--font-display)' }}>{card.rank}</span>
    </button>
  )
}

function CardBacks({ count = 5 }: { count?: number }) {
  return (
    <div className="flex -space-x-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-10 w-7 rounded border p-0.5 shadow-lg"
          style={{
            background: '#eee9df',
            borderColor: '#0a0a0b',
            transform: `rotate(${(i - 2) * 4}deg)`,
          }}
        >
          <div className="h-full w-full rounded-sm" style={{ background: 'repeating-linear-gradient(45deg, #6b1010 0 3px, #9d2a23 3px 6px)' }} />
        </div>
      ))}
    </div>
  )
}

function PlayerSeat({
  name,
  chips,
  position,
  dealer = false,
  active = false,
  empty = false,
}: {
  name: string
  chips?: string
  position: string
  dealer?: boolean
  active?: boolean
  empty?: boolean
}) {
  return (
    <div className={`absolute z-20 flex flex-col items-center ${position}`}>
      <div
        className="absolute top-7 h-20 w-24 rounded-t-[2rem] border-2 shadow-2xl"
        style={{
          background: active ? 'linear-gradient(145deg, #8b1a1a, #350707)' : 'linear-gradient(145deg, #4b1212, #1d090a)',
          borderColor: active ? '#c0392b' : '#691d1a',
          boxShadow: 'inset 0 0 18px rgba(0,0,0,0.55), 0 12px 24px rgba(0,0,0,0.55)',
        }}
      >
        <span className="absolute -left-2 bottom-1 h-7 w-3 rounded-full" style={{ background: '#2b0a0b', border: '1px solid #691d1a' }} />
        <span className="absolute -right-2 bottom-1 h-7 w-3 rounded-full" style={{ background: '#2b0a0b', border: '1px solid #691d1a' }} />
      </div>
      {!empty && <div className="relative z-10"><CardBacks /></div>}
      <div
        className="relative z-10 -mt-1 min-w-28 rounded-xl px-3 py-2 text-center shadow-xl"
        style={{
          background: active ? 'linear-gradient(135deg, #6b1010, #450a0a)' : '#17191f',
          border: `1px solid ${active ? '#c0392b' : '#343743'}`,
        }}
      >
        {dealer && (
          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold" style={{ background: '#eee9df', color: '#15171d' }}>
            D
          </span>
        )}
        {empty ? (
          <span className="text-xs font-medium" style={{ color: '#e8e4dc', opacity: 0.35 }}>Open seat</span>
        ) : (
          <>
            <p className="truncate text-xs font-semibold" style={{ color: '#e8e4dc' }}>{name}</p>
            <p className="mt-0.5 text-xs" style={{ color: active ? '#f0a097' : '#e8e4dc', opacity: active ? 1 : 0.45 }}>{chips}</p>
          </>
        )}
      </div>
    </div>
  )
}

function BetChips({ amount, position, tone = 'red' }: { amount: string; position: string; tone?: 'red' | 'black' | 'cream' }) {
  const colors = {
    red: { face: '#c0392b', edge: '#f0a097' },
    black: { face: '#161820', edge: '#9ca0ad' },
    cream: { face: '#e8e4dc', edge: '#8b1a1a' },
  }[tone]

  return (
    <div className={`absolute z-20 flex items-center gap-1.5 rounded-full px-2 py-1 ${position}`} style={{ background: 'rgba(8,8,10,0.62)', border: '1px solid rgba(232,228,220,0.12)' }}>
      <div className="relative h-6 w-7">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="absolute left-0 h-5 w-5 rounded-full border-2"
            style={{ bottom: `${i * 3}px`, background: colors.face, borderColor: colors.edge, boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          />
        ))}
      </div>
      <span className="text-xs font-bold" style={{ color: '#e8e4dc' }}>{amount}</span>
    </div>
  )
}

function PokerTable({ table, onLeave }: { table: PokerTableData; onLeave: () => void }) {
  const [selected, setSelected] = useState<number[]>([2, 3, 4])
  const [hand, setHand] = useState<CardData[]>(STARTING_HAND)
  const [complete, setComplete] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  function toggleCard(index: number) {
    if (complete) return
    setSelected(current => current.includes(index) ? current.filter(i => i !== index) : [...current, index])
  }

  function draw() {
    setHand(current => current.map((card, index) => selected.includes(index) ? DRAWN_HAND[index] : card))
    setSelected([])
    setComplete(true)
  }

  function newHand() {
    setHand(STARTING_HAND)
    setSelected([2, 3, 4])
    setComplete(false)
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: '#090a0c' }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(90,10,10,0.3), transparent 72%)' }} />
      <header className="relative z-40 flex items-center justify-between border-b px-4 py-3 sm:px-6" style={{ background: 'rgba(10,10,11,0.9)', borderColor: '#222430', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-4">
          <button onClick={onLeave} className="text-sm transition-opacity hover:opacity-100" style={{ color: '#e8e4dc', opacity: 0.5 }}>
            ← Leave table
          </button>
          <div className="hidden h-5 w-px sm:block" style={{ background: '#2a2d38' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>{table.name}</p>
            <p className="hidden text-xs sm:block" style={{ color: '#e8e4dc', opacity: 0.35 }}>5-card draw · Blinds {table.blind}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>Your balance</p>
            <p className="text-sm font-semibold" style={{ color: '#e8e4dc' }}>$500</p>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all hover:brightness-125"
            style={{ background: '#1c1e25', border: '1px solid #c0392b', color: '#e8e4dc' }}
            aria-label="How to play"
            title="How to play"
          >
            ?
          </button>
          <button className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: '#1c1e25', border: '1px solid #2a2d38', color: '#e8e4dc' }}>
            Table menu
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-7xl gap-5 px-3 py-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: '#4ade80' }} />
              <span className="text-xs font-medium uppercase tracking-widest" style={{ color: '#e8e4dc', opacity: 0.45 }}>Hand in progress</span>
            </div>
            <span className="text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>Hand #143</span>
          </div>

          <div className="relative min-h-[36rem] overflow-hidden rounded-[2rem] border sm:min-h-[40rem]" style={{ background: '#111318', borderColor: '#292c35' }}>
            <div className="absolute inset-x-[8%] bottom-[19%] top-[14%] rounded-[48%] border-[10px] shadow-2xl sm:inset-x-[12%]" style={{ background: 'radial-gradient(ellipse at center, #8f231f 0%, #681512 58%, #3b0909 100%)', borderColor: '#160607', boxShadow: 'inset 0 0 70px rgba(0,0,0,0.48), 0 25px 60px rgba(0,0,0,0.7), 0 0 0 3px #7b2a24, 0 0 0 8px #260909' }}>
              <div className="absolute inset-4 rounded-[48%] border" style={{ borderColor: 'rgba(232,228,220,0.08)' }} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pb-10">
                <p className="text-xs uppercase tracking-[0.3em]" style={{ color: '#e8e4dc', opacity: 0.25 }}>Current pot</p>
                <p className="mt-1 text-3xl font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>$36</p>
                <div className="mt-4 flex -space-x-2">
                  {['#c0392b', '#111318', '#e8e4dc', '#c0392b', '#111318'].map((color, i) => (
                    <span key={i} className="h-7 w-7 rounded-full border-2" style={{ background: color, borderColor: '#e8e4dc', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }} />
                  ))}
                </div>
                <p className="mt-3 text-[0.65rem] uppercase tracking-widest" style={{ color: '#e8e4dc', opacity: 0.3 }}>All table bets collect here</p>
              </div>
            </div>

            <PlayerSeat name="RiverRat" chips="$1,240" dealer position="left-1/2 top-4 -translate-x-1/2" />
            <PlayerSeat name="Mara" chips="$680" position="right-3 top-[27%] sm:right-8" />
            <PlayerSeat name="Theo" chips="$2,110" active position="right-4 bottom-[24%] sm:right-10" />
            <PlayerSeat name="Jax" chips="$445" position="left-4 bottom-[24%] sm:left-10" />
            <PlayerSeat name="Nighthawk" chips="$925" position="left-3 top-[27%] sm:left-8" />

            <BetChips amount="$2" position="left-1/2 top-[25%] -translate-x-1/2" tone="cream" />
            <BetChips amount="$8" position="right-[18%] top-[39%]" tone="black" />
            <BetChips amount="$8" position="right-[20%] bottom-[35%]" />
            <BetChips amount="$2" position="left-[18%] top-[39%]" tone="cream" />
            <BetChips amount="$8" position="left-[20%] bottom-[35%]" tone="black" />
            <BetChips amount="Your bet · $8" position="bottom-[24%] left-1/2 -translate-x-1/2" />

            <div className="absolute inset-x-0 bottom-3 z-30 flex flex-col items-center">
              <div
                className="absolute -bottom-8 h-36 w-72 rounded-t-[4rem] border-2"
                style={{
                  background: 'linear-gradient(145deg, #6b1010, #260909)',
                  borderColor: '#9d2a23',
                  boxShadow: 'inset 0 0 28px rgba(0,0,0,0.55), 0 15px 30px rgba(0,0,0,0.65)',
                }}
              />
              <div className="relative z-10 mb-2 flex items-end justify-center -space-x-1 sm:space-x-1">
                {hand.map((card, index) => (
                  <PlayingCard key={`${card.rank}${card.suit}${index}`} card={card} selected={selected.includes(index)} onClick={() => toggleCard(index)} />
                ))}
              </div>
              <div className="relative z-10 flex items-center gap-2 rounded-xl px-4 py-2 shadow-xl" style={{ background: '#17191f', border: '1px solid #c0392b' }}>
                <span className="text-xs font-semibold" style={{ color: '#e8e4dc' }}>Guest</span>
                <span className="text-xs" style={{ color: '#e8e4dc', opacity: 0.3 }}>·</span>
                <span className="text-xs font-semibold" style={{ color: '#f0a097' }}>$488</span>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col items-center justify-between gap-3 rounded-2xl border p-3 sm:flex-row" style={{ background: '#14161b', borderColor: '#292c35' }}>
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: 'rgba(192,57,43,0.16)', border: '1px solid rgba(192,57,43,0.45)', color: '#f0a097' }}>
                ♠
              </div>
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Your hand</p>
                <p className="text-sm font-semibold" style={{ color: complete ? '#4ade80' : '#e8e4dc' }}>
                  {complete ? 'Three of a kind — Aces' : 'One pair — Aces'}
                </p>
                <p className="text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>
                  {complete
                    ? 'Three aces with a king kicker'
                    : selected.length
                      ? `${selected.length} cards marked to discard`
                      : 'A pair of aces with a 10 kicker'}
                </p>
              </div>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              {!complete ? (
                <>
                  <button className="flex-1 rounded-xl px-5 py-3 text-sm font-semibold sm:flex-none" style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }} onClick={() => { setSelected([]); setComplete(true) }}>
                    Stand pat
                  </button>
                  <button className="flex-1 rounded-xl px-7 py-3 text-sm font-semibold transition-all hover:brightness-110 sm:flex-none" style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }} onClick={draw}>
                    {selected.length ? `Draw ${selected.length}` : 'Draw'}
                  </button>
                </>
              ) : (
                <button className="w-full rounded-xl px-7 py-3 text-sm font-semibold transition-all hover:brightness-110 sm:w-auto" style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }} onClick={newHand}>
                  Deal next hand
                </button>
              )}
            </div>
          </div>
        </div>

        <aside className="hidden w-60 shrink-0 flex-col gap-4 lg:flex">
          <div className="rounded-2xl border p-5" style={{ background: '#14161b', borderColor: '#292c35' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Table details</p>
            <div className="mt-4 space-y-3">
              {[['Game', '5-card draw'], ['Stakes', STAKE_LABELS[table.stakes]], ['Blinds', table.blind], ['Players', '6 / 6']].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span style={{ color: '#e8e4dc', opacity: 0.35 }}>{label}</span>
                  <span className="font-medium" style={{ color: '#e8e4dc' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border p-5" style={{ background: 'linear-gradient(145deg, rgba(107,16,16,0.42), rgba(28,30,37,0.8))', borderColor: 'rgba(192,57,43,0.45)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Your hand</p>
            <p className="mt-2 text-lg font-semibold" style={{ color: complete ? '#4ade80' : '#e8e4dc', fontFamily: 'var(--font-display)' }}>
              {complete ? 'Three Aces' : 'Pair of Aces'}
            </p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.4 }}>
              {complete ? 'Three cards of the same rank. This beats two pair.' : 'Two cards of the same rank. Try drawing three cards to improve.'}
            </p>
            <button onClick={() => setShowHelp(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold" style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }}>
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[0.65rem]" style={{ border: '1px solid #c0392b', color: '#f0a097' }}>?</span>
              How to play
            </button>
          </div>
          <div className="flex-1 rounded-2xl border p-5" style={{ background: '#14161b', borderColor: '#292c35' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Table activity</p>
            <div className="mt-4 space-y-4">
              <p className="text-xs leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.45 }}><strong style={{ color: '#e8e4dc' }}>Theo</strong> raised to $8</p>
              <p className="text-xs leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.45 }}><strong style={{ color: '#e8e4dc' }}>Guest</strong> called $8</p>
              <p className="text-xs leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.45 }}><strong style={{ color: '#e8e4dc' }}>Mara</strong> folded</p>
              <div className="border-t pt-4" style={{ borderColor: '#292c35' }}>
                <p className="text-xs italic leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.3 }}>Select the cards you want to replace, then draw.</p>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }} onClick={() => setShowHelp(false)}>
          <div className="relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl sm:p-8" style={{ background: '#17191f', borderColor: '#3a2528' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowHelp(false)} className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-sm" style={{ background: '#22242c', color: '#e8e4dc' }} aria-label="Close how to play">
              ✕
            </button>
            <p className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: '#c0392b' }}>Quick guide</p>
            <h2 className="mt-2 text-2xl font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>How to play 5-card draw</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ['1', 'Bet', 'Players bet chips based on the five cards they were dealt.'],
                ['2', 'Draw', 'Select cards you do not want, then draw replacements once.'],
                ['3', 'Showdown', 'The best five-card poker hand wins everything in the pot.'],
              ].map(([number, title, copy]) => (
                <div key={number} className="rounded-xl border p-4" style={{ background: '#111318', borderColor: '#292c35' }}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: '#6b1010', color: '#f0a097' }}>{number}</span>
                  <p className="mt-3 text-sm font-semibold" style={{ color: '#e8e4dc' }}>{title}</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.4 }}>{copy}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-xl border p-4" style={{ background: 'rgba(107,16,16,0.18)', borderColor: 'rgba(192,57,43,0.3)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Hands, strongest to weakest</p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.72 }}>
                Royal flush · Straight flush · Four of a kind · Full house · Flush · Straight · Three of a kind · Two pair · One pair · High card
              </p>
            </div>
            <button onClick={() => setShowHelp(false)} className="mt-6 w-full rounded-xl py-3 text-sm font-semibold transition-all hover:brightness-110" style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FloatingCard({ suit, rank, style }: { suit: string; rank: string; style: React.CSSProperties }) {
  const isRed = suit === '♥' || suit === '♦'
  return (
    <div className="absolute select-none pointer-events-none" style={style}>
      <div
        className="w-16 h-24 rounded-lg flex flex-col justify-between p-2 shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, #1c1e25 0%, #131418 100%)',
          border: '1px solid #2a2d38',
        }}
      >
        <span className="text-xs font-bold leading-none" style={{ color: isRed ? '#c0392b' : '#e8e4dc', fontFamily: 'var(--font-display)' }}>{rank}</span>
        <span className="text-2xl text-center leading-none" style={{ color: isRed ? '#c0392b' : '#e8e4dc' }}>{suit}</span>
        <span className="text-xs font-bold leading-none self-end rotate-180" style={{ color: isRed ? '#c0392b' : '#e8e4dc', fontFamily: 'var(--font-display)' }}>{rank}</span>
      </div>
    </div>
  )
}

type View = 'home' | 'login' | 'signup' | 'lobby' | 'table'

function LoginModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="relative w-full max-w-sm mx-4 rounded-2xl p-8" style={{ background: '#1c1e25', border: '1px solid #2a2d38' }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-xl opacity-40 hover:opacity-80 transition-opacity" style={{ color: '#e8e4dc' }}>✕</button>
        <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: 'var(--font-display)', color: '#c0392b' }}>Welcome back</h2>
        <p className="text-sm mb-6 opacity-50" style={{ color: '#e8e4dc' }}>Sign in to your account</p>
        <div className="space-y-4">
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
            Sign In
          </button>
        </div>
        <p className="text-center text-xs mt-5 opacity-40" style={{ color: '#e8e4dc' }}>
          Don't have an account?{' '}
          <span className="underline cursor-pointer" style={{ color: '#c0392b', opacity: 1 }}>Create one</span>
        </p>
      </div>
    </div>
  )
}

function SignupModal({ onClose }: { onClose: () => void }) {
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

export default function App() {
  const [view, setView] = useState<View>('home')
  const [selectedTable, setSelectedTable] = useState<PokerTableData>(TABLES[0])

  if (view === 'lobby') {
    return (
      <Lobby
        onBack={() => setView('home')}
        onJoin={table => {
          setSelectedTable(table)
          setView('table')
        }}
      />
    )
  }
  
  if (view === 'table') return <PokerTable table={selectedTable} onLeave={() => setView('lobby')} />

 

  return  <Home view={view}  /> 
}
