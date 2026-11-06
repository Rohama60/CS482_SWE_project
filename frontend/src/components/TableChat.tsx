import { useEffect, useRef, useState } from 'react'
import { socket } from '../socket'

// M3: Member chat at a table. Rohama's chat box design, now with real live messages.
// Everyone at the table can read. Only members sitting at the table can send.

export const MEMBERS_ONLY = 'Members Only! Sign up to chat'
export const SEATED_ONLY = 'Take a seat at the table to chat'
export const MAX_MESSAGE_LENGTH = 200

export type ChatMessage = {
  id: string
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

  const canSend = isMember && isSeated
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

  // Keep the newest message in view
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

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
    <div className="relative flex-1 rounded-2xl border p-4" style={{ background: '#14161b', borderColor: '#292c35' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#c0392b' }}>Table Chat</p>
        <span className="text-xs font-semibold" style={{ color: '#e8e4dc', opacity: 0.35 }}>{online ?? 1} online</span>
      </div>

      <div ref={listRef} className="mt-4 flex max-h-44 flex-col gap-3 overflow-y-auto pr-1" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-xs" style={{ color: '#e8e4dc', opacity: 0.3 }}>No messages yet.</p>
        )}
        {messages.map(message => (
          <div key={message.id}>
            <p className="text-xs font-semibold" style={{ color: message.name === myName ? '#f0a097' : '#e8e4dc' }}>{message.name}</p>
            <p className="mt-0.5 text-xs leading-relaxed break-words" style={{ color: '#e8e4dc', opacity: 0.48 }}>{message.message}</p>
          </div>
        ))}
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
          className="pointer-events-none absolute inset-x-4 bottom-16 rounded-lg px-3 py-2 text-center text-xs font-semibold shadow-xl"
          style={{
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
