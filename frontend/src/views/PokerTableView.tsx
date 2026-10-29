import type { PokerTableData } from "./TableCreation";
import { useState, useEffect } from "react";
import { getGuest } from "../guestSession";
const STAKE_LABELS: Record<string, string> = { low: 'Low Stakes', medium: 'Mid Stakes', high: 'High Stakes' }


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
type PokerTableProps = {
  table: PokerTableData
  onLeave: () => void
  spectating?: boolean      // P3
  onTakeSeat?: () => void   // P3
}
type TableSeat = {
  kind: 'user' | 'guest';
  refid: string;
  displayName: string;
}
export function PokerTable({ table, onLeave, spectating = false, onTakeSeat }: PokerTableProps) {
  const seatOpen = table.players < table.max
  const watcherCount = table.spectators?.length ?? 1
  const [selected, setSelected] = useState<number[]>([2, 3, 4])
  const [hand, setHand] = useState<CardData[]>([])
  const [gameStarted, setGameStarted] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [gameId, setGameId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showTableMenu, setShowTableMenu] = useState(false)
  const [players, setPlayers] = useState<TableSeat[]>([])

  const PLAYER_POSITIONS = [
    "left-1/2 top-4 -translate-x-1/2",
    "right-3 top-[27%] sm:right-8",
    "right-4 bottom-[24%] sm:right-10",
    "left-4 bottom-[24%] sm:left-10",
    "left-3 top-[27%] sm:left-8"
];
  async function handleStartGame() {
      setIsStarting(true)

      try {
          const response = await fetch('/api/games', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({ 
                  tableId: table.id 
                })
              })

          const data = await response.json()

          if (!response.ok) {
              throw new Error('Failed to start game')
          }
          setGameId(data.game._id)
          setPlayers(data.seats);
          setGameStarted(true)
          console.log('Game started with ID:', data.game._id)

      } catch (error) {
        setError(
          error instanceof Error
          ? error.message
          : 'Unable to start game'
        )

      } finally {
          setIsStarting(false)
      }
  }
  function toggleCard(index: number) {
    if (complete || spectating) return
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
  async function handleLeaveTable() {
    console.log('1. Leave button')
    if(spectating) {
      onLeave();
      return;
    }
    try {
        const guest = getGuest();
        console.log('2. Guest info:', guest);
        const response = await fetch(`/api/tables/${table.id}/leave`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                guestId: guest?.id
            })
        });
        
        console.log('3. Backend response status:', response.status);

        const data = await response.json();

        console.log('4. Backend response:', data);

        if (!response.ok) {
            throw new Error(data.error || 'Failed to leave table');
        }

        console.log('Player removed from table:', data);

        // Return to the lobby after successful removal
        onLeave();

    } catch (error) {
        console.error('Error leaving table:', error);
    }
}
  useEffect(() => {
    async function fetchPlayers() {
        try {
            const response = await fetch(`/api/tables/${table.id}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch table players');
            }

            const data = await response.json();

            console.log('Table data:', data);

            setPlayers(data.seats || []);

        } catch (error) {
            console.error('Error fetching players:', error);
        }
    }

    fetchPlayers();

}, [table.id]);
  

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: '#090a0c' }}>
      <div className="pointer-events-none fixed inset-0" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 45%, rgba(90,10,10,0.3), transparent 72%)' }} />
      <header className="relative z-40 flex items-center justify-between border-b px-4 py-3 sm:px-6" style={{ background: 'rgba(10,10,11,0.9)', borderColor: '#222430', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-4">
          <button onClick={handleLeaveTable}  className="rounded-lg px-3 py-2 text-xs font-semibold hover:brightness-125" style={{ 
            backgroundColor: '#1c1e25',
                border: 'none',
                color: '#fff' }}>
            {spectating ? '← Stop watching' : '← Leave table'}
          </button>
          <div className="hidden h-5 w-px sm:block" style={{ background: '#2a2d38' }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>{table.name}</p>
            <p className="hidden text-xs sm:block" style={{ color: '#e8e4dc', opacity: 0.35 }}>5-card draw · Blinds {table.blind}</p>
          </div>
          {/* P7: only the host's copy of the table includes the code, so only the host sees this */}
          {table.isPrivate && table.inviteCode && (
            <div className="rounded-lg px-3 py-1.5" style={{ background: '#1c1e25', border: '1px dashed rgba(192,57,43,0.6)' }} title="Share this code so friends can join">
              <p className="text-[0.6rem] font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Invite code</p>
              <p className="text-sm font-bold" style={{ color: '#e8e4dc', letterSpacing: '0.18em' }}>{table.inviteCode}</p>
            </div>
          )}
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
              
              
              
              {!gameStarted ? (
                <div className="relative z-30 flex flex-col items-center gap-4">
                  <h2 className="text-2xl font-semibold" style={{ color: '#e8e4dc' }}
                  >
                    Waiting for Game 
                  </h2>
                  <button
                    onClick={handleStartGame}
                    disabled={isStarting||spectating}
                    className="rounded-xl px-8 py-4 text-lg font-semibold transition-all hover:brightness-125 disabled:opacity-50"
                    style={{
                      background: 'linear-gradient(135deg, #c0392b, #8b1a1a)',
                      color: '#fff',
                    }}
                    >
                      {isStarting ? 'Starting...' : 'Start Game'}
                    </button>
                    {error && (
                      <p className="test-sm text-red-400">{error}</p>
                    )}
                    </div>
                    ) : (
                      <>
                        <p className="test-xs uppercase tracking-[0.3em]"
                        style={{ color: '#e8e4dc', opacity: 0.5 }}
                        >
                          Current pot
                        </p>

                        <p
                        className="mt-1 text-3xl font-semibold"
                        style={{ color: '#e8e4dc' }}
                        >
                          $0
                          </p>
                          </>       
                    )}              
              
            </div>

            {players.map((player, index) => (
            <PlayerSeat
                key={`${player.kind}-${player.refid}`}
                name={player.displayName}
                chips="$500"
                dealer={index === 0}
                active={false}
                position={PLAYER_POSITIONS[index % PLAYER_POSITIONS.length]}
            />
            ))}
                  
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
                {spectating ? (
                  gameStarted ? <CardBacks count={5} /> : null
                ) : gameStarted && hand.length > 0 ? (
                   hand.map((card, index) => (
                  <PlayingCard key={`${card.rank}${card.suit}${index}`} card={card} selected={selected.includes(index)} onClick={() => toggleCard(index)} />
                ))
              ) : (
                <p className="text-sm font-semibold" style={{ color: '#e8e4dc'}}>
                  Waiting for cards...</p>
              )}
              </div>
              <div className="relative z-10 flex items-center gap-2 rounded-xl px-4 py-2 shadow-xl" style={{ background: '#17191f', border: '1px solid #c0392b' }}>
                <span className="text-xs font-semibold" style={{ color: '#e8e4dc' }}>Guest</span>
                <span className="text-xs" style={{ color: '#e8e4dc', opacity: 0.3 }}>·</span>
                <span className="text-xs font-semibold" style={{ color: '#f0a097' }}>$488</span>
              </div>
            </div>
          </div>

          {spectating ? (
            /* P3: what a spectator sees instead of their own hand and buttons */
            <div className="mt-3 flex flex-col items-center justify-between gap-3 rounded-2xl border p-3 sm:flex-row" style={{ background: '#14161b', borderColor: '#292c35' }}>
              <div className="flex items-center gap-3 px-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: 'rgba(192,57,43,0.16)', border: '1px solid rgba(192,57,43,0.45)', color: '#f0a097' }}>
                  👁
                </div>
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Spectating</p>
                  <p className="text-sm font-semibold" style={{ color: '#e8e4dc' }}>
                    {seatOpen ? `${table.max - table.players} seat${table.max - table.players === 1 ? '' : 's'} open` : 'Table is full'}
                  </p>
                  <p className="text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>
                    {watcherCount} watching · players' cards stay hidden
                  </p>
                </div>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  className="w-full rounded-xl px-7 py-3 text-sm font-semibold transition-all hover:brightness-110 sm:w-auto"
                  style={{ background: seatOpen ? 'linear-gradient(135deg, #c0392b, #8b1a1a)' : '#1c1e25', color: seatOpen ? '#fff' : '#e8e4dc', opacity: seatOpen ? 1 : 0.4, cursor: seatOpen ? 'pointer' : 'not-allowed' }}
                  disabled={!seatOpen}
                  onClick={onTakeSeat}
                >
                  {seatOpen ? 'Take a Seat' : 'No seats open'}
                </button>
              </div>
            </div>
          ) : (
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
          )}
        </div>

        <aside className="hidden w-60 shrink-0 flex-col gap-4 lg:flex">
          <div className="rounded-2xl border p-5" style={{ background: '#14161b', borderColor: '#292c35' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Table details</p>
            <div className="mt-4 space-y-3">
              {[['Game', '5-card draw'], ['Stakes', STAKE_LABELS[table.stakes]], ['Blinds', table.blind], ['Players', `${table.players} / ${table.max}`], ['Watching', String(watcherCount)]].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span style={{ color: '#e8e4dc', opacity: 0.35 }}>{label}</span>
                  <span className="font-medium" style={{ color: '#e8e4dc' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          {!spectating && (
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
          )}
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
