// P18 Chat with Admin: the calls the support chat (players) and the support inbox (admins) make.
// Members only, so the login cookie is sent.
import { apiRequest } from './api'

export type SupportMessage = {
  id: string
  playerId: string // whose conversation this message is in
  from: 'player' | 'admin'
  senderName: string
  message: string
  createdAt?: string
}

export type SupportConversation = {
  playerId: string
  playerName: string
  lastMessage: string
  lastFrom: 'player' | 'admin'
  lastAt?: string
  unread: number // player messages no admin has read yet
}

export const MAX_SUPPORT_LENGTH = 500

// ---- Players ----

export async function getMySupport(): Promise<{ playerId: string; messages: SupportMessage[] }> {
  const data = await apiRequest<{ playerId?: string; messages?: SupportMessage[] }>('/api/support')
  return { playerId: data.playerId ?? '', messages: data.messages ?? [] }
}

export async function getMyUnread(): Promise<number> {
  const data = await apiRequest<{ unread?: number }>('/api/support/unread')
  return data.unread ?? 0
}

export async function sendSupportMessage(message: string): Promise<SupportMessage> {
  const data = await apiRequest<{ message: SupportMessage }>('/api/support', { method: 'POST', body: JSON.stringify({ message }) })
  return data.message
}

// ---- Admins ----

export async function getSupportInbox(): Promise<SupportConversation[]> {
  const data = await apiRequest<{ conversations?: SupportConversation[] }>('/api/admin/support')
  return data.conversations ?? []
}

export async function getSupportConversation(playerId: string): Promise<{ player: { id: string; name: string }; messages: SupportMessage[] }> {
  const data = await apiRequest<{ player?: { id: string; name: string }; messages?: SupportMessage[] }>(`/api/admin/support/${playerId}`)
  return { player: data.player ?? { id: playerId, name: 'Player' }, messages: data.messages ?? [] }
}

export async function replySupport(playerId: string, message: string): Promise<SupportMessage> {
  const data = await apiRequest<{ message: SupportMessage }>(`/api/admin/support/${playerId}`, { method: 'POST', body: JSON.stringify({ message }) })
  return data.message
}
