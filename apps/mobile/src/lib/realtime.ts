import type { Conversation, Message } from '@landconnect/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { toast } from 'sonner-native';
import { create } from 'zustand';
import { calls } from '@/features/calls/store';
import { qk, queryClient, upsertMessage } from './queries';
import { useSession } from './session';
import { closeSocket, getSocket } from './socket';

/** conversationId → userId currently typing (auto-clears). */
export const useTyping = create<Record<string, string | undefined>>(() => ({}));
export const usePresence = create<Record<string, boolean>>(() => ({}));
const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

/** The chat on screen right now (set by the chat screen while focused), so we don't banner what you're reading. */
export const activeChat: { id: string | null } = { id: null };

/** WhatsApp-style in-app banner for a message that lands while you're elsewhere in the app. Tap opens the chat. */
function bannerFor(m: Message) {
  const me = useSession.getState().user?.id;
  if (m.kind === 'system' || !m.senderId || m.senderId === me || activeChat.id === m.conversationId) return;
  if (m.kind === 'call') return; // the call UI and the call log already cover calls
  const conv = queryClient.getQueryData<Conversation[]>(qk.conversations)?.find((c) => c.id === m.conversationId);
  const sender = conv?.members.find((u) => u.id === m.senderId)?.name ?? 'New message';
  const title = conv?.kind === 'room' ? `${sender} · ${conv.title}` : sender;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  toast(title, {
    id: `msg-${m.conversationId}`, // a burst from one chat updates one banner instead of stacking
    description: m.body.length > 90 ? `${m.body.slice(0, 90)}…` : m.body,
    duration: 4000,
    onPress: () => {
      toast.dismiss(`msg-${m.conversationId}`);
      router.push({ pathname: '/chat/[id]', params: { id: m.conversationId } });
    },
  });
}

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
      bannerFor(m);
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
