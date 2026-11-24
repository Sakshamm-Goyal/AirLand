import type { Conversation } from '@landconnect/shared';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { MessagesSquare, Phone, Plus, Users, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Chip, EmptyState, Skeleton, Text } from '@/components/ui';
import { convTitle, peerOf } from '@/lib/conversation';
import { useConversations, usePullToRefresh } from '@/lib/queries';
import { usePresence, useTyping } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { chatTime } from '@/lib/time';
import { gutter, makeStyles, useTheme } from '@/theme';

export default function Chats() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useConversations();
  const pull = usePullToRefresh(q.refetch);
  const canRoom = useSession((st) => st.user?.role !== 'buyer');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const data = (q.data ?? []).filter((x) => !unreadOnly || x.unread > 0);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlashList
        data={data}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => <Row conv={item} />}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 12, paddingHorizontal: gutter, paddingBottom: 8, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="display" style={{ flex: 1 }}>
                Chats
              </Text>
              {canRoom ? (
                <Button title="Deal room" icon={Plus} size="md" kind="secondary" onPress={() => router.push('/room/new')} />
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label="All" selected={!unreadOnly} onPress={() => setUnreadOnly(false)} />
              <Chip label="Unread" selected={unreadOnly} onPress={() => setUnreadOnly(true)} />
            </View>
          </View>
        }
        ListEmptyComponent={
          q.isPending ? (
            <View style={{ paddingHorizontal: gutter, gap: 14 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} style={{ height: 64 }} />
              ))}
            </View>
          ) : unreadOnly ? (
            <EmptyState icon={MessagesSquare} title="You're all caught up" body="No unread messages." />
          ) : (
            <EmptyState
              icon={MessagesSquare}
              title="No conversations yet"
              body="Open a listing and tap Chat to ask the owner a question. Your number stays private."
            />
          )
        }
        refreshControl={<RefreshControl {...pull} tintColor={c.muted} colors={[c.accent]} progressBackgroundColor={c.surface} />}
      />
    </View>
  );
}

function Row({ conv }: { conv: Conversation }) {
  const s = useStyles();
  const { c } = useTheme();
  const me = useSession((st) => st.user!.id);
  const peer = peerOf(conv, me);
  const online = usePresence((p) => p[peer.id]);
  const typing = useTyping((t) => t[conv.id]);
  const last = conv.lastMessage;
  const preview = typing ? 'typing…' : last ? `${last.senderId === me ? 'You: ' : ''}${last.body}` : 'Say hello';
  const CallIcon = last?.kind === 'call' ? ((last.meta as { kind?: string })?.kind === 'video' ? Video : Phone) : null;
  const unread = conv.unread > 0;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: conv.id } })}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: c.surfaceAlt }]}
      accessibilityRole="button"
    >
      <View style={{ width: 64, height: 64 }}>
        {conv.kind === 'room' ? (
          <View style={s.roomIcon}>
            <Users size={24} color={c.ink} />
          </View>
        ) : conv.listing?.image ? (
          <>
            <Image source={conv.listing.image} style={s.thumb} contentFit="cover" transition={200} recyclingKey={conv.id} />
            <View style={s.avatarRing}>
              <Avatar name={peer.name} uri={peer.avatarUrl} size={28} />
            </View>
          </>
        ) : (
          <Avatar name={peer.name} uri={peer.avatarUrl} size={56} />
        )}
        {online && conv.kind === 'direct' ? <View style={s.online} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="h2" numberOfLines={1} style={{ flex: 1 }}>
            {convTitle(conv, me)}
          </Text>
          <Text variant="small" color="muted">
            {last ? chatTime(last.createdAt) : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {CallIcon ? <CallIcon size={14} color={c.muted} /> : null}
          <Text
            variant={unread ? 'smallMedium' : 'small'}
            color={typing ? 'brand' : unread ? 'ink' : 'muted'}
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {preview}
          </Text>
          {unread ? <View style={s.dot} accessibilityLabel={`${conv.unread} unread`} /> : null}
        </View>
        {conv.listing ? (
          <Text variant="small" color="muted" numberOfLines={1}>
            {conv.listing.title}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ c }) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: gutter, paddingVertical: 12 },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: c.skeleton },
  avatarRing: { position: 'absolute', right: 0, bottom: 0, borderRadius: 16, borderWidth: 2, borderColor: c.bg },
  roomIcon: { width: 56, height: 56, borderRadius: 12, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  online: {
    position: 'absolute',
    left: 44,
    top: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: c.ok,
    borderWidth: 2,
    borderColor: c.bg,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: c.accent },
}));
