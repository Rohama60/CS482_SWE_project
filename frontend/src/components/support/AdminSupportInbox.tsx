import { useEffect, useRef, useState } from 'react'
import { socket } from '../../socket'
import {
  getSupportInbox,
  getSupportConversation,
  replySupport,
  MAX_SUPPORT_LENGTH,
  type SupportConversation,
  type SupportMessage,
} from '../../supportApi'
import { joinSupport } from './supportSocket'
import { addMessage, formatTime } from './SupportChat'

// P18 Chat with Admin, the admin side: every player who wrote in, and a reply box.
// Built as its own piece so it can go in the Admin Dashboard as a Support section.
// New messages show up live. Styles are set here directly, since the project has no Tailwind.

const C = { panel: '#14161b', card: '#111318', border: '#292c35', text: '#e8e4dc', red: '#c0392b', soft: '#f0a097', field: '#0d0f13' }

// Puts a new message into the conversation list: moves that player to the top and bumps unread
export function updateInbox(list: SupportConversation[], message: SupportMessage, openPlayerId: string | null) {
  const existing = list.find(convo => convo.playerId === message.playerId)
  const countsAsUnread = message.from === 'player' && message.playerId !== openPlayerId
  const updated: SupportConversation = {
    playerId: message.playerId,
    playerName: existing?.playerName ?? message.senderName,
    lastMessage: message.message,
    lastFrom: message.from,
    lastAt: message.createdAt,
    unread: (existing?.unread ?? 0) + (countsAsUnread ? 1 : 0),
  }
  return [updated, ...list.filter(convo => convo.playerId !== message.playerId)]
}

