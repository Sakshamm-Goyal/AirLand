import { type CallLogEntry, formatDuration } from '@landconnect/shared';
import { FlashList } from '@shopify/flash-list';
import { ArrowDownLeft, ArrowUpRight, Lock, Phone, PhoneCall, PhoneMissed, Video } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Chip, EmptyState, IconButton, Skeleton, Text } from '@/components/ui';
import { calls } from '@/features/calls/store';
import { useCallLog, usePullToRefresh } from '@/lib/queries';
import { chatTime, dayLabel } from '@/lib/time';
import { gutter, makeStyles, radius, useTheme } from '@/theme';

const STATUS: Record<CallLogEntry['status'], string> = {
  ringing: 'Ringing',
  accepted: 'Connected',
  ended: 'Answered',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  missed: 'Missed',
  busy: 'Busy',
};

const isMissed = (e: CallLogEntry) => e.direction === 'incoming' && (e.status === 'missed' || e.status === 'rejected');

/** "Today" / "Yesterday" stay as is; anything older is grouped as "Earlier". */
const section = (iso: string) => {
  const d = dayLabel(iso);
  return d === 'Today' || d === 'Yesterday' ? d : 'Earlier';
};

type Row = { type: 'header'; title: string } | { type: 'call'; e: CallLogEntry };

export default function Calls() {
  const { c } = useTheme();
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const q = useCallLog();
  const pull = usePullToRefresh(q.refetch);
  const [missedOnly, setMissedOnly] = useState(false);
  const entries = (q.data ?? []).filter((e) => !missedOnly || isMissed(e));
  const rows: Row[] = [];
  for (const e of entries) {
    const title = section(e.startedAt);
    if (rows.findLast((r) => r.type === 'header')?.title !== title) rows.push({ type: 'header', title } as Row);
    rows.push({ type: 'call', e });
  }
  const missedCount = (q.data ?? []).filter(isMissed).length;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlashList<Row>
        data={rows}
        keyExtractor={(r) => (r.type === 'header' ? `h:${r.title}` : r.e.id)}
        getItemType={(r) => r.type}
        renderItem={({ item }) =>
          item.type === 'header' ? (
            <Text variant="h2" style={s.section}>
              {item.title}
            </Text>
          ) : (
            <CallRow e={item.e} />
          )
        }
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: gutter, paddingBottom: 8, gap: 14 }}>
            <View style={{ gap: 4 }}>
              <Text variant="display">Calls</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Lock size={13} color={c.brand} />
                <Text variant="small" color="muted">
                  In-app calls. Nobody sees your number.
                </Text>
              </View>
            </View>
            {q.data?.length ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Chip label="All" selected={!missedOnly} onPress={() => setMissedOnly(false)} />
                <Chip
                  label={missedCount ? `Missed · ${missedCount}` : 'Missed'}
                  icon={PhoneMissed}
                  selected={missedOnly}
                  onPress={() => setMissedOnly(true)}
                />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          q.isPending ? (
            <View style={{ paddingHorizontal: gutter, gap: 14 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} style={{ height: 64, borderRadius: radius.lg }} />
              ))}
            </View>
          ) : missedOnly ? (
            <EmptyState icon={PhoneMissed} title="No missed calls" body="You're all caught up." />
          ) : (
            <EmptyState
              icon={PhoneCall}
              title="No calls yet"
              body="Call a seller or buyer from a listing or chat. Your number is never shared."
            />
          )
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl {...pull} tintColor={c.muted} colors={[c.accent]} progressBackgroundColor={c.surface} />}
      />
    </View>
  );
}

function CallRow({ e }: { e: CallLogEntry }) {
  const { c } = useTheme();
  const s = useStyles();
  const bad = e.status !== 'ended' && e.status !== 'accepted';
  const missed = isMissed(e);
  const Dir = e.direction === 'outgoing' ? ArrowUpRight : ArrowDownLeft;
  const KindIcon = e.kind === 'video' ? Video : Phone;
  return (
    <View style={s.row}>
      <View>
        <Avatar name={e.peer.name} uri={e.peer.avatarUrl} size={50} />
        <View style={[s.kind, { backgroundColor: missed ? c.danger : c.ink }]}>
          <KindIcon size={11} color={missed ? c.onPhoto : c.onInk} strokeWidth={2.5} />
        </View>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="h2" color={missed ? 'danger' : 'ink'} numberOfLines={1}>
          {e.peer.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Dir size={15} color={bad ? c.danger : c.ok} />
          <Text variant="small" color="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {STATUS[e.status]}
            {e.durationSec != null ? ` · ${formatDuration(e.durationSec)}` : ''} · {chatTime(e.startedAt)}
          </Text>
        </View>
      </View>
      <IconButton
        icon={KindIcon}
        label={`Call ${e.peer.name} back`}
        variant="plain"
        color={c.ink}
        size={46}
        onPress={() => calls.start(e.conversationId, e.kind, e.peer, null)}
        style={{ borderWidth: 1, borderColor: c.line }}
      />
    </View>
  );
}

const useStyles = makeStyles(({ c }) => ({
  section: { paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 6, textTransform: 'none', letterSpacing: 0, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: gutter, paddingVertical: 10 },
  kind: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.bg,
  },
}));
