import { useEffect } from 'react';
import { create } from 'zustand';
import { calls } from '@/features/calls/store';
import { qk, queryClient, upsertMessage } from './queries';
import { useSession } from './session';
import { closeSocket, getSocket } from './socket';

/** conversationId → userId currently typing (auto-clears). */
export const useTyping = create<Record<string, string | undefined>>(() => ({}));
export const usePresence = create<Record<string, boolean>>(() => ({}));
const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

/**
 * Mount once at the root while signed in. Bridges socket events into the query cache and call store,
 * so screens only ever read from TanStack Query / Zustand.
 */
export function useRealtime() {
  const status = useSession((s) => s.status);
  useEffect(() => {
    if (status !== 'signedIn') return;
    const s = getSocket();
    s.on('message:new', (m) => {
      upsertMessage(m);
      void queryClient.invalidateQueries({ queryKey: qk.conversations });
      if (m.kind === 'call') void queryClient.invalidateQueries({ queryKey: qk.calls });
      useTyping.setState({ [m.conversationId]: undefined });
    });
    s.on('conv:read', () => queryClient.invalidateQueries({ queryKey: qk.conversations }));
    s.on('typing', ({ conversationId, userId }) => {
      useTyping.setState({ [conversationId]: userId });
      clearTimeout(typingTimers[conversationId]);
      typingTimers[conversationId] = setTimeout(() => useTyping.setState({ [conversationId]: undefined }), 3500);
    });
    s.on('presence', ({ userId, online }) => usePresence.setState({ [userId]: online }));
    s.on('call:incoming', (invite) => calls.onIncoming(invite));
    s.on('call:accepted', ({ callId, join }) => calls.onAccepted(callId, join));
    s.on('call:closed', ({ callId, reason }) => calls.onClosed(callId, reason));
    s.on('call:answered_elsewhere', ({ callId }) => calls.onAnsweredElsewhere(callId));
    if (!s.connected) s.connect();
    return () => closeSocket();
  }, [status]);
}
