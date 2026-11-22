import { useState } from 'react'

export function AdSlot({
  adType,
  chips,
  label,
  sub,
  guestId,
  onChipsUpdated,
  accent = false,
}: {
  adType: 'quick' | 'feature' | 'premium'
  chips: string
  label: string
  sub: string
  guestId?: string
  onChipsUpdated: (chipamount: number) => void
  accent?: boolean
}) {
  const [claiming, setClaiming] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleClaim() {
    setClaiming(true)
    setError('')
    try {
      const response = await fetch('/api/players/me/ad-reward', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(guestId ? { 'x-guest-id': guestId } : {}),
        },
        body: JSON.stringify({ adType }),
      })
      const data = await response.json().catch(() => null) as {
        chipamount?: number
        error?: string
      } | null
      if (!response.ok || typeof data?.chipamount !== 'number') {
        throw new Error(data?.error ?? 'Could not add chips. Please try again.')
      }

      onChipsUpdated(data.chipamount)
      setDone(true)
      if (adType !== 'quick') {
        window.setTimeout(() => setDone(false), 1800)
      } else {
        window.setTimeout(() => setDone(false), 60 * 60 * 1000)
      }
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : 'Could not add chips. Please try again.')
    } finally {
      setClaiming(false)
    }
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
        <button onClick={handleClaim} disabled={claiming} className="w-full py-2 rounded-lg text-xs font-semibold transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }}>
          {claiming ? 'Adding chips…' : '▶ Get chips'}
        </button>
      )}
      {error && <p role="alert" className="text-xs" style={{ color: '#f0a097' }}>{error}</p>}
    </div>
  )
}
