// Mute Others: the calls the table chat makes to save who you muted. Members only, so the login cookie is sent.
import { apiRequest } from './api'

// The ids of the players you muted
export async function getMutedPlayers(): Promise<string[]> {
  const data = await apiRequest<{ muted?: string[] }>('/api/chat/mutes')
  return data.muted ?? []
}

export async function mutePlayer(playerId: string): Promise<void> {
  await apiRequest('/api/chat/mutes', { method: 'POST', body: JSON.stringify({ playerId }) })
}

export async function unmutePlayer(playerId: string): Promise<void> {
  await apiRequest(`/api/chat/mutes/${playerId}`, { method: 'DELETE' })
}
