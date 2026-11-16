import type { Friend } from '../../friendsApi'

const STATUS_COLORS: Record<string, string> = { playing: '#e05c4e', idle: '#f59e0b' }

function initialsOf(name: string) {
  return name.trim().slice(0, 2).toUpperCase()
}

export function FriendAvatar({ friend, size = 'normal' }: { friend: Pick<Friend, 'displayName' | 'status'>; size?: 'normal' | 'small' }) {
  const dimensions = size === 'small' ? 'h-10 w-10' : 'h-10 w-10'
  return (
    <div className={`relative flex ${dimensions} shrink-0 items-center justify-center rounded-full text-xs font-bold`} style={{ background: 'linear-gradient(145deg, #6b1010, #2b0a0b)', border: '1px solid #9d2a23', color: '#e8e4dc' }}>
      {initialsOf(friend.displayName)}
      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2" style={{ background: STATUS_COLORS[friend.status] ?? '#555864', borderColor: '#111318' }} />
    </div>
  )
}
