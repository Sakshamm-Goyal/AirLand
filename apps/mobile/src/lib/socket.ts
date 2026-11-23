import type { ClientToServer, ServerToClient } from '@landconnect/shared';
import { io, type Socket } from 'socket.io-client';
import { API_URL, refreshSession } from './api';
import { useSession } from './session';

export type AppSocket = Socket<ServerToClient, ClientToServer>;

let socket: AppSocket | null = null;

/** One socket per signed-in session. The token is read on every (re)connect, so refreshed tokens are picked up. */
export function getSocket(): AppSocket {
  if (socket) return socket;
  socket = io(API_URL, {
    transports: ['websocket'],
    auth: (cb) => cb({ token: useSession.getState().accessToken }),
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
  });
  socket.on('connect_error', async (err) => {
    if (err.message === 'unauthorized' && (await refreshSession())) socket?.connect();
  });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}

/** Promise wrapper for ack-style events. */
export function emitAck<T>(
  event: 'call:invite' | 'call:accept' | 'room:join' | 'message:send',
  payload: object,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    (getSocket().timeout(timeoutMs).emit as (...a: unknown[]) => void)(
      event,
      payload,
      (err: Error | null, res: { ok: true; data: T } | { ok: false; error: string }) => {
        if (err) return reject(new Error('No response from server. Check your connection.'));
        if (!res.ok) return reject(new Error(res.error));
        resolve(res.data);
      },
    );
  });
}
