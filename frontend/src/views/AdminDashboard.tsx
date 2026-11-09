import { useEffect, useState } from 'react'
import { AdminUserManagement } from '../components/AdminUserManagement';

type AdminSection = 'ads' | 'users' | 'poker-tables'

type AdminRecord = {
  id: string | number
  name?: string
  displayName?: string
  email?: string
  username?: string
  role?: string
  placement?: string
  status?: string
  rewardChips?: number
  chips?: number
  wins?: number
  stakes?: string
  seats?: number
  playerCount?: number
  averagePot?: string
  updatedAt?: string
}

// ==================== ADMIN CONTROL ROOM: tab definitions ====================
const ADMIN_SECTIONS: Array<{
  slug: AdminSection
  label: string
  eyebrow: string
  description: string
}> = [
  { slug: 'ads', label: 'Ads', eyebrow: 'Revenue', description: 'Reward campaigns and lobby placements' },
  { slug: 'users', label: 'Users', eyebrow: 'Community', description: 'Player accounts, balances, and status' },
  { slug: 'poker-tables', label: 'Tables', eyebrow: 'Game floor', description: 'Stakes, seats, bots, and availability' },
]

// ==================== ADMIN CONTROL ROOM: users, tables, ads, and player actions ====================
export function AdminDashboard({
  onLeave,
  onSessionExpired,
}: {
  onLeave: () => void
  onSessionExpired: () => void
}) {
  const [section, setSection] = useState<AdminSection>('ads')
  const [records, setRecords] = useState<AdminRecord[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [editingUser, setEditingUser] = useState<AdminRecord | null>(null)
  const [deletingUser, setDeletingUser] = useState<AdminRecord | null>(null)
  const [chipsDraft, setChipsDraft] = useState('0')
  const [passwordDraft, setPasswordDraft] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionPending, setActionPending] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function loadRecords() {
      setIsLoading(true)
      setLoadError('')
      try {
        const response = await fetch(`/api/${section}?limit=50&sort=-updatedAt`, {
          credentials: 'include',
          signal: controller.signal,
        })

        if (response.status === 401 || response.status === 403) {
          onSessionExpired()
          return
        }
        if (!response.ok) throw new Error('Unable to load records')

        const data = await response.json() as { docs?: AdminRecord[]; totalDocs?: number }
        setRecords(data.docs ?? [])
        setTotal(data.totalDocs ?? 0)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setLoadError('This section could not be loaded. Please try again.')
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadRecords()
    return () => controller.abort()
  }, [section, reloadKey, onSessionExpired])

  async function updatePlayer(id: string | number, updates: Record<string, unknown>) {
    setActionPending(true)
    setActionError('')
    try {
      const response = await fetch(`/api/admin/players/${encodeURIComponent(String(id))}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (response.status === 401 || response.status === 403) {
        onSessionExpired()
        return false
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { errors?: Array<{ message?: string }> } | null
        throw new Error(data?.errors?.[0]?.message ?? 'The player could not be updated.')
      }
      setReloadKey(value => value + 1)
      return true
    } catch (error) {
      setActionError((error as Error).message)
      return false
    } finally {
      setActionPending(false)
    }
  }

  async function savePlayer() {
    if (!editingUser) return
    const chips = Number(chipsDraft)
    if (!Number.isFinite(chips) || chips < 0) {
      setActionError('Chip balance must be zero or greater.')
      return
    }
    const updates: Record<string, unknown> = { chips: Math.floor(chips) }
    if (passwordDraft) updates.password = passwordDraft
    if (await updatePlayer(editingUser.id, updates)) {
      setEditingUser(null)
      setPasswordDraft('')
    }
  }

  async function deletePlayer() {
    if (!deletingUser) return
    setActionPending(true)
    setActionError('')
    try {
      const response = await fetch(`/api/admin/players/${encodeURIComponent(String(deletingUser.id))}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (response.status === 401 || response.status === 403) {
        onSessionExpired()
        return
      }
      if (!response.ok) throw new Error('The player account could not be deleted.')
      setDeletingUser(null)
      setReloadKey(value => value + 1)
    } catch (error) {
      setActionError((error as Error).message)
    } finally {
      setActionPending(false)
    }
  }

  async function signOut() {
    try {
      await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    } finally {
      onLeave()
    }
  }

  const activeSection = ADMIN_SECTIONS.find(item => item.slug === section) ?? ADMIN_SECTIONS[0]
  const visibleRecords = records.filter(record => {
    const title = record.name ?? record.displayName ?? record.email ?? ''
    return title.toLowerCase().includes(search.trim().toLowerCase())
  })

  function recordTitle(record: AdminRecord) {
    return record.name ?? record.displayName ?? record.email ?? 'Untitled record'
  }

  function recordMeta(record: AdminRecord) {
    if (section === 'ads') return `${record.placement ?? 'No placement'} · ${record.rewardChips ?? 0} reward chips`
    if (section === 'users') return `${record.email ?? 'No email'} · ${record.chips ?? 0} chips · ${record.wins ?? 0} wins`
    return `${record.stakes ?? 'No stakes'} stakes · ${record.playerCount ?? 0}/${record.seats ?? 0} players seated · avg pot ${record.averagePot ?? '—'}`
  }

  return (
    <div className="relative min-h-screen" style={{ background: '#0a0a0b', overflowX: 'hidden' }}>
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(90,10,10,0.38) 0%, transparent 72%)' }} />
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #c0392b 30%, #c0392b 70%, transparent)' }} />

      <header className="relative z-20 flex items-center justify-between border-b px-6 py-4" style={{ background: 'rgba(10,10,11,0.9)', borderColor: '#292c35', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <span className="text-xl" style={{ color: '#c0392b' }}>♠</span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>Royal Draw</p>
            <p className="text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>Admin control room</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-lg px-3 py-2 text-xs font-semibold" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac' }}>
            Secure session
          </span>
          <button
            onClick={signOut}
            className="rounded-lg px-4 py-2 text-xs font-semibold"
            style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full px-6 py-8" style={{ maxWidth: '72rem' }}>
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>{activeSection.eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>{activeSection.label}</h1>
            <p className="mt-1 text-sm" style={{ color: '#e8e4dc', opacity: 0.4 }}>{activeSection.description}</p>
          </div>
          <button
            onClick={onLeave}
            className="rounded-lg px-4 py-2 text-xs font-semibold"
            style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }}
          >
            View public site
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 mb-8 md:grid-cols-3">
          {ADMIN_SECTIONS.map(item => (
            <button
              key={item.slug}
              onClick={() => {
                setSection(item.slug)
                setSearch('')
              }}
              className="rounded-2xl p-5 text-left transition-all"
              style={{
                background: section === item.slug ? 'rgba(107,16,16,0.38)' : '#161820',
                border: `1px solid ${section === item.slug ? '#c0392b' : '#292c35'}`,
                color: '#e8e4dc',
              }}
            >
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: section === item.slug ? '#f0a097' : '#c0392b' }}>{item.eyebrow}</span>
              <span className="mt-2 block text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{item.label}</span>
              <span className="mt-1 block text-xs leading-relaxed" style={{ opacity: 0.38 }}>{item.description}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 mb-6 md:grid-cols-3">
          {[
            ['Records', String(total)],
            ['Active section', activeSection.label],
            ['Access level', 'Moderator tools'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl px-5 py-4" style={{ background: '#161820', border: '1px solid #292c35' }}>
              <p className="text-xs" style={{ color: '#e8e4dc', opacity: 0.38 }}>{label}</p>
              <p className="mt-1 text-xl font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>{value}</p>
            </div>
          ))}
        </div>

        <section className="overflow-hidden rounded-2xl" style={{ background: '#14161b', border: '1px solid #292c35' }}>
          <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: '#292c35' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#e8e4dc' }}>{activeSection.label} directory</p>
              <p className="mt-0.5 text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>Live records from the protected Payload collection</p>
            </div>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="rounded-lg px-4 py-2 text-sm outline-none"
              style={{ background: '#0d0f13', border: '1px solid #343743', color: '#e8e4dc' }}
              placeholder={`Search ${activeSection.label.toLowerCase()}`}
              aria-label={`Search ${activeSection.label}`}
            />
          </div>

          <div className="p-4">
            {actionError && (
              <div role="alert" className="mb-3 rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)', color: '#f0a097' }}>
                {actionError}
              </div>
            )}
            {isLoading ? (
              <div className="py-14 text-center">
                <p className="text-sm font-semibold" style={{ color: '#e8e4dc' }}>Loading secure records…</p>
              </div>
            ) : loadError ? (
              <div className="rounded-xl px-5 py-8 text-center" style={{ background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.25)' }}>
                <p className="text-sm font-semibold" style={{ color: '#f0a097' }}>{loadError}</p>
              </div>
            ) : visibleRecords.length ? (
              <div className="flex flex-col gap-2">
                {visibleRecords.map(record => (
                  <div key={record.id} className="flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ background: '#111318', border: '1px solid #292c35' }}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: '#e8e4dc' }}>{recordTitle(record)}</p>
                      <p className="mt-1 truncate text-xs" style={{ color: '#e8e4dc', opacity: 0.38 }}>{recordMeta(record)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <span
                        className="rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                          background: record.status === 'banned' ? 'rgba(192,57,43,0.18)' : 'rgba(34,197,94,0.1)',
                          border: `1px solid ${record.status === 'banned' ? 'rgba(192,57,43,0.35)' : 'rgba(34,197,94,0.25)'}`,
                          color: record.status === 'banned' ? '#f0a097' : '#86efac',
                        }}
                      >
                        {record.status ?? 'Configured'}
                      </span>
                      {section === 'users' && (
                        <>
                          <button
                            onClick={() => {
                              setActionError('')
                              setEditingUser(record)
                              setChipsDraft(String(record.chips ?? 0))
                              setPasswordDraft('')
                            }}
                            className="rounded-lg px-3 py-2 text-xs font-semibold"
                            style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => void updatePlayer(record.id, { status: record.status === 'banned' ? 'active' : 'banned' })}
                            disabled={actionPending}
                            className="rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
                            style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.35)', color: '#f0a097' }}
                          >
                            {record.status === 'banned' ? 'Unban' : 'Ban'}
                          </button>
                          <button
                            onClick={() => {
                              setActionError('')
                              setDeletingUser(record)
                            }}
                            className="rounded-lg px-3 py-2 text-xs font-semibold"
                            style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl py-14 text-center" style={{ background: '#111318', border: '1px dashed #343743' }}>
                <p className="text-sm font-semibold" style={{ color: '#e8e4dc' }}>No {activeSection.label.toLowerCase()} found</p>
                <p className="mt-1 text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>
                  {search ? 'Try a different search.' : 'Records created in Payload will appear here.'}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4" style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)' }}>
          <div role="dialog" aria-modal="true" aria-labelledby="edit-player-title" className="w-full max-w-md rounded-2xl p-6" style={{ background: '#1c1e25', border: '1px solid #343743' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Player account</p>
                <h2 id="edit-player-title" className="mt-1 text-xl font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>
                  Edit {editingUser.displayName ?? editingUser.username ?? 'player'}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close player editor"
                onClick={() => setEditingUser(null)}
                className="rounded-lg px-3 py-1.5 text-sm"
                style={{ background: '#131418', color: '#e8e4dc' }}
              >
                Close
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="player-chips" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: '#e8e4dc', opacity: 0.55 }}>Chip balance</label>
                <input
                  id="player-chips"
                  type="number"
                  min="0"
                  step="1"
                  value={chipsDraft}
                  onChange={event => setChipsDraft(event.target.value)}
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                  style={{ background: '#131418', border: '1px solid #343743', color: '#e8e4dc' }}
                />
              </div>
              <div>
                <label htmlFor="player-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: '#e8e4dc', opacity: 0.55 }}>New password</label>
                <input
                  id="player-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordDraft}
                  onChange={event => setPasswordDraft(event.target.value)}
                  placeholder="Leave blank to keep current password"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none"
                  style={{ background: '#131418', border: '1px solid #343743', color: '#e8e4dc' }}
                />
              </div>
              {actionError && <p role="alert" className="text-xs" style={{ color: '#f0a097' }}>{actionError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingUser(null)} className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ background: '#131418', color: '#e8e4dc' }}>Cancel</button>
                <button
                  type="button"
                  onClick={() => void savePlayer()}
                  disabled={actionPending}
                  className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }}
                >
                  {actionPending ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)' }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-player-title" aria-describedby="delete-player-description" className="w-full max-w-md rounded-2xl p-6" style={{ background: '#1c1e25', border: '1px solid rgba(192,57,43,0.45)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#f0a097' }}>Permanent action</p>
            <h2 id="delete-player-title" className="mt-2 text-xl font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>Delete this player account?</h2>
            <p id="delete-player-description" className="mt-2 text-sm leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.55 }}>
              {deletingUser.displayName ?? deletingUser.username ?? deletingUser.email ?? 'This player'} will lose access permanently. This cannot be undone.
            </p>
            {actionError && <p role="alert" className="mt-3 text-xs" style={{ color: '#f0a097' }}>{actionError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setDeletingUser(null)} className="rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ background: '#131418', color: '#e8e4dc' }}>Keep account</button>
              <button
                type="button"
                onClick={() => void deletePlayer()}
                disabled={actionPending}
                className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
                style={{ background: '#a72d22', color: '#fff' }}
              >
                {actionPending ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
