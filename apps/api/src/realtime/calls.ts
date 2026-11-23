import type { CallEndReason, CallInvite, CallKind, ClientToServer, ServerToClient } from '@landconnect/shared';
import { formatDuration } from '@landconnect/shared';
import { eq } from 'drizzle-orm';
import type { Server, Socket } from 'socket.io';
import { config } from '../config.ts';
import { isBlocked, memberIds, notify, postMessage } from '../conversations.ts';
import { db, schema } from '../db/client.ts';
import { toPublicUser } from '../dto.ts';
import { joinInfo } from '../livekit.ts';
import { sendPush } from '../push.ts';

type IO = Server<ClientToServer, ServerToClient>;
type Sock = Socket<ClientToServer, ServerToClient, Record<string, never>, { userId: string; name: string }>;

/**
 * Call lifecycle (signalling only; media goes through LiveKit):
 *
 *   invite ──► ringing ──accept──► accepted ──end──► ended
 *                 │ reject → rejected · cancel → cancelled · 30 s → missed
 *   invite while either side is busy → busy
 *
 * ponytail: state is in process memory, so the API runs as ONE instance.
 * To scale out: Socket.IO Redis adapter + move these two maps to Redis with SET NX for accept.
 */
interface LiveCall {
  id: string;
  conversationId: string;
  kind: CallKind;
  callerId: string;
  calleeId: string;
  roomName: string;
  invite: CallInvite;
  timer?: NodeJS.Timeout;
  answeredAt?: number;
}

const ringing = new Map<string, LiveCall>();
const active = new Map<string, LiveCall>();

const busy = (userId: string) => [...ringing.values(), ...active.values()].some((c) => c.callerId === userId || c.calleeId === userId);

/** Chat bubble text for each outcome, e.g. "Video call · 2:14", "Missed voice call". */
function bubbleText(kind: CallKind, reason: CallEndReason, durationSec: number | null) {
  const K = kind === 'video' ? 'Video' : 'Voice';
  const k = kind === 'video' ? 'video' : 'voice';
  if (reason === 'ended') return durationSec != null ? `${K} call · ${formatDuration(durationSec)}` : `${K} call`;
  if (reason === 'missed') return `Missed ${k} call`;
  if (reason === 'busy') return `${K} call · line busy`;
  return `${K} call ${reason === 'rejected' ? 'declined' : reason === 'cancelled' ? 'cancelled' : 'failed'}`;
}

/** Move a call to a terminal state exactly once: persist, log a chat bubble, tell both sides. */
async function settle(call: LiveCall, reason: CallEndReason) {
  if (!ringing.delete(call.id) && !active.delete(call.id)) return; // already settled
  clearTimeout(call.timer);
  const durationSec = call.answeredAt ? Math.round((Date.now() - call.answeredAt) / 1000) : null;
  const status = reason === 'failed' ? 'ended' : reason;
  await db.update(schema.calls).set({ status, endedAt: new Date() }).where(eq(schema.calls.id, call.id));
  const body = bubbleText(call.kind, reason, durationSec);
  await postMessage(call.conversationId, call.callerId, body, 'call', { kind: call.kind, status, durationSec, callId: call.id });
  notify([call.callerId, call.calleeId], 'call:closed', { callId: call.id, reason, durationSec });
}

