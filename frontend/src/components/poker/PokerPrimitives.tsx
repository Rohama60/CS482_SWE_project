import type { CardData } from '../../pokerApi'

export function BetChips({
  amount,
  position,
  tone = 'red',
}: {
  amount: string
  position: string
  tone?: 'red' | 'black' | 'cream'
}) {
  const colors = {
    red: { face: '#c0392b', edge: '#f0a097' },
    black: { face: '#161820', edge: '#9ca0ad' },
    cream: { face: '#e8e4dc', edge: '#8b1a1a' },
  }[tone]

  return (
    <div className={`z-20 flex items-center gap-1.5 rounded-full px-2 py-1 ${position}`} style={{ background: 'rgba(8,8,10,0.62)', border: '1px solid rgba(232,228,220,0.12)' }}>
      <div className="relative h-6 w-7">
        {[0, 1, 2].map(i => (
          <span key={i} className="absolute left-0 h-5 w-5 rounded-full border-2" style={{ bottom: `${i * 3}px`, background: colors.face, borderColor: colors.edge, boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }} />
        ))}
      </div>
      <span className="text-xs font-bold" style={{ color: '#e8e4dc' }}>{amount}</span>
    </div>
  )
}

export function PotChips({ amount }: { amount: number }) {
  return (
    <div aria-label={`CurrentPot: $${amount}`}>
      <BetChips amount={`CurrentPot: $${amount}`} position="relative" tone="cream" />
    </div>
  )
}

export function CardBacks({ count = 5 }: { count?: number }) {
  return (
    <div className="flex -space-x-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-10 w-7 rounded border p-0.5 shadow-lg" style={{ background: '#eee9df', borderColor: '#0a0a0b', transform: `rotate(${(i - 2) * 4}deg)` }}>
          <div className="h-full w-full rounded-sm" style={{ background: 'repeating-linear-gradient(45deg, #6b1010 0 3px, #9d2a23 3px 6px)' }} />
        </div>
      ))}
    </div>
  )
}

export function PlayerSeat({
  name,
  chips,
  position,
  dealer = false,
  active = false,
  empty = false,
  showCards = false,
  blindLabel = '',
  blindAmount = 0,
  betAmount = 0,
}: {
  name: string
  chips?: string
  position: string
  dealer?: boolean
  active?: boolean
  empty?: boolean
  showCards?: boolean
  blindLabel?: string
  blindAmount?: number
  betAmount?: number
}) {
  return (
    <div className={`absolute z-20 flex flex-col items-center ${position}`}>
      <div className="absolute top-7 h-20 w-24 rounded-t-[2rem] border-2 shadow-2xl" style={{ background: active ? 'linear-gradient(145deg, #8b1a1a, #350707)' : 'linear-gradient(145deg, #4b1212, #1d090a)', borderColor: active ? '#c0392b' : '#691d1a', boxShadow: 'inset 0 0 18px rgba(0,0,0,0.55), 0 12px 24px rgba(0,0,0,0.55)' }}>
        <span className="absolute -left-2 bottom-1 h-7 w-3 rounded-full" style={{ background: '#2b0a0b', border: '1px solid #691d1a' }} />
        <span className="absolute -right-2 bottom-1 h-7 w-3 rounded-full" style={{ background: '#2b0a0b', border: '1px solid #691d1a' }} />
      </div>
      {!empty && showCards && <div className="relative z-10"><CardBacks /></div>}
      <div className="relative z-10 -mt-1 min-w-28 rounded-xl px-3 py-2 text-center shadow-xl" style={{ background: active ? 'linear-gradient(135deg, #6b1010, #450a0a)' : '#17191f', border: `1px solid ${active ? '#c0392b' : '#343743'}` }}>
        {dealer && <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold" style={{ background: '#eee9df', color: '#15171d' }}>D</span>}
        {empty ? (
          <span className="text-xs font-medium" style={{ color: '#e8e4dc', opacity: 0.35 }}>Open seat</span>
        ) : (
          <>
            <p className="truncate text-xs font-semibold" style={{ color: '#e8e4dc' }}>{name}</p>
            {blindLabel && <p className="mt-1 text-[0.65rem] font-bold" style={{ color: '#fbbf24' }}>{blindLabel} · ${blindAmount}</p>}
            <p className="mt-0.5 text-xs" style={{ color: active ? '#f0a097' : '#e8e4dc', opacity: active ? 1 : 0.45 }}>{chips}</p>
          </>
        )}
      </div>
      {!empty && betAmount > 0 && <div className="relative z-20 mt-3 -translate-y-4"><BetChips amount={`$${betAmount}`} position="relative" tone="red" /></div>}
    </div>
  )
}

export function PlayingCard({ card, selected = false, onClick }: { card: CardData; selected?: boolean; onClick?: () => void }) {
  const red = card.suit === '♥' || card.suit === '♦'
  return (
    <button onClick={onClick} className={`relative flex h-28 w-20 shrink-0 flex-col justify-between rounded-xl p-2.5 text-left shadow-2xl transition-all duration-200 sm:h-32 sm:w-24 ${selected ? '-translate-y-4' : 'hover:-translate-y-1'}`} style={{ background: 'linear-gradient(145deg, #fffdf8, #ded9cf)', border: selected ? '2px solid #e05c4e' : '2px solid rgba(255,255,255,0.5)', color: red ? '#b4232a' : '#15171d', boxShadow: selected ? '0 16px 30px rgba(192,57,43,0.35)' : '0 14px 28px rgba(0,0,0,0.45)' }} aria-pressed={selected} aria-label={`${card.rank} of ${card.suit}; ${selected ? 'selected to discard' : 'keep'}`}>
      <span className="text-lg font-bold leading-none" style={{ fontFamily: 'var(--font-display)' }}>{card.rank}</span>
      <span className="self-center text-3xl leading-none">{card.suit}</span>
      <span className="rotate-180 self-end text-lg font-bold leading-none" style={{ fontFamily: 'var(--font-display)' }}>{card.rank}</span>
    </button>
  )
}
