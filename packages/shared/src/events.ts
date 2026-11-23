import type { CallKind, JoinInfo, Message, PublicUser } from './schemas.ts';

/**
 * Socket.IO contract. Both server and client are typed against these maps,
 * so renaming an event or changing a payload is a compile error on both sides.
 */

export type Ack<T> = (res: { ok: true; data: T } | { ok: false; error: string }) => void;

export interface CallInvite {
  callId: string;
  conversationId: string;
  kind: CallKind;
  from: PublicUser;
  listingTitle: string | null;
  /** Epoch ms after which the server marks the call missed. */
  expiresAt: number;
}

export type CallEndReason = 'rejected' | 'cancelled' | 'missed' | 'busy' | 'ended' | 'failed';

export interface ServerToClient {
  'message:new': (m: Message) => void;
  'conv:read': (p: { conversationId: string; userId: string; at: string }) => void;
  typing: (p: { conversationId: string; userId: string }) => void;
  presence: (p: { userId: string; online: boolean }) => void;

  'call:incoming': (invite: CallInvite) => void;
  /** Sent to the caller; the callee gets its JoinInfo in the accept ack. */
  'call:accepted': (p: { callId: string; join: JoinInfo }) => void;
  /** Terminal: rejected / cancelled / missed / busy / ended. */
  'call:closed': (p: { callId: string; reason: CallEndReason; durationSec: number | null }) => void;
  /** Another device of the same user picked up or declined. */
  'call:answered_elsewhere': (p: { callId: string }) => void;
}

export interface ClientToServer {
  'message:send': (p: { conversationId: string; body: string; clientId: string }, ack: Ack<Message>) => void;
  typing: (p: { conversationId: string }) => void;
  'conv:read': (p: { conversationId: string }) => void;

  'call:invite': (p: { conversationId: string; kind: CallKind }, ack: Ack<{ callId: string; expiresAt: number }>) => void;
  'call:accept': (p: { callId: string }, ack: Ack<JoinInfo>) => void;
  'call:reject': (p: { callId: string; message?: string }) => void;
  'call:cancel': (p: { callId: string }) => void;
  'call:end': (p: { callId: string }) => void;
  'room:join': (p: { conversationId: string }, ack: Ack<JoinInfo>) => void;
}

export const RING_TIMEOUT_MS = 30_000;
