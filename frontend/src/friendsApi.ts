// P11: the calls the Friends page makes to the server. Members only, so the login cookie is sent.

export type Friend = {
  id: string
  username: string
  displayName: string
  chips: number
  status: 'playing' | 'idle'
  activity: string
  tableId?: string // only when they're playing
}

export type FriendRequest = {
  id: string
  from: { id: string; username: string; displayName: string; chips: number }
}

async function send(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong')
  return data
}

export async function getFriends(): Promise<Friend[]> {
  const data = await send('/api/friends')
  return data.friends ?? []
}

export async function getFriendRequests(): Promise<FriendRequest[]> {
  const data = await send('/api/friends/requests')
  return data.requests ?? []
}

// player can be a username or an email. Returns the server's message, like "Friend request sent to Josue"
export async function sendFriendRequest(player: string): Promise<string> {
  const data = await send('/api/friends/requests', { method: 'POST', body: JSON.stringify({ player }) })
  return data.message
}

export async function acceptFriendRequest(id: string): Promise<void> {
  await send(`/api/friends/requests/${id}/accept`, { method: 'POST' })
}

export async function ignoreFriendRequest(id: string): Promise<void> {
  await send(`/api/friends/requests/${id}/decline`, { method: 'POST' })
}
