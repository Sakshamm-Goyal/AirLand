import type { ClientToServer, ServerToClient } from '@landconnect/shared';
import type { Socket } from 'socket.io';
import type { z } from 'zod';

type Sock = Socket<ClientToServer, ServerToClient, Record<string, never>, { userId: string; name: string }>;
export type Reply = (r: { ok: true; data: unknown } | { ok: false; error: string }) => void;

const WINDOW_MS = 10_000;
const MAX_EVENTS = 30; // typing is throttled to one per 2 s client-side, so real use stays far below this
const usage = new WeakMap<Sock, { start: number; count: number }>();

function allow(socket: Sock) {
  const now = Date.now();
  const u = usage.get(socket);
  if (!u || now - u.start > WINDOW_MS) {
    usage.set(socket, { start: now, count: 1 });
    return true;
  }
  return ++u.count <= MAX_EVENTS;
}

/**
 * Wraps every client→server socket handler: per-socket rate limit, payload validated against its shared schema,
 * and no error ever escapes. An unhandled rejection in an async handler would kill the process, and every call with it.
 */
export function guarded<S extends z.ZodType>(socket: Sock, schema: S, handler: (p: z.infer<S>, ack: Reply) => unknown) {
  return async (payload: unknown, ack?: unknown) => {
    const reply: Reply = typeof ack === 'function' ? (ack as Reply) : () => {};
    if (!allow(socket)) return reply({ ok: false, error: "You're going too fast. Wait a few seconds." });
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return reply({ ok: false, error: 'Invalid request' });
    try {
      await handler(parsed.data, reply);
    } catch (err) {
      console.error(err);
      reply({ ok: false, error: 'Something went wrong' });
    }
  };
}
