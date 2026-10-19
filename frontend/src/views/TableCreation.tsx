import { useState } from 'react'

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

const STAKE_COLORS: Record<string, string> = { low: '#22c55e', medium: '#f59e0b', high: '#c0392b' }
const STAKE_LABELS: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High' }

type PokerTableData = (typeof TABLES)[number]

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

export function TableCreation({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (table: PokerTableData) => void
}) {
  const [name, setName] = useState('Midnight Draw')
  const [stakes, setStakes] = useState<'low' | 'medium' | 'high'>('low')
  const [seats, setSeats] = useState(6)
  const [isPrivate, setIsPrivate] = useState(false)

  const blindByStake = { low: '1 / 2', medium: '5 / 10', high: '25 / 50' }
  const buyInByStake = { low: '$100', medium: '$500', high: '$2,500' }
  const tableName = name.trim() || 'Untitled Table'

  function handleCreate() {
    onCreate({
      id: Date.now(),
      name: tableName,
      stakes,
      blind: blindByStake[stakes],
      players: 1,
      max: seats,
      status: 'waiting',
      avgPot: '—',
      hands: 0,
    })
  }

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{ zIndex: 60, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="position-relative w-100 overflow-hidden rounded-2xl shadow-2xl"
        style={{ maxWidth: '58rem', background: '#13151b', border: '1px solid #34303a' }}
        onClick={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-table-title"
      >
        <div className="position-absolute top-0 start-0 w-100 h-px" style={{ background: 'linear-gradient(90deg, transparent, #c0392b, transparent)' }} />

        <div className="d-flex align-items-start justify-content-between px-4 px-md-5 py-4" style={{ borderBottom: '1px solid #292c35' }}>
          <div>
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Table setup</span>
              <span className="rounded-pill px-2 py-1" style={{ fontSize: '0.65rem', color: '#d5a39e', background: 'rgba(192,57,43,0.13)', border: '1px solid rgba(192,57,43,0.25)' }}>
                MOCKUP
              </span>
            </div>
            <h2 id="create-table-title" className="m-0 text-2xl font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>
              Create your table
            </h2>
            <p className="m-0 mt-1 text-sm" style={{ color: '#e8e4dc', opacity: 0.42 }}>Set the rules, invite players, and take the first seat.</p>
          </div>
          <button
            onClick={onClose}
            className="d-flex align-items-center justify-content-center rounded-circle border-0"
            style={{ width: '2.25rem', height: '2.25rem', background: '#22242c', color: '#e8e4dc' }}
            aria-label="Close table setup"
          >
            ×
          </button>
        </div>

        <div className="row g-0">
          <div className="col-12 col-lg-7 px-4 px-md-5 py-4">
            <div className="mb-4">
              <label htmlFor="table-name" className="d-flex justify-content-between mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: '#e8e4dc', opacity: 0.62 }}>
                <span>Table name</span>
                <span style={{ opacity: 0.45 }}>{name.length}/28</span>
              </label>
              <input
                id="table-name"
                value={name}
                maxLength={28}
                onChange={event => setName(event.target.value)}
                className="form-control py-3 px-3 shadow-none"
                style={{ background: '#0d0f13', borderColor: '#343743', color: '#e8e4dc' }}
              />
            </div>

            <fieldset className="mb-4">
              <legend className="mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: '#e8e4dc', opacity: 0.62 }}>Stakes</legend>
              <div className="row g-2">
                {(['low', 'medium', 'high'] as const).map(level => (
                  <div className="col-4" key={level}>
                    <button
                      type="button"
                      onClick={() => setStakes(level)}
                      className="w-100 rounded-xl p-3 text-start transition-all"
                      style={{
                        background: stakes === level ? 'rgba(192,57,43,0.16)' : '#17191f',
                        border: `1px solid ${stakes === level ? '#c0392b' : '#2d3039'}`,
                        color: '#e8e4dc',
                      }}
                      aria-pressed={stakes === level}
                    >
                      <span className="d-block text-xs font-semibold">{level === 'medium' ? 'Mid' : level[0].toUpperCase() + level.slice(1)}</span>
                      <span className="d-block mt-1" style={{ fontSize: '0.68rem', opacity: 0.4 }}>{blindByStake[level]} blinds</span>
                    </button>
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="row g-3 mb-4">
              <div className="col-6">
                <label htmlFor="table-seats" className="d-block mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: '#e8e4dc', opacity: 0.62 }}>Seats</label>
                <select
                  id="table-seats"
                  value={seats}
                  onChange={event => setSeats(Number(event.target.value))}
                  className="form-select py-3 shadow-none"
                  style={{ backgroundColor: '#0d0f13', borderColor: '#343743', color: '#e8e4dc' }}
                >
                  {[2, 3, 4, 5, 6].map(count => <option key={count} value={count}>{count} players</option>)}
                </select>
              </div>
              <div className="col-6">
                <span className="d-block mb-2 text-xs font-semibold uppercase tracking-widest" style={{ color: '#e8e4dc', opacity: 0.62 }}>Starting buy-in</span>
                <div className="rounded-lg px-3 py-3" style={{ background: '#0d0f13', border: '1px solid #343743', color: '#e8e4dc' }}>
                  {buyInByStake[stakes]}
                </div>
              </div>
            </div>

            <div className="d-flex align-items-center justify-content-between rounded-xl p-3" style={{ background: '#17191f', border: '1px solid #2d3039' }}>
              <div>
                <p className="m-0 text-sm font-semibold" style={{ color: '#e8e4dc' }}>Private table</p>
                <p className="m-0 mt-1" style={{ color: '#e8e4dc', opacity: 0.38, fontSize: '0.72rem' }}>Only players with your invite code can join.</p>
              </div>
              <div className="form-check form-switch m-0">
                <input
                  className="form-check-input shadow-none"
                  type="checkbox"
                  role="switch"
                  checked={isPrivate}
                  onChange={event => setIsPrivate(event.target.checked)}
                  aria-label="Make table private"
                />
              </div>
            </div>
          </div>

          <aside className="col-12 col-lg-5 p-4 p-md-5 d-flex flex-column" style={{ background: '#0d0f13', borderLeft: '1px solid #292c35' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#c0392b' }}>Table preview</p>
            <div className="rounded-2xl p-4 mb-3" style={{ background: 'linear-gradient(145deg, #21171a, #15171c)', border: '1px solid rgba(192,57,43,0.38)' }}>
              <div className="d-flex align-items-start justify-content-between gap-3">
                <div className="min-w-0">
                  <h3 className="m-0 text-lg font-semibold text-truncate" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>{tableName}</h3>
                  <p className="m-0 mt-1 text-xs" style={{ color: '#e8e4dc', opacity: 0.38 }}>5-card draw · Blinds {blindByStake[stakes]}</p>
                </div>
                <span className="text-xs font-semibold rounded-md px-2 py-1" style={{ color: STAKE_COLORS[stakes], background: `${STAKE_COLORS[stakes]}22`, border: `1px solid ${STAKE_COLORS[stakes]}44` }}>
                  {STAKE_LABELS[stakes]}
                </span>
              </div>
              <div className="d-flex align-items-center justify-content-between mt-4">
                <SeatDots filled={1} max={seats} />
                <span className="text-xs" style={{ color: '#e8e4dc', opacity: 0.4 }}>1/{seats} seated</span>
              </div>
            </div>

            <div className="d-flex flex-column gap-3 mb-4">
              {[
                ['Game', '5-card draw'],
                ['Access', isPrivate ? 'Invite only' : 'Public lobby'],
                ['Buy-in', buyInByStake[stakes]],
                ['Host seat', 'Reserved for you'],
              ].map(([label, value]) => (
                <div key={label} className="d-flex align-items-center justify-content-between text-xs">
                  <span style={{ color: '#e8e4dc', opacity: 0.38 }}>{label}</span>
                  <span className="font-medium" style={{ color: '#e8e4dc' }}>{value}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto">
              <button
                onClick={handleCreate}
                className="w-100 rounded-xl py-3 border-0 text-sm font-semibold transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }}
              >
                Create &amp; take a seat
              </button>
              <p className="text-center mt-2 mb-0" style={{ color: '#e8e4dc', opacity: 0.3, fontSize: '0.68rem' }}>No chips are charged in this mockup.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}