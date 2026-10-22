// G1: keeps the current guest in sessionStorage.
// sessionStorage clears when the tab closes, so the guest's data is not kept after they leave.

export type Guest = {
  id: string
  displayName: string
  chipamount: number
  role: 'guest'
}

const KEY = 'guest'

export function getGuest(): Guest | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Guest) : null
  } catch {
    return null
  }
}

export function clearGuest() {
  try { sessionStorage.removeItem(KEY) } catch { /* ignore */ }
}

// Reuses the guest from this tab if there is one, otherwise asks the server for a new one.
export async function startGuestSession(): Promise<Guest> {
  const existing = getGuest()
  if (existing) {
    const check = await fetch(`/api/guests/${existing.id}`)
    if (check.ok) return existing
    clearGuest() // expired on the server
  }

  const res = await fetch('/api/guests', { method: 'POST' })
  if (!res.ok) throw new Error('Could not start a guest session')

  const data = await res.json()
  try { sessionStorage.setItem(KEY, JSON.stringify(data.guest)) } catch { /* ignore */ }
  return data.guest as Guest
}
