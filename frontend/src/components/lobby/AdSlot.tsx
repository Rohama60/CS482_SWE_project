import { useState } from 'react'

export function AdSlot({ chips, label, sub, accent = false }: { chips: string; label: string; sub: string; accent?: boolean }) {
  const [watching, setWatching] = useState(false)
  const [done, setDone] = useState(false)

  function handleWatch() {
    setWatching(true)
    setTimeout(() => { setWatching(false); setDone(true) }, 2000)
  }

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: accent ? 'linear-gradient(135deg, rgba(192,57,43,0.18) 0%, rgba(139,26,26,0.1) 100%)' : '#161820', border: `1px solid ${accent ? 'rgba(192,57,43,0.4)' : '#222430'}` }}>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: '#e8e4dc' }}>{chips}</span>
        <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: 'rgba(192,57,43,0.2)', color: '#c0392b', border: '1px solid rgba(192,57,43,0.3)' }}>+chips</span>
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: '#e8e4dc' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: '#e8e4dc', opacity: 0.4 }}>{sub}</p>
      </div>
      {done ? (
        <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#4ade80' }}>✓ Chips added to your stack!</div>
      ) : (
        <button onClick={handleWatch} disabled={watching} className="w-full py-2 rounded-lg text-xs font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }}>
          {watching ? '▶ Playing ad…' : '▶ Watch Ad'}
        </button>
      )}
    </div>
  )
}
