import { apiRequest, guestRequestHeaders } from './api'
import { getGuest } from './guestSession'
import type { PokerTableData } from './views/TableCreation'

export type CardData = { rank: string; suit: string }
export type TableSeat = {
  kind: 'user' | 'guest'
  refId: string
  displayName: string
  ready?: boolean
  isHost?: boolean
}
export type ServerPlayer = {
  refId: string
  displayName: string
  isBot: boolean
  chips: number
  folded: boolean
  allIn: boolean
  bet: number
}
export type LegalActions = {
  canAct: boolean
  toCall?: number
  canCheck?: boolean
  canCall?: boolean
  canRaise?: boolean
  minRaise?: number
  maxRaise?: number
}
export type GameState = {
  _id: string
  ante: number
  handStartIndex: number
  handStartPlayerId: string
  currentBet: number
  currentTurn: string
  playerBets: Record<string, number>
  potSize: number
  round: string
  participants?: ServerPlayer[]
  legal?: LegalActions
  myHand?: CardData[] | null
  myTurnToDraw?: boolean
  winners?: { refId: string; amount: number; handName: string | null }[]
  resultText?: string
  revealedHands?: Record<string, CardData[]>
  lastAction?: { playerId: string; type: 'fold' | 'check' | 'call' | 'raise' | 'draw'; amount: number }
}

function playerHeaders(): Record<string, string> {
  return guestRequestHeaders(getGuest()?.id)
}

export function getBotGame(id: string) {
  return apiRequest<{ game: GameState }>(`/api/bot-games/${id}`, {
    headers: playerHeaders(),
  })
}

export function sendBotAction(
  id: string,
  path: 'action' | 'draw',
  body: object,
) {
  return apiRequest<{ game: GameState }>(`/api/bot-games/${id}/${path}`, {
    method: 'POST',
    headers: playerHeaders(),
    body: JSON.stringify(body),
  })
}

export function startBotGame(tableId: string | number) {
  return apiRequest<{ game: GameState; seats: TableSeat[] }>('/api/bot-games', {
    method: 'POST',
    headers: playerHeaders(),
    body: JSON.stringify({ tableId }),
  }).catch(error => {
    if (error instanceof Error && error.message === 'Something went wrong') {
      throw new Error('Failed to start game')
    }
    throw error
  })
}

export function getPlayerChips() {
  return apiRequest<{ chipamount: number }>('/api/players/me/chips', {
    headers: playerHeaders(),
  })
}

export function getPlayerHand(id: string) {
  return apiRequest<{ cards: CardData[] }>(`/api/games/${id}/hand`, {
    headers: playerHeaders(),
  })
}

export function leaveTable(tableId: string | number) {
  return apiRequest(`/api/tables/${tableId}/leave`, {
    method: 'POST',
    headers: playerHeaders(),
    body: JSON.stringify({ guestId: getGuest()?.id }),
  })
}

export function getTable(tableId: string | number) {
  return apiRequest<{ table?: PokerTableData; seats?: TableSeat[] }>(`/api/tables/${tableId}`)
}
