import type { CallEndReason, CallInvite, CallKind, JoinInfo, PublicUser } from '@landconnect/shared';
import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';
import { toast } from 'sonner-native';
import { create } from 'zustand';
import { emitAck, getSocket } from '@/lib/socket';

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active';

interface CallState {
  phase: CallPhase;
  callId: string | null;
  conversationId: string | null;
  kind: CallKind;
  peer: PublicUser | null;
  listingTitle: string | null;
  expiresAt: number | null;
  join: JoinInfo | null;
  answeredAt: number | null;
}

const idle: CallState = {
  phase: 'idle',
  callId: null,
  conversationId: null,
  kind: 'audio',
  peer: null,
  listingTitle: null,
  expiresAt: null,
  join: null,
  answeredAt: null,
};

export const useCall = create<CallState>(() => idle);

const REASON_TEXT: Record<CallEndReason, string | null> = {
  ended: null,
  rejected: 'Call declined',
  cancelled: 'Call cancelled',
  missed: 'No answer',
  busy: 'They are on another call',
  failed: 'Call failed',
};

function reset() {
  Vibration.cancel();
  useCall.setState(idle);
}

/**
 * Imperative API used by screens. The state machine itself lives on the server;
 * the call UI is a root-level overlay that renders whenever phase !== 'idle' (no navigation races).
 */
export const calls = {
  async start(conversationId: string, kind: CallKind, peer: PublicUser, listingTitle: string | null) {
    if (useCall.getState().phase !== 'idle') return toast('You are already on a call');
    useCall.setState({ ...idle, phase: 'outgoing', conversationId, kind, peer, listingTitle });
    try {
      const { callId, expiresAt } = await emitAck<{ callId: string; expiresAt: number }>('call:invite', { conversationId, kind });
      // A busy/closed event can arrive before this ack; only adopt the id if we're still dialing.
      if (useCall.getState().phase === 'outgoing') useCall.setState({ callId, expiresAt });
    } catch (e) {
      reset();
      toast.error((e as Error).message);
    }
  },

  async accept() {
    const { callId } = useCall.getState();
    if (!callId) return;
    Vibration.cancel();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    useCall.setState({ phase: 'connecting' });
    try {
      const join = await emitAck<JoinInfo>('call:accept', { callId });
      useCall.setState({ phase: 'active', join, answeredAt: Date.now() });
    } catch (e) {
      reset();
      toast.error((e as Error).message);
    }
  },

  decline(message?: string) {
    const { callId } = useCall.getState();
    if (callId) getSocket().emit('call:reject', { callId, message });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    reset();
  },

  /** Caller hangs up while ringing, or either side ends an active call. */
  hangUp() {
    const { callId, phase } = useCall.getState();
    if (callId) getSocket().emit(phase === 'outgoing' ? 'call:cancel' : 'call:end', { callId });
    reset();
  },

  // ── server events ──
  onIncoming(invite: CallInvite) {
    const s = useCall.getState();
    if (s.phase !== 'idle') return; // server already answers "busy"; ignore stray replays
    useCall.setState({
      ...idle,
      phase: 'incoming',
      callId: invite.callId,
      conversationId: invite.conversationId,
      kind: invite.kind,
      peer: invite.from,
      listingTitle: invite.listingTitle,
      expiresAt: invite.expiresAt,
    });
    Vibration.vibrate([0, 800, 1200], true);
  },
  onAccepted(callId: string, join: JoinInfo) {
    if (useCall.getState().callId !== callId) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    useCall.setState({ phase: 'active', join, answeredAt: Date.now() });
  },
  onClosed(callId: string, reason: CallEndReason) {
    const s = useCall.getState();
    if (s.callId !== callId) return;
    const text = REASON_TEXT[reason];
    if (text && !(reason === 'missed' && s.phase === 'incoming')) toast(text);
    reset();
  },
  onAnsweredElsewhere(callId: string) {
    if (useCall.getState().callId === callId && useCall.getState().phase === 'incoming') reset();
  },
};
