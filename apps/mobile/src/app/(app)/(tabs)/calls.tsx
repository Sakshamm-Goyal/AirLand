import { type CallLogEntry, formatDuration } from '@landconnect/shared';
import { FlashList } from '@shopify/flash-list';
import { ArrowDownLeft, ArrowUpRight, Phone, PhoneCall, Video } from 'lucide-react-native';
import { RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, EmptyState, IconButton, Skeleton, Text } from '@/components/ui';
import { calls } from '@/features/calls/store';
import { useCallLog } from '@/lib/queries';
import { chatTime } from '@/lib/time';
import { gutter, useTheme } from '@/theme';

const STATUS: Record<CallLogEntry['status'], string> = {
  ringing: 'Ringing',
  accepted: 'Connected',
  ended: 'Answered',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  missed: 'Missed',
  busy: 'Busy',
};

export default function Calls() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const q = useCallLog();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlashList
        data={q.data ?? []}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => <Row e={item} />}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: gutter, paddingBottom: 12 }}>
            <Text variant="display">Calls</Text>
          </View>
        }
        ListEmptyComponent={
          q.isPending ? (
            <View style={{ paddingHorizontal: gutter, gap: 14 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} style={{ height: 60 }} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon={PhoneCall}
              title="No calls yet"
              body="Call a seller or buyer from a listing or chat. Your number is never shared."
            />
          )
        }
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={c.muted} />}
      />
    </View>
  );
}

function Row({ e }: { e: CallLogEntry }) {
  const { c } = useTheme();
  const bad = e.status !== 'ended' && e.status !== 'accepted';
  const Dir = e.direction === 'outgoing' ? ArrowUpRight : ArrowDownLeft;
  const KindIcon = e.kind === 'video' ? Video : Phone;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: gutter, paddingVertical: 10 }}>
      <Avatar name={e.peer.name} uri={e.peer.avatarUrl} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="h2" style={{ color: bad && e.direction === 'incoming' ? c.danger : c.ink }} numberOfLines={1}>
          {e.peer.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Dir size={15} color={bad ? c.danger : c.ok} />
          <Text variant="small" color="muted">
            {STATUS[e.status]}
            {e.durationSec != null ? ` · ${formatDuration(e.durationSec)}` : ''} · {chatTime(e.startedAt)}
          </Text>
        </View>
      </View>
      <IconButton
        icon={KindIcon}
        label={`Call ${e.peer.name} back`}
        variant="plain"
        color={c.brand}
        onPress={() => calls.start(e.conversationId, e.kind, e.peer, null)}
      />
    </View>
  );
}
