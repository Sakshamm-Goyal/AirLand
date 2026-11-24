import type { Server as HttpServer } from 'node:http';
import { type ClientToServer, type ServerToClient, socketSchemas } from '@landconnect/shared';
import { and, eq } from 'drizzle-orm';
import { Server } from 'socket.io';
import { verifyAccess } from '../auth.ts';
import { blockedIn, bus, memberIds, postMessage } from '../conversations.ts';
import { db, schema } from '../db/client.ts';
import { joinInfo } from '../livekit.ts';
import { registerCallHandlers } from './calls.ts';
import { guarded } from './guard.ts';

export function createRealtime(http: HttpServer, corsOrigin: string | string[]) {
  const io = new Server<ClientToServer, ServerToClient, Record<string, never>, { userId: string; name: string }>(http, {
    cors: { origin: corsOrigin },
    // Mobile networks: websocket only (no long-polling upgrade dance), fast dead-peer detection.
    transports: ['websocket'],
    pingInterval: 10_000,
    pingTimeout: 8_000,
    connectionStateRecovery: { maxDisconnectionDuration: 60_000 },
  });
  bus.io = io as never;

  io.use(async (socket, next) => {
    try {
      const user = await verifyAccess(String(socket.handshake.auth.token ?? ''));
      const [row] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, user.id));
      if (!row) throw new Error('gone');
      socket.data = { userId: user.id, name: row.name };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const me = socket.data.userId;
    void socket.join(`user:${me}`);
    socket.broadcast.emit('presence', { userId: me, online: true }); // ponytail: global presence; scope to contacts at scale

    socket.on(
      'message:send',
      guarded(socket, socketSchemas['message:send'], async ({ conversationId, body, clientId }, ack) => {
        const text = body; // trimmed, 1–4000 chars (socketSchemas)
        const ids = await memberIds(conversationId);
        if (!ids.includes(me)) return ack({ ok: false, error: 'Conversation not found' });
        if (await blockedIn(ids, me)) return ack({ ok: false, error: "You can't message this person" });
        ack({ ok: true, data: await postMessage(conversationId, me, text, 'text', null, clientId) });
      }),
    );

    socket.on(
      'typing',
      guarded(socket, socketSchemas['typing'], async ({ conversationId }) => {
        const ids = await memberIds(conversationId);
        if (!ids.includes(me)) return;
        socket.to(ids.filter((id) => id !== me).map((id) => `user:${id}`)).emit('typing', { conversationId, userId: me });
      }),
    );

    socket.on(
      'conv:read',
      guarded(socket, socketSchemas['conv:read'], async ({ conversationId }) => {
        const at = new Date();
        const updated = await db
          .update(schema.conversationMembers)
          .set({ lastReadAt: at })
          .where(and(eq(schema.conversationMembers.conversationId, conversationId), eq(schema.conversationMembers.userId, me)))
          .returning();
        if (!updated.length) return;
        const ids = await memberIds(conversationId);
        io.to(ids.map((id) => `user:${id}`)).emit('conv:read', { conversationId, userId: me, at: at.toISOString() });
      }),
    );

    socket.on(
      'room:join',
      guarded(socket, socketSchemas['room:join'], async ({ conversationId }, ack) => {
        const [conv] = await db
          .select({ kind: schema.conversations.kind })
          .from(schema.conversations)
          .where(eq(schema.conversations.id, conversationId));
        if (!conv || !(await memberIds(conversationId)).includes(me)) return ack({ ok: false, error: 'Room not found' });
        ack({ ok: true, data: await joinInfo(`room_${conversationId}`, { id: me, name: socket.data.name }) });
      }),
    );

    registerCallHandlers(io, socket);

    socket.on('disconnect', () => {
      void io
        .in(`user:${me}`)
        .fetchSockets()
        .then((left) => !left.length && socket.broadcast.emit('presence', { userId: me, online: false }))
        .catch(console.error);
    });
  });

  return io;
}
