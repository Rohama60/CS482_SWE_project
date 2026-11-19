import { GameHistory } from '../components/history/GameHistory.tsx'

// P13 Game History page, opened from the History button in the lobby.
// All the history itself is in GameHistory, so it can move to the Profile page later.
export function HistoryPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="relative min-h-screen" style={{ background: '#0a0a0b', overflowX: 'hidden' }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(90,10,10,0.45) 0%, transparent 70%)' }} />
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #c0392b 30%, #c0392b 70%, transparent)' }} />
      <div
        className="relative z-10 border"
        style={{ margin: '0 auto', maxWidth: '48rem', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'rgba(19,21,27,0.94)', borderColor: '#292c35' }}
      >
        <div className="border-b" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '20px 24px', borderColor: '#292c35' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ margin: 0, color: '#c0392b' }}>Your games</p>
            <h2 className="text-2xl font-semibold" style={{ margin: '4px 0 0', color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>
              Game History
            </h2>
            <p className="text-xs" style={{ margin: '4px 0 0', color: '#e8e4dc', opacity: 0.38 }}>Every hand you finish, newest first</p>
          </div>
          <button
            onClick={onBack}
            className="rounded-lg text-xs font-semibold"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#22242c', border: '1px solid #343743', color: '#e8e4dc' }}
          >
            <span aria-hidden="true">←</span> Back to lobby
          </button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <GameHistory />
        </div>
      </div>
    </div>
  )
}