export function AdminSupportInbox() {
  const [conversations, setConversations] = useState<SupportConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openPlayer, setOpenPlayer] = useState<{ id: string; name: string } | null>(null)
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const openId = useRef<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    getSupportInbox()
      .then(list => { if (active) setConversations(list) })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load the support inbox') })
      .finally(() => { if (active) setLoading(false) })

    const handleMessage = (message: SupportMessage) => {
      setConversations(current => updateInbox(current, message, openId.current))
      if (message.playerId === openId.current) {
        setMessages(current => addMessage(current, message))
        // You're looking at it, so let the server know it's been read
        if (message.from === 'player') getSupportConversation(message.playerId).catch(() => { /* the badge just stays until next time */ })
      }
    }
    socket.on('support:message', handleMessage)
    void joinSupport()
    return () => {
      active = false
      socket.off('support:message', handleMessage)
    }
  }, [])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  async function openConversation(convo: SupportConversation) {
    openId.current = convo.playerId
    setOpenPlayer({ id: convo.playerId, name: convo.playerName })
    setMessages([])
    setDraft('')
    setError('')
    setThreadLoading(true)
    // Opening it marks it read on the server, so clear the badge here too
    setConversations(current => current.map(c => (c.playerId === convo.playerId ? { ...c, unread: 0 } : c)))
    try {
      const data = await getSupportConversation(convo.playerId)
      if (openId.current !== convo.playerId) return
      setOpenPlayer(data.player)
      setMessages(data.messages)
    } catch (err) {
      if (openId.current === convo.playerId) setError(err instanceof Error ? err.message : 'Could not load that conversation')
    } finally {
      // Only the conversation you're looking at now gets to stop the loading message
      if (openId.current === convo.playerId) setThreadLoading(false)
    }
  }

  async function reply() {
    const text = draft.trim()
    if (!openPlayer || !text || sending) return
    setSending(true)
    setError('')
    try {
      const saved = await replySupport(openPlayer.id, text)
      setMessages(current => addMessage(current, saved))
      setConversations(current => updateInbox(current, saved, openId.current))
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your reply could not be sent')
    } finally {
      setSending(false)
    }
  }

  const totalUnread = conversations.reduce((sum, convo) => sum + convo.unread, 0)

  return (
    <section aria-label="Support inbox" className="rounded-2xl" style={{ background: C.panel, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
        <p className="text-sm font-semibold" style={{ margin: 0, color: C.text }}>
          Player support {totalUnread > 0 && <span style={{ color: C.soft }}>· {totalUnread} unread</span>}
        </p>
        <p className="text-xs" style={{ margin: '2px 0 0', color: C.text, opacity: 0.35 }}>Messages from players who need help. Replies show up for them right away.</p>
      </div>

      {error && (
        <p role="alert" className="text-xs" style={{ margin: '12px 20px 0', padding: '10px 14px', borderRadius: 10, background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.35)', color: C.soft }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: 420 }}>
        {/* Everyone who wrote in */}
        <ul aria-label="Conversations" style={{ listStyle: 'none', margin: 0, padding: 12, flex: '1 1 240px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 6, borderRight: `1px solid ${C.border}` }}>
          {loading && <li className="text-xs" style={{ color: C.text, opacity: 0.4, padding: 8 }}>Loading...</li>}
          {!loading && conversations.length === 0 && (
            <li className="text-xs" style={{ color: C.text, opacity: 0.4, padding: 8 }}>No messages from players yet.</li>
          )}
          {conversations.map(convo => {
            const open = openPlayer?.id === convo.playerId
            return (
              <li key={convo.playerId}>
                <button
                  onClick={() => void openConversation(convo)}
                  aria-current={open ? 'true' : undefined}
                  className="rounded-xl"
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 12px', color: C.text,
                    background: open ? 'rgba(107,16,16,0.38)' : C.card,
                    border: `1px solid ${open ? C.red : C.border}`,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span className="text-sm font-semibold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{convo.playerName}</span>
                    {convo.unread > 0 && (
                      <span className="text-xs rounded-full" style={{ flexShrink: 0, padding: '1px 7px', background: 'rgba(192,57,43,0.25)', color: C.soft }} aria-label={`${convo.unread} unread`}>
                        {convo.unread}
                      </span>
                    )}
                  </span>
                  <span className="text-xs" style={{ display: 'block', marginTop: 2, opacity: 0.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {convo.lastFrom === 'admin' ? 'You: ' : ''}{convo.lastMessage}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {/* The open conversation */}
        <div style={{ flex: '2 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {!openPlayer ? (
            <p className="text-sm" style={{ margin: 'auto', padding: 24, color: C.text, opacity: 0.4, textAlign: 'center' }}>Pick a player to read and reply.</p>
          ) : (
            <>
              <p className="text-sm font-semibold" style={{ margin: 0, padding: '12px 16px', borderBottom: `1px solid ${C.border}`, color: C.text }}>
                {openPlayer.name}
              </p>
              <div ref={listRef} aria-live="polite" aria-label={`Messages with ${openPlayer.name}`} style={{ flex: 1, minHeight: 0, maxHeight: 360, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {threadLoading && <p className="text-xs" style={{ margin: 0, color: C.text, opacity: 0.4 }}>Loading...</p>}
                {messages.map(message => {
                  const fromAdmin = message.from === 'admin'
                  return (
                    <div key={message.id} style={{ alignSelf: fromAdmin ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                      <p className="text-xs" style={{ margin: '0 0 3px', color: C.text, opacity: 0.4, textAlign: fromAdmin ? 'right' : 'left' }}>
                        {fromAdmin ? `${message.senderName} · Admin` : message.senderName} {formatTime(message.createdAt) && `· ${formatTime(message.createdAt)}`}
                      </p>
                      <p
                        className="text-sm rounded-xl"
                        style={{
                          margin: 0, padding: '8px 12px', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', color: C.text,
                          background: fromAdmin ? 'rgba(192,57,43,0.22)' : '#1c1e25',
                          border: `1px solid ${fromAdmin ? 'rgba(192,57,43,0.4)' : '#343743'}`,
                        }}
                      >
                        {message.message}
                      </p>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${C.border}` }}>
                <input
                  value={draft}
                  maxLength={MAX_SUPPORT_LENGTH}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') void reply() }}
                  placeholder={`Reply to ${openPlayer.name}...`}
                  aria-label={`Reply to ${openPlayer.name}`}
                  className="text-sm rounded-lg"
                  style={{ flex: 1, minWidth: 0, padding: '8px 12px', background: C.field, border: '1px solid #343743', color: C.text, outline: 'none' }}
                />
                <button
                  onClick={() => void reply()}
                  disabled={!draft.trim() || sending}
                  className="rounded-lg text-sm font-semibold"
                  style={{ border: 'none', padding: '0 14px', background: C.red, color: '#fff', opacity: !draft.trim() || sending ? 0.45 : 1 }}
                >
                  {sending ? 'Sending' : 'Reply'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
