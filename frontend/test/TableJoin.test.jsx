/**
 * @jest-environment jsdom
 */
// P7 (Join Game) and P3 (Spectating): the small helpers the lobby and table
// screen use to talk to the server, plus the guest that they send along (G1).
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals'
import { joinTable, joinTableByCode, spectateTable, stopSpectating } from '../src/tableJoin.ts'
import { getGuest, clearGuest, startGuestSession } from '../src/guestSession.ts'

const GUEST = { id: 'g1', displayName: 'Guest-1234', chipamount: 500, role: 'guest' }
const TABLE = { id: 't1', name: 'Velvet Room', players: 2, max: 4 }

function reply(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) })
}

const sentBody = (call = 0) => JSON.parse(global.fetch.mock.calls[call][1].body)

beforeEach(() => {
  sessionStorage.clear()
})

afterEach(() => {
  delete global.fetch
})

describe('Joining a table (P7)', () => {
  test('joinTable posts to the table and returns the updated table', async () => {
    global.fetch = jest.fn(() => reply({ table: TABLE }))

    const table = await joinTable('t1')

    expect(global.fetch).toHaveBeenCalledWith('/api/tables/t1/join', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }))
    expect(table).toEqual(TABLE)
  })

  test('a guest sends their guest id along', async () => {
    sessionStorage.setItem('guest', JSON.stringify(GUEST))
    global.fetch = jest.fn(() => reply({ table: TABLE }))

    await joinTable('t1', 'K7Q2MX')

    expect(sentBody()).toEqual({ inviteCode: 'K7Q2MX', guestId: 'g1' })
  })

  test('joinTableByCode posts the code to the join-code route', async () => {
    global.fetch = jest.fn(() => reply({ table: TABLE }))

    await joinTableByCode('K7Q2MX')

    expect(global.fetch.mock.calls[0][0]).toBe('/api/tables/join-code')
    expect(sentBody().inviteCode).toBe('K7Q2MX')
  })

  test('a failed join throws the server message', async () => {
    global.fetch = jest.fn(() => reply({ error: 'Table is full' }, false))
    await expect(joinTable('t1')).rejects.toThrow('Table is full')
  })

  test('a failed join with no message throws a general one', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.reject(new Error('bad json')) }))
    await expect(joinTableByCode('ZZZZZZ')).rejects.toThrow('Could not join the table')
  })
})

describe('Watching a table (P3)', () => {
  test('spectateTable returns the table and whether you are watching or playing', async () => {
    global.fetch = jest.fn(() => reply({ table: TABLE, role: 'spectator' }))

    const result = await spectateTable('t1')

    expect(global.fetch.mock.calls[0][0]).toBe('/api/tables/t1/spectate')
    expect(result).toEqual({ table: TABLE, role: 'spectator' })
  })

  test('a guest watching sends their guest id', async () => {
    sessionStorage.setItem('guest', JSON.stringify(GUEST))
    global.fetch = jest.fn(() => reply({ table: TABLE, role: 'spectator' }))

    await spectateTable('t1')

    expect(sentBody().guestId).toBe('g1')
  })

  test('a failed watch throws the server message', async () => {
    global.fetch = jest.fn(() => reply({ error: 'This table is private' }, false))
    await expect(spectateTable('t1')).rejects.toThrow('This table is private')
  })

  test('a failed watch with no message throws a general one', async () => {
    global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.reject(new Error('bad json')) }))
    await expect(spectateTable('t1')).rejects.toThrow('Could not watch the table')
  })

  test('stopSpectating tells the server you left', async () => {
    global.fetch = jest.fn(() => reply({}))
    await stopSpectating('t1')
    expect(global.fetch.mock.calls[0][0]).toBe('/api/tables/t1/stop-spectating')
  })

  test('stopSpectating does not crash if the server is down', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('network down')))
    await expect(stopSpectating('t1')).resolves.toBeUndefined()
  })
})

describe('The guest sent with each request (G1)', () => {
  test('getGuest is empty before playing as a guest', () => {
    expect(getGuest()).toBeNull()
  })

  test('getGuest returns null if what was saved is broken', () => {
    sessionStorage.setItem('guest', '{not json')
    expect(getGuest()).toBeNull()
  })

  test('startGuestSession makes a new guest and remembers it', async () => {
    global.fetch = jest.fn(() => reply({ guest: GUEST }))

    const guest = await startGuestSession()

    expect(global.fetch).toHaveBeenCalledWith('/api/guests', { method: 'POST' })
    expect(guest).toEqual(GUEST)
    expect(getGuest()).toEqual(GUEST)
  })

  test('an existing guest is reused if the server still has it', async () => {
    sessionStorage.setItem('guest', JSON.stringify(GUEST))
    global.fetch = jest.fn(() => reply({ guest: GUEST }))

    const guest = await startGuestSession()

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith('/api/guests/g1')
    expect(guest).toEqual(GUEST)
  })

  test('an expired guest is replaced with a new one', async () => {
    sessionStorage.setItem('guest', JSON.stringify(GUEST))
    const fresh = { ...GUEST, id: 'g2', displayName: 'Guest-9999' }
    global.fetch = jest.fn()
      .mockReturnValueOnce(reply({ error: 'Guest not found' }, false))
      .mockReturnValueOnce(reply({ guest: fresh }))

    const guest = await startGuestSession()

    expect(guest).toEqual(fresh)
    expect(getGuest()).toEqual(fresh)
  })

  test('a failed guest start throws', async () => {
    global.fetch = jest.fn(() => reply({}, false))
    await expect(startGuestSession()).rejects.toThrow('Could not start a guest session')
  })

  test('clearGuest forgets the guest', () => {
    sessionStorage.setItem('guest', JSON.stringify(GUEST))
    clearGuest()
    expect(getGuest()).toBeNull()
  })
})
