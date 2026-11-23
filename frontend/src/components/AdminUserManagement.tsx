import { useEffect, useState } from 'react'
import { AdminResetForm } from './PasswordResetSection'

export interface AdminUserItem {
  id: string
  name: string
  email: string
  role: string
  chips: number
  gamesPlayed: number
  lastActiveAt: string | null
}

const COLORS = {
  card: '#111318',
  border: '#292c35',
  text: '#e8e4dc',
  accent: '#c0392b',
  accentDark: '#8b1a1a',
  danger: '#f0a097',
  dangerBg: 'rgba(192,57,43,0.12)',
  dangerBorder: 'rgba(192,57,43,0.35)',
}

export function AdminUserManagement() {
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'frequent' | 'recent'>('frequent')
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [resetUserId, setResetUserId] = useState<string | null>(null)

  async function loadUsers(activeSort = sort, activeSearch = search) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        sort: activeSort,
        ...(activeSearch.trim() ? { search: activeSearch.trim() } : {}),
      })
      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        credentials: 'include',
      })
      const data = await res.json().catch(() => null) as { users?: AdminUserItem[]; error?: string } | null
      if (!res.ok || !Array.isArray(data?.users)) {
        throw new Error(data?.error ?? 'Could not load users')
      }
      setUsers(data.users)
      setBalances(prev => {
        const next: Record<string, string> = { ...prev }
        for (const u of data.users!) {
          if (next[u.id] === undefined) next[u.id] = String(u.chips)
        }
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers(sort, search)
  }, [sort])

  async function handleUpdateBalance(userId: string) {
    const nextValue = Number(balances[userId])
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      setError('Balance must be 0 or greater')
      return
    }

    setBusyId(userId)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/balance`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: Math.floor(nextValue) }),
      })
      const data = await res.json().catch(() => null) as { user?: AdminUserItem; error?: string } | null
      if (!res.ok || !data?.user) {
        throw new Error(data?.error ?? 'Could not update balance')
      }
      setUsers(prev => prev.map(u => (u.id === userId ? data.user! : u)))
      setBalances(prev => ({ ...prev, [userId]: String(data.user!.chips) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update balance')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeleteUser(userId: string) {
    setBusyId(userId)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok) {
        throw new Error(data?.error ?? 'Could not delete user')
      }
      setUsers(prev => prev.filter(u => u.id !== userId))
      setConfirmDeleteId(null)
      if (resetUserId === userId) setResetUserId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete user')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section aria-label="Admin Manage Users" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void loadUsers(sort, search) }}
          placeholder="Search name or email..."
          aria-label="Search users"
          className="rounded-lg px-3 py-1.5 text-xs"
          style={{ background: '#161820', border: `1px solid ${COLORS.border}`, color: COLORS.text }}
        />
        <button
          type="button"
          onClick={() => void loadUsers(sort, search)}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.text }}
        >
          Search
        </button>
        <button
          type="button"
          aria-pressed={sort === 'frequent'}
          onClick={() => setSort('frequent')}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{
            background: sort === 'frequent' ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})` : COLORS.card,
            border: `1px solid ${sort === 'frequent' ? COLORS.accent : COLORS.border}`,
            color: '#fff',
          }}
        >
          Frequent Users
        </button>
        <button
          type="button"
          aria-pressed={sort === 'recent'}
          onClick={() => setSort('recent')}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{
            background: sort === 'recent' ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.accentDark})` : COLORS.card,
            border: `1px solid ${sort === 'recent' ? COLORS.accent : COLORS.border}`,
            color: '#fff',
          }}
        >
          Recent Users
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-xl px-3.5 py-2.5 text-xs" style={{ margin: 0, background: COLORS.dangerBg, border: `1px solid ${COLORS.dangerBorder}`, color: COLORS.danger }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-4 text-xs" style={{ margin: 0, color: COLORS.text, opacity: 0.55 }}>Loading users...</p>
      ) : users.length === 0 ? (
        <p className="py-4 text-xs" style={{ margin: 0, color: COLORS.text, opacity: 0.55 }}>No users found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${COLORS.border}`, background: COLORS.card }}>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}`, color: COLORS.text, opacity: 0.7 }}>
                <th align="left" className="px-3 py-2.5">User</th>
                <th align="left" className="px-3 py-2.5">Role</th>
                <th align="right" className="px-3 py-2.5">Games</th>
                <th align="left" className="px-3 py-2.5">Balance</th>
                <th align="left" className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const isBusy = busyId === user.id
                const isConfirming = confirmDeleteId === user.id
                const isResetOpen = resetUserId === user.id

                return (
                  <tr key={user.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold" style={{ color: COLORS.text }}>{user.name}</div>
                      <div style={{ color: COLORS.text, opacity: 0.55 }}>{user.email}</div>
                    </td>
                    <td className="px-3 py-2.5" style={{ color: COLORS.text }}>{user.role}</td>
                    <td align="right" className="px-3 py-2.5 font-semibold" style={{ color: COLORS.text }}>{user.gamesPlayed}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          value={balances[user.id] ?? String(user.chips)}
                          onChange={e => setBalances(prev => ({ ...prev, [user.id]: e.target.value }))}
                          aria-label={`Balance for ${user.name}`}
                          className="w-24 rounded-lg px-2 py-1 text-xs"
                          style={{ background: '#161820', border: `1px solid ${COLORS.border}`, color: COLORS.text }}
                        />
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleUpdateBalance(user.id)}
                          className="rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
                          style={{ background: COLORS.accent, color: '#fff' }}
                        >
                          {isBusy ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setResetUserId(isResetOpen ? null : user.id)}
                            className="rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
                            style={{ background: '#161820', border: `1px solid ${COLORS.border}`, color: COLORS.text }}
                          >
                            {isResetOpen ? 'Close Reset' : 'Reset Password'}
                          </button>

                          {isConfirming ? (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleDeleteUser(user.id)}
                                className="rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
                                style={{ background: COLORS.accent, color: '#fff' }}
                              >
                                {isBusy ? 'Deleting...' : 'Confirm Delete'}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
                                style={{ background: '#161820', border: `1px solid ${COLORS.border}`, color: COLORS.text }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteId(user.id)}
                              className="rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-60"
                              style={{ background: COLORS.dangerBg, border: `1px solid ${COLORS.dangerBorder}`, color: COLORS.danger }}
                            >
                              Delete
                            </button>
                          )}
                        </div>

                        {isResetOpen && (
                          <AdminResetForm targetUserId={user.id} targetName={user.name || user.email} />
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
