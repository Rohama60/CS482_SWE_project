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

// P3: watch a table without taking a seat. Works on full tables too.
export async function spectateTable(tableId: string | number, inviteCode?: string): Promise<{ table: PokerTableData; role: 'spectator' | 'player' }> {
  const guest = getGuest()
  const res = await fetch(`/api/tables/${tableId}/spectate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ inviteCode, guestId: guest?.id }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not watch the table')
  return { table: data.table, role: data.role }
}

// P3: leave spectator mode. Errors are ignored since the player is leaving anyway.
export async function stopSpectating(tableId: string | number): Promise<void> {
  const guest = getGuest()
  await fetch(`/api/tables/${tableId}/stop-spectating`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ guestId: guest?.id }),
  }).catch(() => {})
}
