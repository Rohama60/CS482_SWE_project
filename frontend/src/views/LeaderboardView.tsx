'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ProfileUser } from './ProfileTab'

type LeaderboardPlayer = {
  id: string | number
  name: string
  chips: number
  handsPlayed: number
  wins: number
}

type Ranking = 'wins' | 'chips' | 'winRate'

const MEDALS = ['#e7c86e', '#b9c0ca', '#b8784e']

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function winRate(player: LeaderboardPlayer) {
  return player.handsPlayed ? (player.wins / player.handsPlayed) * 100 : 0
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

export default function LeaderboardView({
  currentUser,
  onBack,
  onProfile,
  onLogout,
}: {
  currentUser: ProfileUser | null
  onBack: () => void
  onProfile: () => void
  onLogout: () => void
}) {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([])
  const [ranking, setRanking] = useState<Ranking>('wins')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadLeaderboard() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch('/api/leaderboard', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Unable to load leaderboard')
        const data = (await response.json()) as { players?: LeaderboardPlayer[] }
        setPlayers(data.players ?? [])
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') {
          setError('The rankings could not be loaded. Please try again.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadLeaderboard()
    return () => controller.abort()
  }, [])

  const rankedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (ranking === 'chips') return b.chips - a.chips || b.wins - a.wins
      if (ranking === 'winRate') return winRate(b) - winRate(a) || b.wins - a.wins
      return b.wins - a.wins || b.chips - a.chips
    })
  }, [players, ranking])

  const podium = rankedPlayers.slice(0, 3)
  const totalHands = players.reduce((sum, player) => sum + player.handsPlayed, 0)
  const currentRank = currentUser
    ? rankedPlayers.findIndex((player) => String(player.id) === String(currentUser.id)) + 1
    : 0

  const rankingLabel = ranking === 'chips' ? 'chips' : ranking === 'winRate' ? 'win rate' : 'wins'

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: '#0a0a0b' }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 72% 48% at 50% 0%, rgba(90,10,10,.52), transparent 72%)',
        }}
      />
      <div
        className="absolute left-0 right-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, #c0392b 30%, #c0392b 70%, transparent)',
        }}
      />

      <header
        className="relative z-20 border-b px-5 py-4 sm:px-8"
        style={{
          background: 'rgba(10,10,11,.88)',
          borderColor: '#22242c',
          backdropFilter: 'blur(14px)',
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }}
          >
            <span aria-hidden="true">←</span> Back to lobby
          </button>
          <div className="flex items-center gap-2.5">
            <span style={{ color: '#c0392b' }}>♠</span>
            <span
              className="text-sm font-semibold uppercase tracking-[.2em]"
              style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}
            >
              Royal Draw
            </span>
          </div>
          {currentUser ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onProfile}
                className="rounded-lg px-3 py-2 text-xs font-semibold"
                style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }}
              >
                Profile
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-lg px-3 py-2 text-xs font-semibold"
                style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <span className="text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>
              Guest rankings
            </span>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-7 d-flex flex-column flex-md-row align-items-md-end justify-content-between gap-4">
          <div>
            <p
              className="mb-2 text-xs font-semibold uppercase tracking-widest"
              style={{ color: '#c0392b' }}
            >
              Hall of cards
            </p>
            <h1
              className="m-0 text-3xl font-semibold"
              style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}
            >
              Royal leaderboard
            </h1>
            <p className="mt-2 mb-0 text-sm" style={{ color: '#e8e4dc', opacity: 0.38 }}>
              The sharpest five-card draw players at the tables.
            </p>
          </div>
          <div className="d-flex gap-2" role="tablist" aria-label="Leaderboard ranking">
            {(
              [
                ['wins', 'Most wins'],
                ['chips', 'Chip leaders'],
                ['winRate', 'Win rate'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setRanking(value)}
                className="rounded-lg px-3 py-2 text-xs font-semibold"
                style={{
                  background: ranking === value ? '#c0392b' : '#1c1e25',
                  border: `1px solid ${ranking === value ? '#c0392b' : '#343743'}`,
                  color: '#fff',
                  opacity: ranking === value ? 1 : 0.58,
                }}
                role="tab"
                aria-selected={ranking === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!loading && !error && podium.length > 0 && (
          <section className="mb-6">
            <div className="row g-3 align-items-end">
              {podium.map((player, index) => (
                <div
                  key={player.id}
                  className={`col-12 col-md-4 ${index === 0 ? 'order-md-2' : index === 1 ? 'order-md-1' : 'order-md-3'}`}
                >
                  <div
                    className="position-relative overflow-hidden rounded-2xl p-4 text-center"
                    style={{
                      background:
                        index === 0
                          ? 'linear-gradient(180deg, rgba(192,57,43,.2), #15171c)'
                          : '#15171c',
                      border: `1px solid ${index === 0 ? 'rgba(192,57,43,.6)' : '#292c35'}`,
                      minHeight: index === 0 ? '13.5rem' : '12rem',
                    }}
                  >
                    <span
                      className="position-absolute top-0 start-50 translate-middle-x px-3 py-1 rounded-bottom"
                      style={{
                        background: MEDALS[index],
                        color: '#111',
                        fontSize: '.68rem',
                        fontWeight: 800,
                      }}
                    >
                      #{index + 1}
                    </span>
                    <div
                      className="mx-auto mt-3 d-flex align-items-center justify-content-center rounded-circle font-bold"
                      style={{
                        width: index === 0 ? '4.75rem' : '4rem',
                        height: index === 0 ? '4.75rem' : '4rem',
                        background: 'linear-gradient(145deg, #6b1010, #21080a)',
                        border: `2px solid ${MEDALS[index]}`,
                        color: '#fff',
                        boxShadow: `0 0 30px ${MEDALS[index]}25`,
                      }}
                    >
                      {initials(player.name)}
                    </div>
                    <h2
                      className="mt-3 mb-1 text-lg font-semibold text-truncate"
                      style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}
                    >
                      {player.name}
                    </h2>
                    <p
                      className="m-0 text-2xl font-semibold"
                      style={{ color: MEDALS[index], fontFamily: 'var(--font-display)' }}
                    >
                      {ranking === 'chips'
                        ? formatNumber(player.chips)
                        : ranking === 'winRate'
                          ? `${winRate(player).toFixed(1)}%`
                          : formatNumber(player.wins)}
                    </p>
                    <p
                      className="mt-1 mb-0 text-xs text-uppercase"
                      style={{ color: '#e8e4dc', opacity: 0.35, letterSpacing: '.1em' }}
                    >
                      {rankingLabel}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="row g-3 mb-4">
          {[
            ['Ranked players', formatNumber(players.length)],
            ['Hands recorded', formatNumber(totalHands)],
            ['Your rank', currentRank ? `#${currentRank}` : '—'],
          ].map(([label, value]) => (
            <div className="col-4" key={label}>
              <div
                className="rounded-xl px-3 px-sm-4 py-3"
                style={{ background: '#15171c', border: '1px solid #292c35' }}
              >
                <p className="m-0 text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>
                  {label}
                </p>
                <p
                  className="mt-1 mb-0 text-lg font-semibold"
                  style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}
                >
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <section
          className="overflow-hidden rounded-2xl"
          style={{ background: '#14161b', border: '1px solid #292c35' }}
          aria-live="polite"
        >
          <div
            className="d-flex align-items-center justify-content-between px-4 px-sm-5 py-4 border-bottom"
            style={{ borderColor: '#292c35' }}
          >
            <div>
              <p
                className="m-0 text-xs font-semibold text-uppercase tracking-widest"
                style={{ color: '#c0392b' }}
              >
                All contenders
              </p>
              <p className="mt-1 mb-0 text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>
                Ranked by {rankingLabel}
              </p>
            </div>
            <span
              className="rounded-pill px-3 py-1 text-xs"
              style={{
                background: 'rgba(74,222,128,.08)',
                border: '1px solid rgba(74,222,128,.2)',
                color: '#86efac',
              }}
            >
              Live stats
            </span>
          </div>

          {loading && (
            <div className="p-5 text-center text-sm" style={{ color: '#e8e4dc', opacity: 0.5 }}>
              Shuffling the rankings…
            </div>
          )}
          {error && (
            <div className="p-5 text-center text-sm" style={{ color: '#f0a097' }}>
              {error}
            </div>
          )}
          {!loading && !error && !rankedPlayers.length && (
            <div className="p-5 text-center">
              <p className="mb-1 text-sm font-semibold" style={{ color: '#e8e4dc' }}>
                No ranked players yet
              </p>
              <p className="m-0 text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>
                The first completed games will set the board.
              </p>
            </div>
          )}
          {!loading &&
            !error &&
            rankedPlayers.map((player, index) => {
              const isCurrentPlayer = currentUser && String(currentUser.id) === String(player.id)
              return (
                <div
                  key={player.id}
                  className="d-grid align-items-center gap-3 px-4 px-sm-5 py-3 border-bottom"
                  style={{
                    gridTemplateColumns:
                      '2.25rem minmax(0, 1fr) repeat(3, minmax(3.75rem, 6.5rem))',
                    background: isCurrentPlayer ? 'rgba(192,57,43,.1)' : 'transparent',
                    borderColor: '#23262e',
                  }}
                >
                  <span
                    className="text-sm font-semibold"
                    style={{
                      color: index < 3 ? MEDALS[index] : '#e8e4dc',
                      opacity: index < 3 ? 1 : 0.4,
                    }}
                  >
                    #{index + 1}
                  </span>
                  <div className="d-flex align-items-center gap-3 min-w-0">
                    <div
                      className="d-flex flex-shrink-0 align-items-center justify-content-center rounded-circle text-xs font-bold"
                      style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        background: 'linear-gradient(145deg, #5c1111, #21080a)',
                        border: '1px solid #8b2a24',
                        color: '#fff',
                      }}
                    >
                      {initials(player.name)}
                    </div>
                    <div className="min-w-0">
                      <p
                        className="m-0 text-sm font-semibold text-truncate"
                        style={{ color: '#e8e4dc' }}
                      >
                        {player.name}
                      </p>
                      {isCurrentPlayer && (
                        <span className="text-xs" style={{ color: '#f0a097' }}>
                          You
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-end">
                    <span className="d-block text-xs" style={{ color: '#e8e4dc', opacity: 0.3 }}>
                      Wins
                    </span>
                    <strong className="text-sm" style={{ color: '#e8e4dc' }}>
                      {formatNumber(player.wins)}
                    </strong>
                  </div>
                  <div className="text-end">
                    <span className="d-block text-xs" style={{ color: '#e8e4dc', opacity: 0.3 }}>
                      Win rate
                    </span>
                    <strong className="text-sm" style={{ color: '#e8e4dc' }}>
                      {winRate(player).toFixed(1)}%
                    </strong>
                  </div>
                  <div className="text-end">
                    <span className="d-block text-xs" style={{ color: '#e8e4dc', opacity: 0.3 }}>
                      Chips
                    </span>
                    <strong className="text-sm" style={{ color: '#e7c86e' }}>
                      {formatNumber(player.chips)}
                    </strong>
                  </div>
                </div>
              )
            })}
        </section>
      </main>
    </div>
  )
}
