import type { Conversation } from '@landconnect/shared';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Lock, MessagesSquare, Phone, Plus, Users, Video } from 'lucide-react-native';
import { Pressable, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, EmptyState, Skeleton, Text } from '@/components/ui';
import { convTitle, peerOf } from '@/lib/conversation';
import { useConversations } from '@/lib/queries';
import { usePresence, useTyping } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { chatTime } from '@/lib/time';
import { gutter, makeStyles, useTheme } from '@/theme';

export default function Chats() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useConversations();
  const canRoom = useSession((st) => st.user?.role !== 'buyer');
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlashList
        data={q.data ?? []}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => <Row conv={item} />}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: gutter, paddingBottom: 12, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="display" style={{ flex: 1 }}>
                Chats
              </Text>
              {canRoom ? (
                <Button title="Deal room" icon={Plus} size="md" kind="secondary" onPress={() => router.push('/room/new')} />
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Lock size={13} color={c.brand} />
              <Text variant="small" color="muted">
                Numbers stay private. Chat and call right here.
              </Text>
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
          ) : (
            <EmptyState
              icon={MessagesSquare}
              title="No conversations yet"
              body="Open a listing and tap Chat to ask the owner a question."
            />
          )
        }
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.muted} />}
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

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/chat/[id]', params: { id: conv.id } })}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: c.surfaceAlt }]}
      accessibilityRole="button"
    >
      <View>
        {conv.kind === 'room' ? (
          <View style={s.roomIcon}>
            <Users size={22} color={c.brand} />
          </View>
        ) : (
          <Avatar name={peer.name} uri={peer.avatarUrl} size={52} />
        )}
        {online && conv.kind === 'direct' ? <View style={s.online} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="h2" numberOfLines={1} style={{ flex: 1 }}>
            {convTitle(conv, me)}
          </Text>
          <Text variant="small" color={conv.unread ? 'brand' : 'muted'}>
            {last ? chatTime(last.createdAt) : ''}
          </Text>
        </View>
        {conv.listing ? (
          <Text variant="micro" color="accent" numberOfLines={1}>
            re: {conv.listing.title}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {CallIcon ? <CallIcon size={14} color={c.muted} /> : null}
          <Text variant="small" color={typing ? 'brand' : 'muted'} numberOfLines={1} style={{ flex: 1 }}>
            {preview}
          </Text>
          {conv.unread ? (
            <View style={s.badge}>
              <Text variant="micro" style={{ color: '#fff' }}>
                {conv.unread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ c }) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: gutter, paddingVertical: 12 },
  roomIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.brandSoft, alignItems: 'center', justifyContent: 'center' },
  online: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: c.ok,
    borderWidth: 2,
    borderColor: c.bg,
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
