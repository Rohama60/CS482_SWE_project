import { useEffect, useState } from 'react'
import { getGameHistory, type GameHistoryData, type HistoryGame } from '../../historyApi'

// P13: As a Player, I want to be able to see the games that I have played,
// so that I can see how I've been doing.
// This is its own piece so it can sit on the History page now and move to the Profile page later.
// Styles are set here directly, since the project has no Tailwind.

const COLORS = {
  card: '#111318',
  border: '#292c35',
  text: '#e8e4dc',
  win: '#86efac',
  winBg: 'rgba(34,197,94,0.1)',
  winBorder: 'rgba(34,197,94,0.25)',
  loss: '#f0a097',
  lossBg: 'rgba(192,57,43,0.12)',
  lossBorder: 'rgba(192,57,43,0.35)',
}

// +$40, -$15, $0
export function formatChips(change: number) {
  if (change > 0) return `+$${change.toLocaleString()}`
  if (change < 0) return `-$${Math.abs(change).toLocaleString()}`
  return '$0'
}

export function formatPlayedAt(playedAt?: string) {
  if (!playedAt) return ''
  const date = new Date(playedAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function resultLabel(game: HistoryGame) {
  if (game.result === 'won') return 'Won'
  return game.folded ? 'Folded' : 'Lost'
}

export function GameHistory() {
  const [data, setData] = useState<GameHistoryData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getGameHistory()
      .then(history => { if (active) setData(history) })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load your game history') })
    return () => { active = false }
  }, [])

  if (error) {
    return (
      <p role="alert" className="rounded-xl text-sm" style={{ margin: 0, padding: '12px 16px', background: COLORS.lossBg, border: `1px solid ${COLORS.lossBorder}`, color: COLORS.loss }}>
        {error}
      </p>
    )
  }

  if (!data) {
    return <p className="text-sm" style={{ margin: 0, padding: '24px 0', textAlign: 'center', color: COLORS.text, opacity: 0.45 }}>Loading your games...</p>
  }

  const { stats, games } = data
  const statBoxes: [string, string][] = [
    ['Hands', String(stats.hands)],
    ['Wins', String(stats.wins)],
    ['Losses', String(stats.losses)],
    ['Win rate', stats.hands ? `${stats.winRate}%` : '-'],
    ['Chips', formatChips(stats.netChips)],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <dl aria-label="Your stats" style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
        {statBoxes.map(([label, value]) => (
          <div key={label} className="rounded-xl" style={{ padding: '12px 14px', background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
            <dt className="text-xs" style={{ color: COLORS.text, opacity: 0.4 }}>{label}</dt>
            <dd
              className="text-xl font-semibold"
              style={{
                margin: '4px 0 0',
                fontFamily: 'var(--font-display)',
                color: label === 'Chips' && stats.netChips !== 0 ? (stats.netChips > 0 ? COLORS.win : COLORS.loss) : COLORS.text,
              }}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="recent-games-title">
        <p id="recent-games-title" className="text-xs font-semibold uppercase tracking-widest" style={{ margin: '0 0 10px', color: '#c0392b' }}>
          Recent games
        </p>

        {games.length === 0 ? (
          <div className="rounded-xl" style={{ padding: '40px 16px', textAlign: 'center', background: COLORS.card, border: '1px dashed #343743' }}>
            <p className="text-sm font-semibold" style={{ margin: 0, color: COLORS.text }}>No games yet</p>
            <p className="text-xs" style={{ margin: '4px 0 0', color: COLORS.text, opacity: 0.35 }}>Finish a hand and it will show up here.</p>
          </div>
        ) : (
          <ul aria-label="Recent games" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {games.map(game => {
              const won = game.result === 'won'
              return (
                <li
                  key={game.id}
                  className="rounded-xl"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: COLORS.card, border: `1px solid ${COLORS.border}` }}
                >
                  <span
                    className="text-xs font-semibold rounded-lg"
                    style={{
                      flexShrink: 0, width: 58, textAlign: 'center', padding: '4px 0',
                      background: won ? COLORS.winBg : COLORS.lossBg,
                      border: `1px solid ${won ? COLORS.winBorder : COLORS.lossBorder}`,
                      color: won ? COLORS.win : COLORS.loss,
                    }}
                  >
                    {resultLabel(game)}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p className="text-sm font-semibold" style={{ margin: 0, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {game.tableName}
                      <span className="text-xs" style={{ marginLeft: 8, fontWeight: 400, opacity: 0.35 }}>{formatPlayedAt(game.playedAt)}</span>
                    </p>
                    <p className="text-xs" style={{ margin: '2px 0 0', color: COLORS.text, opacity: 0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {game.summary || `${game.players} players`}
                      {game.opponents.length > 0 && ` · vs ${game.opponents.join(', ')}`}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <p className="text-sm font-semibold" style={{ margin: 0, color: game.chipsChange > 0 ? COLORS.win : game.chipsChange < 0 ? COLORS.loss : COLORS.text }}>
                      {formatChips(game.chipsChange)}
                    </p>
                    {game.handName && (
                      <p className="text-xs" style={{ margin: '2px 0 0', color: COLORS.text, opacity: 0.4 }}>{game.handName}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
