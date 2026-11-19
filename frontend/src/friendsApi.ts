// P11: the calls the Friends page makes to the server. Members only, so the login cookie is sent.
import { apiRequest } from './api'

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

export async function getFriends(): Promise<Friend[]> {
  const data = await apiRequest<{ friends?: Friend[] }>('/api/friends')
  return data.friends ?? []
}

export async function getFriendRequests(): Promise<FriendRequest[]> {
  const data = await apiRequest<{ requests?: FriendRequest[] }>('/api/friends/requests')
  return data.requests ?? []
}

// player can be a username or an email. Returns the server's message, like "Friend request sent to Josue"
export async function sendFriendRequest(player: string): Promise<string> {
  const data = await apiRequest<{ message: string }>('/api/friends/requests', { method: 'POST', body: JSON.stringify({ player }) })
  return data.message
}

export async function acceptFriendRequest(id: string): Promise<void> {
  await apiRequest(`/api/friends/requests/${id}/accept`, { method: 'POST' })
}

export async function ignoreFriendRequest(id: string): Promise<void> {
  await apiRequest(`/api/friends/requests/${id}/decline`, { method: 'POST' })
}

// Remove someone from your friends list. friendId is their player id (Friend.id)
export async function removeFriend(friendId: string): Promise<void> {
  await apiRequest(`/api/friends/${friendId}`, { method: 'DELETE' })
}
