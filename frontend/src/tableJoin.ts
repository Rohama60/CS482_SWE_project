// P7: asks the server for a seat, as a logged-in user (cookie) or as a guest (guestId from G1).
import { getGuest } from './guestSession.ts'
import type { PokerTableData } from './views/TableCreation.tsx'

async function sendJoin(url: string, body: Record<string, unknown>): Promise<PokerTableData> {
  const guest = getGuest()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ...body, guestId: guest?.id }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not join the table')
  return data.table as PokerTableData
}

export function joinTable(tableId: string | number, inviteCode?: string) {
  return sendJoin(`/api/tables/${tableId}/join`, { inviteCode })
}

export function joinTableByCode(inviteCode: string) {
  return sendJoin('/api/tables/join-code', { inviteCode })
}
