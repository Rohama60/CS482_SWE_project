import type { View } from '../components/types.ts'
import { authClient} from '../AuthClient.ts'
import { startGuestSession } from '../guestSession.ts'

const SUITS = ['♠', '♥', '♦', '♣']

 const bgCards = [
    { suit: '♠', rank: 'A', style: { top: '8%', left: '4%', transform: 'rotate(-18deg)', opacity: 0.18 } as React.CSSProperties },
    { suit: '♥', rank: 'K', style: { top: '12%', right: '6%', transform: 'rotate(14deg)', opacity: 0.18 } as React.CSSProperties },
    { suit: '♦', rank: 'Q', style: { bottom: '15%', left: '8%', transform: 'rotate(22deg)', opacity: 0.18 } as React.CSSProperties },
    { suit: '♣', rank: 'J', style: { bottom: '10%', right: '4%', transform: 'rotate(-12deg)', opacity: 0.18 } as React.CSSProperties },
    { suit: '♥', rank: '10', style: { top: '45%', left: '2%', transform: 'rotate(8deg)', opacity: 0.08 } as React.CSSProperties },
    { suit: '♠', rank: '9', style: { top: '35%', right: '2%', transform: 'rotate(-20deg)', opacity: 0.08 } as React.CSSProperties },
  ]

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

type HomeProps = {
    view: View
    setView: (view: View) => void
    onSignUp: () => void

}



