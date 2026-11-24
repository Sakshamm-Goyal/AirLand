import type { Conversation, PublicUser } from '@landconnect/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, Search, ShieldBan, Users, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { toast } from 'sonner-native';
import { FormScreen } from '@/components/FormScreen';
import { Avatar, Button, Chip, EmptyState, Field, RoleBadge, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { peerOf } from '@/lib/conversation';
import { qk, useBlocks, useConversations, useMyListings } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { makeStyles, radius, type, useTheme } from '@/theme';

const MAX = 7; // createRoomSchema: up to 7 others, 8 with you

type Contact = PublicUser & { about: string | null };

/** Sellers/brokers group people they already chat with into a deal room (group chat + video meeting). */
export default function NewRoom() {
  const s = useStyles();
  const { c } = useTheme();
  const me = useSession((st) => st.user!.id);
  const qc = useQueryClient();
  const convs = useConversations().data ?? [];
  const blocked = new Set((useBlocks().data ?? []).map((u) => u.id));
  const myListings = (useMyListings().data?.items ?? []).filter((l) => l.status === 'active');

  // Your 1:1 contacts (the server only accepts these), newest chat first, with the plot you talk about.
  const contacts = [
    ...new Map(
      convs
        .filter((x) => x.kind === 'direct')
        .map((x) => {
          const p = peerOf(x, me);
          return [p.id, { ...p, about: x.listing?.title ?? null }] as [string, Contact];
        }),
    ).values(),
  ];
  const [title, setTitle] = useState('');
  const [listingId, setListingId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const shown = contacts.filter((u) => !q.trim() || u.name.toLowerCase().includes(q.trim().toLowerCase()));
  const pickedUsers = picked.map((id) => contacts.find((u) => u.id === id)!).filter(Boolean);
  const full = picked.length >= MAX;

  const toggle = (u: Contact) => {
    if (blocked.has(u.id))
      return toast(`You blocked ${u.name}`, { description: 'Unblock them from the chat or your profile to add them.' });
    if (!picked.includes(u.id) && full) return toast(`Up to ${MAX} people per room`);
    void Haptics.selectionAsync();
    setPicked((p) => (p.includes(u.id) ? p.filter((x) => x !== u.id) : [...p, u.id]));
  };

  const create = useMutation({
    mutationFn: () => api.post<Conversation>('/conversations/rooms', { title: title.trim(), listingId, memberIds: picked }),
    onSuccess: (conv) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void qc.invalidateQueries({ queryKey: qk.conversations });
      router.replace({ pathname: '/chat/[id]', params: { id: conv.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ready = title.trim().length >= 3 && picked.length > 0;

  return (
    <FormScreen
      title="New deal room"
      subtitle="A group chat and video meeting for a site visit or a negotiation. Numbers stay hidden here too."
      footer={
        <Button
          title={picked.length ? `Create room · ${picked.length + 1} people` : 'Create room'}
          onPress={() => create.mutate()}
          loading={create.isPending}
          disabled={!ready}
        />
      }
    >
      <Field
        label="Room name"
        placeholder="e.g. Devanahalli site visit, Saturday"
        value={title}
        onChangeText={setTitle}
        maxLength={60}
        hint={title.trim().length < 3 ? 'At least 3 characters' : `${title.length}/60`}
      />

      {myListings.length ? (
        <View style={{ gap: 8 }}>
          <Text variant="smallMedium" color="inkSoft">
            About a plot (optional)
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {myListings.map((l) => (
              <Chip
                key={l.id}
                label={l.title}
                selected={listingId === l.id}
                onPress={() => setListingId(listingId === l.id ? null : l.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
        <Text variant="h1" style={{ flex: 1 }}>
          Add people
        </Text>
        <Text variant="smallMedium" color={full ? 'accent' : 'muted'}>
          {picked.length}/{MAX}
        </Text>
      </View>

      {pickedUsers.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingVertical: 2 }}>
          {pickedUsers.map((u) => (
            <Animated.View key={u.id} entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} layout={LinearTransition}>
              <Pressable
                onPress={() => toggle(u)}
                style={{ alignItems: 'center', width: 64, gap: 4 }}
                accessibilityLabel={`Remove ${u.name}`}
              >
                <View>
                  <Avatar name={u.name} uri={u.avatarUrl} size={52} />
                  <View style={[s.remove, { borderColor: c.bg }]}>
                    <X size={11} color={c.onInk} strokeWidth={3} />
                  </View>
                </View>
                <Text variant="micro" numberOfLines={1}>
                  {u.name.split(' ')[0]}
                </Text>
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>
      ) : null}

      {contacts.length > 5 ? (
        <View style={s.search}>
          <Search size={18} color={c.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search people"
            placeholderTextColor={c.muted}
            style={s.searchInput}
            maxLength={60}
            accessibilityLabel="Search people"
          />
        </View>
      ) : null}

      {contacts.length ? (
        <View style={{ gap: 8 }}>
          {shown.map((u) => {
            const on = picked.includes(u.id);
            const isBlocked = blocked.has(u.id);
            return (
              <Pressable
                key={u.id}
                onPress={() => toggle(u)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: isBlocked }}
                accessibilityLabel={`${u.name}${isBlocked ? ', blocked' : ''}`}
                style={[s.row, on && { borderColor: c.ink, borderWidth: 2, padding: 11 }, isBlocked && { opacity: 0.5 }]}
              >
                <Avatar name={u.name} uri={u.avatarUrl} size={44} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="bodyMedium" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {u.name}
                    </Text>
                    <RoleBadge role={u.role} verified={u.verified} />
                  </View>
                  <Text variant="small" color="muted" numberOfLines={1}>
                    {isBlocked ? 'Blocked · unblock to add' : u.about ? `Chatting about ${u.about}` : 'In your chats'}
                  </Text>
                </View>
                {isBlocked ? (
                  <ShieldBan size={20} color={c.muted} />
                ) : (
                  <View style={[s.check, on && { backgroundColor: c.ink, borderColor: c.ink }]}>
                    {on ? <Check size={14} color={c.onInk} strokeWidth={3} /> : null}
                  </View>
                )}
              </Pressable>
            );
          })}
          {!shown.length ? (
            <Text variant="body" color="muted" style={{ textAlign: 'center', paddingVertical: 16 }}>
              No one called “{q.trim()}” in your chats.
            </Text>
          ) : null}
        </View>
      ) : (
        <EmptyState
          icon={Users}
          title="No one to add yet"
          body="People appear here once you've chatted with them about a plot. Only people you already talk to can be added."
        />
      )}
    </FormScreen>
  );
}

const useStyles = makeStyles(({ c }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    minHeight: 68,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    minHeight: 48,
    borderRadius: radius.full,
    backgroundColor: c.surfaceAlt,
  },
  searchInput: { flex: 1, ...type.body, color: c.ink, paddingVertical: 10 },
}));
