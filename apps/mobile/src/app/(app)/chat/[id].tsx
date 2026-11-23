import { formatInr, type Message } from '@landconnect/shared';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowUp, Check, ChevronLeft, Clock3, Phone, PhoneIncoming, PhoneMissed, Users, Video } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { Avatar, Button, IconButton, RoleBadge, Text } from '@/components/ui';
import { calls } from '@/features/calls/store';
import { convTitle, peerOf } from '@/lib/conversation';
import { upsertMessage, useConversation, useMessages } from '@/lib/queries';
import { usePresence, useTyping } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { emitAck, getSocket } from '@/lib/socket';
import { clockTime } from '@/lib/time';
import { gutter, makeStyles, radius, type, useTheme } from '@/theme';

type UiMessage = Message & { pending?: boolean; failed?: boolean };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useStyles();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const me = useSession((st) => st.user!.id);
  const conv = useConversation(id).data;
  const msgs = useMessages(id);
  const typingUser = useTyping((t) => t[id]);
  const [text, setText] = useState('');
  const items: UiMessage[] = msgs.data?.pages.flat() ?? [];

  const peer = conv ? peerOf(conv, me) : null;
  const online = usePresence((p) => (peer ? p[peer.id] : false));

  // Mark read on open and whenever a new message lands while we're here.
  const newest = items[0]?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `newest` is the trigger: re-mark read when a message arrives
  useEffect(() => {
    getSocket().emit('conv:read', { conversationId: id });
  }, [id, newest]);

  const send = async (body = text.trim(), retryOf?: UiMessage) => {
    if (!body) return;
    const clientId = retryOf?.clientId ?? `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    if (!retryOf) setText('');
    upsertMessage({
      id: clientId,
      clientId,
      conversationId: id,
      senderId: me,
      kind: 'text',
      body,
      meta: null,
      createdAt: new Date().toISOString(),
      pending: true,
    } as UiMessage);
    try {
      await emitAck<Message>('message:send', { conversationId: id, body, clientId });
    } catch (e) {
      upsertMessage({
        id: clientId,
        clientId,
        conversationId: id,
        senderId: me,
        kind: 'text',
        body,
        meta: null,
        createdAt: new Date().toISOString(),
        failed: true,
      } as UiMessage);
      toast.error((e as Error).message);
    }
  };

  const lastTyping = useRef(0);
  const onType = (v: string) => {
    setText(v);
    if (Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      getSocket().emit('typing', { conversationId: id });
    }
  };

  const isRoom = conv?.kind === 'room';
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[s.header, { paddingTop: insets.top + 6 }]}>
        <IconButton icon={ChevronLeft} label="Back" variant="plain" onPress={() => router.back()} />
        {conv && peer ? (
          <>
            {isRoom ? (
              <View style={s.roomIcon}>
                <Users size={20} color={c.brand} />
              </View>
            ) : (
              <Avatar name={peer.name} uri={peer.avatarUrl} size={40} />
            )}
            <View style={{ flex: 1 }}>
              <Text variant="h2" numberOfLines={1}>
                {convTitle(conv, me)}
              </Text>
              {isRoom ? (
                <Text variant="small" color="muted">
                  {conv.members.length} members
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <RoleBadge role={peer.role} verified={peer.verified} />
                  <Text variant="small" color={typingUser ? 'brand' : 'muted'}>
                    {typingUser ? 'typing…' : online ? 'online' : ''}
                  </Text>
                </View>
              )}
            </View>
            {isRoom ? (
              <Button
                title="Join"
                icon={Video}
                size="md"
                kind="brand"
                onPress={() => router.push({ pathname: '/room/[id]', params: { id } })}
              />
            ) : (
              <>
                <IconButton
                  icon={Phone}
                  label={`Voice call ${peer.name}`}
                  variant="plain"
                  onPress={() => calls.start(id, 'audio', peer, conv.listing?.title ?? null)}
                />
                <IconButton
                  icon={Video}
                  label={`Video call ${peer.name}`}
                  variant="plain"
                  onPress={() => calls.start(id, 'video', peer, conv.listing?.title ?? null)}
                />
              </>
            )}
          </>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>

      {conv?.listing ? (
        <Pressable
          style={s.pinned}
          onPress={() => router.push({ pathname: '/listing/[id]', params: { id: conv.listing!.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Open listing ${conv.listing.title}`}
        >
          <Image source={conv.listing.image} style={s.pinnedImg} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text variant="smallMedium" numberOfLines={1}>
              {conv.listing.title}
            </Text>
            <Text variant="small" color="muted" numberOfLines={1}>
              {formatInr(conv.listing.priceInr)} · {conv.listing.locality}
            </Text>
          </View>
          <Text variant="micro" color="brand">
            View
          </Text>
        </Pressable>
      ) : null}

      <FlashList
        data={items}
        inverted
        keyExtractor={(m) => m.clientId ?? m.id}
        renderItem={({ item, index }) => (
          <Bubble
            m={item}
            mine={item.senderId === me}
            grouped={items[index + 1]?.senderId === item.senderId && items[index + 1]?.kind === 'text'}
            onRetry={() => send(item.body, item)}
          />
        )}
        onEndReached={() => msgs.hasNextPage && !msgs.isFetchingNextPage && msgs.fetchNextPage()}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: 12 }}
        keyboardDismissMode="interactive"
      />

      <KeyboardStickyView offset={{ opened: insets.bottom }}>
        <View style={[s.composer, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            value={text}
            onChangeText={onType}
            placeholder="Message"
            placeholderTextColor={c.muted}
            style={s.input}
            multiline
            maxLength={4000}
            accessibilityLabel="Message"
          />
          <Pressable
            onPress={() => send()}
            disabled={!text.trim()}
            style={[s.send, !text.trim() && { opacity: 0.35 }]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <ArrowUp size={22} color={c.onInk} strokeWidth={2.5} />
          </Pressable>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function Bubble({ m, mine, grouped, onRetry }: { m: UiMessage; mine: boolean; grouped: boolean; onRetry: () => void }) {
  const s = useStyles();
  const { c } = useTheme();
  if (m.kind === 'system') {
    return (
      <View style={s.system}>
        <Text variant="small" color="inkSoft" style={{ textAlign: 'center' }}>
          {m.body}
        </Text>
      </View>
    );
  }
  if (m.kind === 'call') {
    const meta = (m.meta ?? {}) as { kind?: string; status?: string };
    const missed = meta.status !== 'ended';
    const Icon = missed ? PhoneMissed : meta.kind === 'video' ? Video : PhoneIncoming;
    return (
      <View style={[s.call, { alignSelf: mine ? 'flex-end' : 'flex-start' }]}>
        <View style={[s.callIcon, { backgroundColor: missed ? c.dangerSoft : c.brandSoft }]}>
          <Icon size={17} color={missed ? c.danger : c.brand} />
        </View>
        <View>
          <Text variant="smallMedium">{m.body}</Text>
          <Text variant="micro" color="muted">
            {clockTime(m.createdAt)}
          </Text>
        </View>
      </View>
    );
  }
  const Tick = m.failed ? null : m.pending ? Clock3 : Check;
  return (
    <Pressable
      onPress={m.failed ? onRetry : undefined}
      disabled={!m.failed}
      style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', marginTop: grouped ? 2 : 10 }}
    >
      <View style={[s.bubble, mine ? s.out : s.in]}>
        <Text variant="body" style={{ color: mine ? c.bubbleOutText : c.ink }}>
          {m.body}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' }}>
          <Text variant="micro" style={{ color: mine ? 'rgba(243,246,242,0.7)' : c.muted }}>
            {clockTime(m.createdAt)}
          </Text>
          {mine && Tick ? <Tick size={13} color="rgba(243,246,242,0.75)" /> : null}
        </View>
      </View>
      {m.failed ? (
        <Text variant="micro" color="danger" style={{ alignSelf: 'flex-end', marginTop: 3 }}>
          Not sent. Tap to retry
        </Text>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles(({ c }) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingBottom: 10,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderColor: c.line,
  },
  roomIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' },
  pinned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: gutter,
    marginTop: 10,
    padding: 8,
    paddingRight: 14,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  pinnedImg: { width: 44, height: 44, borderRadius: 10, backgroundColor: c.skeleton },
  bubble: { paddingHorizontal: 14, paddingTop: 9, paddingBottom: 6, borderRadius: 18, gap: 2 },
  out: { backgroundColor: c.bubbleOut, borderBottomRightRadius: 6 },
  in: { backgroundColor: c.bubbleIn, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: c.line },
  system: {
    alignSelf: 'center',
    backgroundColor: c.accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    marginVertical: 12,
    maxWidth: '90%',
  },
  call: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: radius.md,
    padding: 10,
    paddingRight: 16,
    marginTop: 10,
  },
  callIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: gutter - 6,
    paddingTop: 10,
    backgroundColor: c.bg,
    borderTopWidth: 1,
    borderColor: c.line,
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 130,
    borderRadius: 23,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    ...type.body,
    color: c.ink,
  },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
}));
