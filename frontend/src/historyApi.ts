// P13 Game History: the call that loads your finished hands. Members only, so the login cookie is sent.
import { apiRequest } from './api'

export type HistoryStats = {
  hands: number
  wins: number
  losses: number
  winRate: number // 0 to 100
  netChips: number // chips won minus chips lost, over every hand
}

export type HistoryGame = {
  id: string
  tableName: string
  playedAt?: string
  result: 'won' | 'lost'
  folded: boolean
  chipsChange: number
  handName: string | null // your winning hand, when you won at showdown
  summary: string // like "Josue wins $40 with Two Pair"
  players: number
  opponents: string[]
}

export type GameHistoryData = { stats: HistoryStats; games: HistoryGame[] }

export async function getGameHistory(): Promise<GameHistoryData> {
  const data = await apiRequest<Partial<GameHistoryData>>('/api/history')
  return {
    stats: data.stats ?? { hands: 0, wins: 0, losses: 0, winRate: 0, netChips: 0 },
    games: data.games ?? [],
  }
}
