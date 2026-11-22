import { socket } from '../../socket'

// P18: connects the live socket (it only connects at tables otherwise) and joins your support room.
// Admins also join the admins' room. Resolves to whether you joined as an admin.
export function joinSupport(): Promise<{ ok: boolean; admin?: boolean }> {
  if (!socket.connected) socket.connect()
  return new Promise(resolve => {
    socket.emit('support:join', (result?: { ok: boolean; admin?: boolean }) => resolve(result ?? { ok: false }))
  })
}