export default function Home({ view, setView, onSignUp }: HomeProps) {
    const { data: session, isPending } = authClient.useSession();

    async function playAsGuest() {
        try {
            await startGuestSession()
            setView('lobby')
        } catch (error) {
            console.error(error)
            alert('Could not start a guest game. Is the backend running?')
        }
    }

    return (
    <div>
        
    <div className="min-h-screen relative overflow-hidden flex flex-col" style={{ background: '#0a0a0b' }}>

        {/* Red glow */}
        <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(90,10,10,0.6) 0%, transparent 70%)' }}
        />

        {/* Top gold line */}
        <div className="absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, #c0392b 30%, #c0392b 70%, transparent)' }} />

        {/* Floating cards */}
        {bgCards.map((c, i) => (
            <FloatingCard key={i} suit={c.suit} rank={c.rank} style={c.style} />
        ))}

       <nav className="relative z-10 flex items-center justify-between px-8 py-5">
    <div className="flex items-center gap-2.5">
        <span className="text-xl" style={{ color: '#c0392b' }}>♠</span>
        <span style={{
            fontFamily: 'var(--font-display)',
            color: '#e8e4dc',
            fontSize: '1rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 600
        }}>
            Royal Draw
        </span>
    </div>

    <div className="flex items-center gap-3">
        { session?.user ? (
            <>
                <span className="px-4 py-2 text-sm text-white rounded-lg bg-[#1c1e25]">
                    👤 {session.user.name}
                </span>

                <span className="px-4 py-2 text-sm text-yellow-400 rounded-lg bg-[#1c1e25]">
                    🪙 500 Chips
                </span>
            </>
        ) : (
            <>
                <button
                    onClick={() => console.log('Log In clicked')}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-all hover:bg-white/5"
                    style={{
                        background: 'linear-gradient(135deg, #1c1e25 0%, #131418 100%)',
                        color: '#e8e4dc',
                        border: '1px solid #2a2d38'
                    }}
                >
                    Sign In
                </button>

                <button
                    onClick={onSignUp}
                    className="px-4 py-2 text-sm font-semibold rounded-lg transition-all hover:brightness-110"
                    style={{
                        background: 'linear-gradient(135deg, #c0392b, #8b1a1a)',
                        color: '#0a0a0b'
                    }}
                >
                    Create Account
                </button>
            </>
        )}
    </div>
</nav>

        {/* Hero */}
        <main className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 py-16 text-center">

            {/* Suit row */}
            <div className="flex gap-6 mb-10 text-3xl" style={{ color: '#c0392b', opacity: 0.55 }}>
            {SUITS.map(s => <span key={s}>{s}</span>)}
            </div>

            {/* Headline */}
            <h1
            className="leading-none mb-4"
            style={{ fontFamily: 'var(--font-display)', color: '#e8e4dc', fontSize: 'clamp(3rem, 10vw, 6rem)', fontWeight: 700 }}
            >
            Five Card
            <br />
            <span style={{ color: '#c0392b', fontStyle: 'italic' }}>Draw</span>
            </h1>

            <p className="text-base md:text-lg mb-14 max-w-md leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.45, fontWeight: 300 }}>
            Classic poker, no frills. Bluff your way to the pot or fold with dignity.
            </p>

            {/* CTA trio */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">

            <button
                onClick={playAsGuest}
                className="group flex flex-col items-center gap-3 py-8 px-6 rounded-2xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                style={{
                background: 'linear-gradient(135deg, #6b1010 0%, #450a0a 100%)',
                border: '1px solid rgba(192,57,43,0.3)',
                }}
            >
                <span className="text-3xl">🃏</span>
                <span className="text-base font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>Play as Guest</span>
                <span className="text-xs" style={{ color: '#e8e4dc', opacity: 0.45 }}>Jump in instantly</span>
            </button>

            <button
                onClick={() => console.log('Log In clicked')}
                className="group flex flex-col items-center gap-3 py-8 px-6 rounded-2xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                style={{ background: '#1c1e25', border: '1px solid #2a2d38' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(192,57,43,0.5)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2d38')}
            >
                <span className="text-3xl">🔑</span>
                <span className="text-base font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>Log In</span>
                <span className="text-xs" style={{ color: '#e8e4dc', opacity: 0.45 }}>Resume your streak</span>
            </button>

            <button
                onClick={onSignUp}
                className="group flex flex-col items-center gap-3 py-8 px-6 rounded-2xl transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                style={{
                background: 'linear-gradient(135deg, rgba(192,57,43,0.14) 0%, rgba(139,26,26,0.08) 100%)',
                border: '1px solid rgba(192,57,43,0.4)',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(192,57,43,0.75)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(192,57,43,0.4)')}
            >
                <span className="text-3xl">⭐</span>
                <span className="text-base font-semibold" style={{ color: '#c0392b', fontFamily: 'var(--font-display)' }}>Create Account</span>
                <span className="text-xs" style={{ color: '#e8e4dc', opacity: 0.45 }}>Track wins &amp; stats</span>
            </button>

            </div>

            {/* Product explanation */}
            <section className="mt-20 w-full max-w-3xl">
            <div className="mx-auto max-w-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em]" style={{ color: '#c0392b' }}>Classic poker, one draw</p>
                <h2 className="mt-3 text-2xl font-semibold md:text-3xl" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>
                Best hand wins the pot
                </h2>
                <p className="mt-3 text-sm leading-relaxed md:text-base" style={{ color: '#e8e4dc', opacity: 0.42 }}>
                Join a table, place your bet, replace up to five cards, and compete for the pot. Play instantly as a guest—no download required.
                </p>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
                {[
                { number: '01', title: 'Choose a table', copy: 'Pick stakes that suit your chip stack and take an open seat.' },
                { number: '02', title: 'Draw your cards', copy: 'Keep your strongest cards and replace the rest one time.' },
                { number: '03', title: 'Win the pot', copy: 'Bet, bluff, or fold. The best hand at showdown takes the chips.' },
                ].map(step => (
                <div key={step.number} className="rounded-2xl p-5" style={{ background: 'rgba(22,24,32,0.82)', border: '1px solid #292c35' }}>
                    <span className="text-xs font-semibold tracking-widest" style={{ color: '#c0392b' }}>{step.number}</span>
                    <p className="mt-3 text-sm font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>{step.title}</p>
                    <p className="mt-2 text-xs leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.38 }}>{step.copy}</p>
                </div>
                ))}
            </div>

            <div className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2">
                <span className="text-xs" style={{ color: '#e8e4dc', opacity: 0.3 }}>Play instantly as a guest</span>
                <span className="text-xs" style={{ color: '#e8e4dc', opacity: 0.3 }}>Create an account to save chips</span>
                <span className="text-xs" style={{ color: '#e8e4dc', opacity: 0.3 }}>Track wins and statistics</span>
            </div>
            </section>
        </main>

        {/* Footer */}
        <footer className="relative z-10 flex items-center justify-center py-6">
            <p className="text-xs" style={{ color: '#e8e4dc', opacity: 0.2 }}>© 2026 Royal Draw · Play responsibly</p>
        </footer>

        {/* Bottom gold line */}
        <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, #c0392b 30%, #c0392b 70%, transparent)' }} />
        
        </div>
    </div>
    )
}