export function registerCallHandlers(io: IO, socket: Sock) {
  const me = socket.data.userId;
  const fail = (ack: (r: { ok: false; error: string }) => void, error: string) => ack({ ok: false, error });

  // A callee who (re)connects while still being rung gets the invite again (app was backgrounded / reconnecting).
  for (const c of ringing.values()) if (c.calleeId === me) socket.emit('call:incoming', c.invite);

  socket.on('call:invite', async ({ conversationId, kind }, ack) => {
    try {
      const ids = await memberIds(conversationId);
      if (!ids.includes(me)) return fail(ack, 'Conversation not found');
      const calleeId = ids.find((id) => id !== me);
      if (!calleeId || ids.length !== 2) return fail(ack, 'Use “Join meeting” for group rooms');
      const [callee] = await db.select().from(schema.users).where(eq(schema.users.id, calleeId));
      if (!callee) return fail(ack, 'User not found');
      if (callee.callPolicy === 'nobody' || (await isBlocked(me, calleeId))) return fail(ack, 'This person is not taking calls');
      if (busy(me)) return fail(ack, 'You are already on a call');

      const [caller] = await db.select().from(schema.users).where(eq(schema.users.id, me));
      const [conv] = await db
        .select({ title: schema.listings.title })
        .from(schema.conversations)
        .leftJoin(schema.listings, eq(schema.listings.id, schema.conversations.listingId))
        .where(eq(schema.conversations.id, conversationId));
      const [row] = await db
        .insert(schema.calls)
        .values({ conversationId, callerId: me, calleeId, kind, roomName: 'pending', status: busy(calleeId) ? 'busy' : 'ringing' })
        .returning();
      const id = row!.id;
      const roomName = `call_${id}`;
      await db.update(schema.calls).set({ roomName }).where(eq(schema.calls.id, id));

      const expiresAt = Date.now() + config.RING_TIMEOUT_MS;
      const invite: CallInvite = {
        callId: id,
        conversationId,
        kind,
        from: toPublicUser(caller!),
        listingTitle: conv?.title ?? null,
        expiresAt,
      };
      const call: LiveCall = { id, conversationId, kind, callerId: me, calleeId, roomName, invite };

      if (busy(calleeId)) {
        ringing.set(id, call); // so settle() can run once
        ack({ ok: true, data: { callId: id, expiresAt } });
        return settle(call, 'busy');
      }

      call.timer = setTimeout(() => void settle(call, 'missed'), config.RING_TIMEOUT_MS);
      ringing.set(id, call);
      ack({ ok: true, data: { callId: id, expiresAt } });
      io.to(`user:${calleeId}`).emit('call:incoming', invite);
      void sendPush(callee.pushToken, `${caller!.name}`, `Incoming ${kind} call on LandConnect`, { type: 'call', callId: id });
    } catch (err) {
      console.error(err);
      fail(ack, 'Could not start the call');
    }
  });

  socket.on('call:accept', async ({ callId }, ack) => {
    const call = ringing.get(callId);
    if (!call || call.calleeId !== me) return fail(ack, 'This call has ended');
    // Single-threaded event loop: delete+set is atomic, so a second device's accept finds nothing.
    ringing.delete(callId);
    clearTimeout(call.timer);
    call.answeredAt = Date.now();
    active.set(callId, call);
    try {
      await db.update(schema.calls).set({ status: 'accepted', answeredAt: new Date() }).where(eq(schema.calls.id, callId));
      const [callee, caller] = await Promise.all(
        [call.calleeId, call.callerId].map(async (id) => (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0]!),
      );
      const [mine, theirs] = await Promise.all([joinInfo(call.roomName, callee!), joinInfo(call.roomName, caller!)]);
      ack({ ok: true, data: mine });
      io.to(`user:${call.callerId}`).emit('call:accepted', { callId, join: theirs });
      socket.to(`user:${me}`).emit('call:answered_elsewhere', { callId });
    } catch (err) {
      console.error(err);
      fail(ack, 'Could not connect the call');
      await settle(call, 'failed');
    }
  });

  socket.on('call:reject', async ({ callId, message }) => {
    const call = ringing.get(callId);
    if (!call || call.calleeId !== me) return;
    socket.to(`user:${me}`).emit('call:answered_elsewhere', { callId });
    await settle(call, 'rejected');
    if (message?.trim()) await postMessage(call.conversationId, me, message.trim().slice(0, 500));
  });

  socket.on('call:cancel', async ({ callId }) => {
    const call = ringing.get(callId);
    if (call?.callerId === me) await settle(call, 'cancelled');
  });

  socket.on('call:end', async ({ callId }) => {
    const call = active.get(callId) ?? ringing.get(callId);
    if (!call || (call.callerId !== me && call.calleeId !== me)) return;
    await settle(call, active.has(callId) ? 'ended' : call.callerId === me ? 'cancelled' : 'rejected');
  });

  socket.on('disconnect', async () => {
    // Only act when the user has no other live socket (multi-device / quick reconnect).
    if ((await io.in(`user:${me}`).fetchSockets()).length) return;
    // Caller vanished mid-ring → cancel. Active calls keep going: media is in LiveKit and survives socket blips.
    for (const c of ringing.values()) if (c.callerId === me) await settle(c, 'cancelled');
  });
}

/** For tests. */
export const _state = { ringing, active };
