import { useEffect, useRef, useState } from 'react'
import { socket } from '../../socket'
import { getMySupport, sendSupportMessage, MAX_SUPPORT_LENGTH, type SupportMessage } from '../../supportApi'
import { joinSupport } from './supportSocket'

// P18: As a Player, I want to chat with an admin, so that I can get help with a problem.
// A chat box that opens over the lobby. Admin replies show up live.
// Styles are set here directly, since the project has no Tailwind.

const C = { panel: '#14161b', border: '#292c35', text: '#e8e4dc', red: '#c0392b', soft: '#f0a097', field: '#0d0f13' }

export function formatTime(createdAt?: string) {
  if (!createdAt) return ''
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// Adds a message unless it's already there (you get your own message back live too)
export function addMessage(list: SupportMessage[], message: SupportMessage) {
  return list.some(existing => existing.id === message.id) ? list : [...list, message]
}

// Where the chat box opens. In the lobby it opens bottom-left, right above the Chat with admin button.
export type SupportCorner = 'bottom-right' | 'bottom-left'

export function SupportChat({ onClose, corner = 'bottom-right' }: { onClose: () => void; corner?: SupportCorner }) {
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const myId = useRef('')
  const listRef = useRef<HTMLDivElement>(null)

  // Load your conversation, then listen for admin replies
  useEffect(() => {
    let active = true
    getMySupport()
      .then(data => {
        if (!active) return
        myId.current = data.playerId
        setMessages(data.messages)
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load your messages') })
      .finally(() => { if (active) setLoading(false) })

    const handleMessage = (message: SupportMessage) => {
      if (message.playerId === myId.current) setMessages(current => addMessage(current, message))
    }
    socket.on('support:message', handleMessage)
    void joinSupport()
    return () => {
      active = false
      socket.off('support:message', handleMessage)
    }
  }, [])

  // Keep the newest message in view
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  async function send() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    try {
      const saved = await sendSupportMessage(text)
      setMessages(current => addMessage(current, saved))
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your message could not be sent')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Chat with an admin"
      className="rounded-2xl"
      style={{
        position: 'fixed', zIndex: 60, width: 'min(360px, calc(100vw - 32px))',
        ...(corner === 'bottom-left'
          ? { left: 16, bottom: 80, height: 'min(480px, calc(100vh - 112px))' }
          : { right: 16, bottom: 16, height: 'min(480px, calc(100vh - 32px))' }),
        display: 'flex', flexDirection: 'column', background: C.panel, border: `1px solid ${C.border}`, boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '16px 16px 12px', borderBottom: `1px solid ${C.border}` }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ margin: 0, color: C.red }}>Support</p>
          <p className="text-sm font-semibold" style={{ margin: '2px 0 0', color: C.text }}>Chat with an admin</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg text-sm"
          style={{ background: '#1c1e25', border: '1px solid #343743', color: C.text, width: 30, height: 30, lineHeight: 1 }}
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>

      <div ref={listRef} aria-live="polite" aria-label="Support messages" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <p className="text-xs" style={{ margin: 0, color: C.text, opacity: 0.4 }}>Loading...</p>}
        {!loading && messages.length === 0 && !error && (
          <p className="text-xs" style={{ margin: 0, color: C.text, opacity: 0.45, lineHeight: 1.6 }}>
            Having a problem? Send a message and an admin will reply here.
          </p>
        )}
        {messages.map(message => {
          const mine = message.from === 'player'
          return (
            <div key={message.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
              <p className="text-xs" style={{ margin: '0 0 3px', color: C.text, opacity: 0.4, textAlign: mine ? 'right' : 'left' }}>
                {mine ? 'You' : `${message.senderName} · Admin`} {formatTime(message.createdAt) && `· ${formatTime(message.createdAt)}`}
              </p>
              <p
                className="text-sm rounded-xl"
                style={{
                  margin: 0, padding: '8px 12px', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap',
                  background: mine ? 'rgba(192,57,43,0.22)' : '#1c1e25',
                  border: `1px solid ${mine ? 'rgba(192,57,43,0.4)' : '#343743'}`,
                  color: C.text,
                }}
              >
                {message.message}
              </p>
            </div>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="text-xs" style={{ margin: '0 16px 8px', padding: '8px 12px', borderRadius: 10, background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.35)', color: C.soft }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: `1px solid ${C.border}` }}>
        <input
          value={draft}
          maxLength={MAX_SUPPORT_LENGTH}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') void send() }}
          placeholder="Describe your problem..."
          aria-label="Message to an admin"
          className="text-sm rounded-lg"
          style={{ flex: 1, minWidth: 0, padding: '8px 12px', background: C.field, border: '1px solid #343743', color: C.text, outline: 'none' }}
        />
        <button
          onClick={() => void send()}
          disabled={!draft.trim() || sending}
          className="rounded-lg text-sm font-semibold"
          style={{ border: 'none', padding: '0 14px', background: C.red, color: '#fff', opacity: !draft.trim() || sending ? 0.45 : 1 }}
        >
          {sending ? 'Sending' : 'Send'}
        </button>
      </div>
    </div>
  )
}
