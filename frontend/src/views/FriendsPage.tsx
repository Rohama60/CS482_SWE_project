import { useEffect, useState } from "react"
import {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  ignoreFriendRequest,
  type Friend,
  type FriendRequest,
} from "../friendsApi.ts"

// P11: two letters for the avatar circle, like "JO" for Josue
function initialsOf(name: string) {
  return name.trim().slice(0, 2).toUpperCase()
}

// P11: dot color for each status. Playing is red like her design; idle means signed up but not at a table.
const STATUS_COLORS: Record<string, string> = { playing: '#e05c4e', idle: '#f59e0b' }


// ==================== FRIENDS TAB: UI, tabs, search, requests, and invites ====================
export function FriendsPage({ onBack, onJoinTable }: { onBack: () => void; onJoinTable?: (tableId: string) => void }) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'invite'>('friends')
  const [invitePlayer, setInvitePlayer] = useState('')
  const [sentTo, setSentTo] = useState('')
  // P11: real data from the server instead of the sample list
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)

  const query = search.trim().toLowerCase()
  const visibleFriends = friends.filter(friend =>
    friend.displayName.toLowerCase().includes(query) || friend.username.toLowerCase().includes(query),
  )
  const playingCount = friends.filter(friend => friend.status === 'playing').length

  async function loadAll() {
    try {
      const [friendList, requestList] = await Promise.all([getFriends(), getFriendRequests()])
      setFriends(friendList)
      setRequests(requestList)
      setLoadError('')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load your friends')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  async function sendInvite() {
    const player = invitePlayer.trim()
    if (!player || sending) return
    setSending(true)
    setSendError('')
    try {
      const message = await sendFriendRequest(player)
      setSentTo(message)
      setInvitePlayer('')
      // If they had already asked you, you're friends now, so refresh the list
      await loadAll()
    } catch (error) {
      setSentTo('')
      setSendError(error instanceof Error ? error.message : 'Could not send the request')
    } finally {
      setSending(false)
    }
  }

  async function answerRequest(id: string, accept: boolean) {
    try {
      if (accept) await acceptFriendRequest(id)
      else await ignoreFriendRequest(id)
      setRequests(current => current.filter(request => request.id !== id))
      if (accept) await loadAll()
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not answer the request')
    }
  }

  return (
    <div
      className="relative min-h-screen"
      style={{ background: '#0a0a0b', overflowX: 'hidden' }}
    >
      <div className="fixed inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(90,10,10,0.45) 0%, transparent 70%)' }} />
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #c0392b 30%, #c0392b 70%, transparent)' }} />
      <div
        className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col border"
        style={{ background: 'rgba(19,21,27,0.94)', borderColor: '#292c35' }}
      >
        <div className="flex items-start justify-between border-b px-6 py-5" style={{ borderColor: '#292c35' }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Your circle</p>
            <h2 id="friends-title" className="mt-1 text-2xl font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>
              Friends
            </h2>
            <p className="mt-1 text-xs" style={{ color: '#e8e4dc', opacity: 0.38 }}>
              {playingCount === 1 ? '1 friend is at the tables now' : `${playingCount} friends are at the tables now`}
            </p>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold"
            style={{ background: '#22242c', border: '1px solid #343743', color: '#e8e4dc' }}
          >
            <span aria-hidden="true">←</span> Back to lobby
          </button>
        </div>

        <div className="flex gap-1 border-b px-6 pt-3" style={{ borderColor: '#292c35' }} role="tablist" aria-label="Friends sections">
          {([
            ['friends', `Friends ${friends.length}`],
            ['requests', `Requests ${requests.length}`],
            ['invite', 'Invite'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="border-0 border-b-2 px-4 py-3 text-xs font-semibold transition-all"
              style={{
                background: 'transparent',
                borderBottomColor: activeTab === tab ? '#c0392b' : 'transparent',
                color: activeTab === tab ? '#e8e4dc' : 'rgba(232,228,220,0.4)',
              }}
              role="tab"
              aria-selected={activeTab === tab}
            >
              {label}
            </button>
          ))}
        </div>

        {loadError && (
          <p role="alert" className="mx-6 mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.35)', color: '#f0a097' }}>
            {loadError}
          </p>
        )}

        {activeTab === 'friends' ? (
          <>
            <div className="px-6 pt-5">
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: '#0d0f13', border: '1px solid #343743', color: '#e8e4dc' }}
                placeholder="Search friends"
                aria-label="Search friends"
              />
            </div>
            <div className="flex-1 px-6 py-4">
              <div className="flex flex-col gap-2">
                {loading && (
                  <p className="py-6 text-center text-sm" style={{ color: '#e8e4dc', opacity: 0.45 }}>Loading friends...</p>
                )}
                {visibleFriends.map(friend => {
                  return (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-3"
                      style={{ background: '#111318', border: '1px solid #292c35' }}
                    >
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: 'linear-gradient(145deg, #6b1010, #2b0a0b)', border: '1px solid #9d2a23', color: '#e8e4dc' }}>
                        {initialsOf(friend.displayName)}
                        <span
                          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2"
                          style={{
                            background: STATUS_COLORS[friend.status] ?? '#555864',
                            borderColor: '#111318',
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold" style={{ color: '#e8e4dc' }}>{friend.displayName}</p>
                          <span className="text-xs" style={{ color: '#e8e4dc', opacity: 0.28 }}>${friend.chips.toLocaleString()}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs" style={{ color: '#e8e4dc', opacity: 0.38 }}>{friend.activity}</p>
                      </div>
                      {/* P11: play with your friends by joining the table they're at */}
                      {friend.status === 'playing' && friend.tableId && onJoinTable && (
                        <button
                          onClick={() => onJoinTable(friend.tableId as string)}
                          className="rounded-lg px-3 py-2 text-xs font-semibold"
                          style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.35)', color: '#f0a097' }}
                        >
                          Join
                        </button>
                      )}
                    </div>
                  )
                })}
                {!loading && !visibleFriends.length && (
                  <div className="rounded-xl py-10 text-center" style={{ background: '#111318', border: '1px dashed #343743' }}>
                    <p className="text-sm font-semibold" style={{ color: '#e8e4dc' }}>{friends.length ? 'No friends found' : 'No friends yet'}</p>
                    <p className="mt-1 text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>{friends.length ? 'Try a different player name.' : 'Send a request from the Invite tab.'}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : activeTab === 'requests' ? (
          <div className="flex-1 px-6 py-5">
            {requests.length ? (
              <div className="flex flex-col gap-2">
                {requests.map(request => (
                  <div key={request.id} className="flex items-center gap-3 rounded-xl p-4" style={{ background: '#111318', border: '1px solid #292c35' }}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: 'linear-gradient(145deg, #6b1010, #2b0a0b)', border: '1px solid #9d2a23', color: '#e8e4dc' }}>
                      {initialsOf(request.from.displayName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold" style={{ color: '#e8e4dc' }}>{request.from.displayName}</p>
                      <p className="mt-0.5 text-xs" style={{ color: '#e8e4dc', opacity: 0.38 }}>Sent you a friend request</p>
                    </div>
                    <button
                      onClick={() => answerRequest(request.id, true)}
                      className="rounded-lg border-0 px-3 py-2 text-xs font-semibold"
                      style={{ background: '#c0392b', color: '#fff' }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => answerRequest(request.id, false)}
                      className="rounded-lg px-3 py-2 text-xs font-semibold"
                      style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }}
                    >
                      Ignore
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl py-10 text-center" style={{ background: '#111318', border: '1px dashed #343743' }}>
                <p className="text-sm font-semibold" style={{ color: '#e8e4dc' }}>You’re all caught up</p>
                <p className="mt-1 text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>New friend requests will appear here.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 px-6 py-5">
            <div className="rounded-xl p-5" style={{ background: '#111318', border: '1px solid #292c35' }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Bring a player</p>
              <h3 className="mt-2 text-xl font-semibold" style={{ color: '#e8e4dc', fontFamily: 'var(--font-display)' }}>Invite to your next table</h3>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: '#e8e4dc', opacity: 0.4 }}>
                Send a request by player name or email. Friends will receive it in their requests.
              </p>
              <label htmlFor="friend-invite-player" className="mt-5 block text-xs font-semibold uppercase tracking-widest" style={{ color: '#e8e4dc', opacity: 0.58 }}>
                Player name or email
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="friend-invite-player"
                  value={invitePlayer}
                  onChange={event => {
                    setInvitePlayer(event.target.value)
                    setSentTo('')
                    setSendError('')
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter') sendInvite()
                  }}
                  placeholder="Nighthawk or player@email.com"
                  className="min-w-0 flex-1 rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: '#0d0f13', border: '1px solid #343743', color: '#e8e4dc' }}
                />
                <button
                  onClick={sendInvite}
                  disabled={!invitePlayer.trim() || sending}
                  className="rounded-xl border-0 px-5 py-3 text-sm font-semibold transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }}
                >
                  {sending ? 'Sending' : 'Send'}
                </button>
              </div>
              {sentTo && (
                <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#86efac' }}>
                  {sentTo}
                </div>
              )}
              {sendError && (
                <div role="alert" className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.35)', color: '#f0a097' }}>
                  {sendError}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl px-4 py-3" style={{ background: '#111318', border: '1px solid #292c35' }}>
              <div>
                <p className="text-xs font-semibold" style={{ color: '#e8e4dc' }}>Share an invite link</p>
                <p className="mt-0.5 text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>royaldraw.game/join/velvet-7</p>
              </div>
              <button
                onClick={() => setSentTo('Invite link copied to your clipboard.')}
                className="rounded-lg px-3 py-2 text-xs font-semibold"
                style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc' }}
              >
                Copy link
              </button>
            </div>
          </div>
        )}

        <div className="sticky bottom-0 mt-auto flex items-center justify-between border-t px-6 py-4" style={{ borderColor: '#292c35', background: 'rgba(17,19,24,0.96)', backdropFilter: 'blur(10px)' }}>
          <p className="text-xs" style={{ color: '#e8e4dc', opacity: 0.35 }}>Friends can invite you to open tables.</p>
          <button
            onClick={() => {
              setSentTo('')
              setActiveTab(activeTab === 'invite' ? 'friends' : 'invite')
            }}
            className="rounded-lg border-0 px-4 py-2 text-xs font-semibold"
            style={{ background: 'linear-gradient(135deg, #c0392b, #8b1a1a)', color: '#fff' }}
          >
            {activeTab === 'invite' ? 'Back to friends' : 'Invite a player'}
          </button>
        </div>
      </div>
    </div>
  )
}
