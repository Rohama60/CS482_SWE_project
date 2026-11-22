import { useState } from 'react'

// P18: the Chat with admin button in the bottom-left corner of the lobby.
// It's a small round button so it covers as little of the lobby as possible,
// and it stretches out to say "Chat with admin" when you hover over it or tab to it.
// It sits on the left so it never covers the ad column (and its Watch Ad buttons) on the right.
// Styles are set here directly, since the project has no Tailwind.
export function SupportButton({ open, unread, onClick }: { open: boolean; unread: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const expanded = hovered || focused
  const label = open ? 'Close' : 'Chat with admin'

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-expanded={open}
      aria-label={open ? 'Close chat with admin' : unread > 0 ? `Chat with admin, ${unread} new ${unread === 1 ? 'reply' : 'replies'}` : 'Chat with admin'}
      title={label}
      className="text-sm font-semibold"
      style={{
        position: 'fixed', left: 16, bottom: 16, zIndex: 61,
        height: 52, minWidth: 52, padding: expanded ? '0 18px' : 0, borderRadius: 999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        border: '1px solid #c0392b', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        background: open ? '#1c1e25' : 'linear-gradient(135deg, #c0392b, #8b1a1a)',
        transition: 'padding 0.15s ease',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>{open ? '✕' : '💬'}</span>
      {expanded && <span data-testid="support-button-label">{label}</span>}
      {/* The count of admin replies waiting, as a badge on the corner */}
      {!open && unread > 0 && (
        <span
          aria-hidden="true"
          data-testid="support-button-badge"
          className="text-xs"
          style={{
            position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, padding: '0 5px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999,
            background: '#fff', color: '#c0392b', border: '2px solid #c0392b', fontWeight: 700,
          }}
        >
          {unread}
        </span>
      )}
    </button>
  )
}
