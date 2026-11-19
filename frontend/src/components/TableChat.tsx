import { useEffect, useRef, useState } from 'react'
import { socket } from '../socket'
import { getMutedPlayers, mutePlayer, unmutePlayer } from '../chatApi'

// M3: Member chat at a table. Rohama's chat box design, now with real live messages.
// Everyone at the table can read. Only members sitting at the table can send.
// Mute Others: members can mute a player so their messages are hidden. Mutes are saved to your account.

export const MEMBERS_ONLY = 'Members Only! Sign up to chat'
export const SEATED_ONLY = 'Take a seat at the table to chat'
export const MAX_MESSAGE_LENGTH = 200
// How close to the bottom (in pixels) still counts as "at the bottom"
export const STICK_TO_BOTTOM_PX = 40

export type ChatMessage = {
  id: string
  senderId?: string // who sent it, so muted players' messages can be hidden
  name: string
  message: string
  createdAt?: string
}

type TableChatProps = {
  tableId: string | number
  isMember: boolean // logged in, not a guest
  isSeated: boolean // sitting at this table, not just watching
  myName?: string
}

export function TableChat({ tableId, isMember, isSeated, myName }: TableChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [online, setOnline] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const [noticeVisible, setNoticeVisible] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  // True while you're looking at the newest messages. Scrolling up turns it off,
  // so new messages don't yank you back down while you read older ones.
  const atBottom = useRef(true)
  // Mute Others: ids of the players you muted
  const [muted, setMuted] = useState<string[]>([])
  // With more than one muted player, only the first shows until you click the dots
  const [showAllMuted, setShowAllMuted] = useState(false)

  const canSend = isMember && isSeated
  const visibleMessages = messages.filter(message => !message.senderId || !muted.includes(message.senderId))
  // Muted players who have messages in this chat, so you can unmute them from here
  const mutedHere = muted
    .map(id => ({ id, name: messages.find(message => message.senderId === id)?.name }))
    .filter((player): player is { id: string; name: string } => Boolean(player.name))
  const blockedMessage = !isMember ? MEMBERS_ONLY : SEATED_ONLY

  // Shows a message over the chat box that fades away after a couple of seconds
  function showNotice(text: string) {
    timers.current.forEach(clearTimeout)
    setNotice(text)
    setNoticeVisible(true)
    timers.current = [
      setTimeout(() => setNoticeVisible(false), 2000),
      setTimeout(() => setNotice(''), 2500),
    ]
  }

  // Load the last messages when the table opens
  useEffect(() => {
    let active = true
    fetch(`/api/tables/${tableId}/chat`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : { messages: [] }))
      .then(data => { if (active) setMessages(data.messages ?? []) })
      .catch(() => { /* the chat just starts empty */ })
    return () => { active = false }
  }, [tableId])

  // Fold the list back up once you're down to one muted player
  useEffect(() => {
    if (mutedHere.length <= 1) setShowAllMuted(false)
  }, [mutedHere.length])

  // Members: load who you muted (guests can't mute, so they skip this)
  useEffect(() => {
    if (!isMember) return
    let active = true
    getMutedPlayers()
      .then(ids => { if (active) setMuted(ids) })
      .catch(() => { /* nobody is hidden if this fails */ })
    return () => { active = false }
  }, [isMember])

  async function mute(message: ChatMessage) {
    if (!message.senderId) return
    try {
      await mutePlayer(message.senderId)
      setMuted(current => (current.includes(message.senderId as string) ? current : [...current, message.senderId as string]))
      showNotice(`${message.name} is muted`)
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Could not mute that player')
    }
  }

  async function unmute(player: { id: string; name: string }) {
    try {
      await unmutePlayer(player.id)
      setMuted(current => current.filter(id => id !== player.id))
      showNotice(`${player.name} is unmuted`)
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'Could not unmute that player')
    }
  }

  // Live updates from the server
  useEffect(() => {
    const handleMessage = (message: ChatMessage) => {
      setMessages(current => [...current, message].slice(-100))
    }
    const handleError = ({ error }: { error: string }) => showNotice(error)
    const handleOnline = (data: { tableId: string; online: number }) => {
      if (String(data.tableId) === String(tableId)) setOnline(data.online)
    }

    socket.on('chat:message', handleMessage)
    socket.on('chat:error', handleError)
    socket.on('chat:online', handleOnline)
    return () => {
      socket.off('chat:message', handleMessage)
      socket.off('chat:error', handleError)
      socket.off('chat:online', handleOnline)
    }
  }, [tableId])

  // Stop any fade timers if the table closes
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // Remember if you're at the bottom of the chat or scrolled up reading
  function handleScroll() {
    const list = listRef.current
    if (!list) return
    atBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight <= STICK_TO_BOTTOM_PX
  }

  // Keep the newest message in view, unless you scrolled up to read
  useEffect(() => {
    const list = listRef.current
    if (list && atBottom.current) list.scrollTop = list.scrollHeight
  }, [messages, muted])

  function send() {
    if (!canSend) {
      showNotice(blockedMessage)
      return
    }
    const message = draft.trim()
    if (!message) return
    socket.emit('chat:send', { tableId, message })
    setDraft('')
  }

  return (
    <div className="relative flex-1 rounded-2xl border p-4" style={{ display: 'flex', flexDirection: 'column', background: '#14161b', borderColor: '#292c35' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Table Chat</p>
        <span className="text-xs font-semibold" style={{ color: '#e8e4dc', opacity: 0.35 }}>{online ?? 1} online</span>
      </div>

      {/* Mute Others: who you muted, with a way to unmute them.
          Only the first shows at first. The dots drop the rest down, lined up under the first one. */}
      {mutedHere.length > 0 && (
        <div
          className="mt-3 text-xs"
          style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 8, rowGap: 6, alignItems: 'center', color: '#e8e4dc' }}
          aria-label="Muted players"
        >
          <span style={{ opacity: 0.45 }}>Muted:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <MutedChip player={mutedHere[0]} onUnmute={unmute} />
            {mutedHere.length > 1 && (
              <button
                onClick={() => setShowAllMuted(open => !open)}
                className="rounded-lg text-xs font-semibold"
                style={{ background: '#1c1e25', border: '1px solid #343743', color: '#e8e4dc', padding: '4px 8px', letterSpacing: 1, lineHeight: 1 }}
                aria-expanded={showAllMuted}
                aria-label={showAllMuted ? 'Hide other muted players' : `Show ${mutedHere.length - 1} more muted`}
                title={showAllMuted ? 'Hide' : `${mutedHere.length - 1} more`}
              >
                •••
              </button>
            )}
          </div>
          {showAllMuted && mutedHere.slice(1).map(player => (
            <div key={player.id} style={{ gridColumn: 2, display: 'flex' }}>
              <MutedChip player={player} onUnmute={unmute} />
            </div>
          ))}
        </div>
      )}

      {/* The messages fill whatever space the chat panel has, so there's no empty gap under the box.
          The list sits inside this area instead of setting its height, so lots of messages scroll
          instead of stretching the panel. (The project has no Tailwind, so these styles are set here.) */}
      <div className="mt-4" style={{ position: 'relative', flex: '1 1 auto', minHeight: '11rem' }}>
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex flex-col gap-3 pr-1"
        style={{ position: 'absolute', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}
        aria-live="polite"
        aria-label="Chat messages"
        data-testid="chat-messages"
      >
        {visibleMessages.length === 0 && (
          <p className="text-xs" style={{ margin: 0, color: '#e8e4dc', opacity: 0.3 }}>No messages yet.</p>
        )}
        {visibleMessages.map(message => (
          <div key={message.id}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold" style={{ margin: 0, color: message.name === myName ? '#f0a097' : '#e8e4dc' }}>{message.name}</p>
              {/* Members can mute anyone but themselves */}
              {isMember && message.senderId && message.name !== myName && (
                <button
                  onClick={() => mute(message)}
                  className="border-0 text-xs"
                  style={{ background: 'transparent', border: 'none', color: '#e8e4dc', opacity: 0.35, padding: 0 }}
                  aria-label={`Mute ${message.name}`}
                  title={`Hide messages from ${message.name}`}
                >
                  Mute
                </button>
              )}
            </div>
            <p className="text-xs leading-relaxed" style={{ margin: '2px 0 0', color: '#e8e4dc', opacity: 0.48, overflowWrap: 'anywhere' }}>{message.message}</p>
          </div>
        ))}
      </div>
      </div>

      <div className="mt-4 flex gap-2 border-t pt-3" style={{ borderColor: '#292c35' }}>
        <input
          value={draft}
          readOnly={!canSend}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={event => setDraft(event.target.value)}
          onMouseDown={() => { if (!canSend) showNotice(blockedMessage) }}
          onFocus={event => {
            // Guests and watchers can click the box, but get the notice instead of typing
            if (!canSend) {
              showNotice(blockedMessage)
              event.currentTarget.blur()
            }
          }}
          onKeyDown={event => {
            if (event.key === 'Enter') send()
          }}
          className="min-w-0 flex-1 rounded-lg px-3 py-2 text-xs outline-none"
          style={{ background: '#0d0f13', border: '1px solid #343743', color: '#e8e4dc' }}
          placeholder="Message table..."
          aria-label="Type a message to the table"
        />
        <button
          onClick={send}
          disabled={canSend && !draft.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-lg border-0 text-sm font-semibold disabled:opacity-40"
          style={{ background: '#c0392b', color: '#fff' }}
          aria-label="Send message"
        >
          ➤
        </button>
      </div>

      {/* The fading notice, like "Members Only! Sign up to chat" */}
      {notice && (
        <div
          role="status"
          className="absolute rounded-lg px-3 py-2 text-center text-xs font-semibold shadow-xl"
          style={{
            // Sits just above the message box (these spots are set here since the project has no Tailwind)
            left: 16,
            right: 16,
            bottom: 64,
            pointerEvents: 'none',
            background: 'rgba(192,57,43,0.95)',
            color: '#fff',
            opacity: noticeVisible ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        >
          {notice}
        </div>
      )}
    </div>
  )
}

// One muted player with their Unmute button
function MutedChip({ player, onUnmute }: { player: { id: string; name: string }; onUnmute: (player: { id: string; name: string }) => void }) {
  return (
    <span className="flex items-center gap-1 rounded-lg px-2 py-1" style={{ background: '#1c1e25', border: '1px solid #343743', minWidth: 0 }}>
      <span style={{ opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{player.name}</span>
      <button
        onClick={() => onUnmute(player)}
        className="border-0 text-xs font-semibold"
        style={{ background: 'transparent', border: 'none', color: '#f0a097', padding: 0, flexShrink: 0 }}
        aria-label={`Unmute ${player.name}`}
      >
        Unmute
      </button>
    </span>
  )
}
