import { formatArea, formatInr, groupInr, type Listing, toSqft } from '@landconnect/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft,
  Droplets,
  FileCheck2,
  Heart,
  Landmark,
  Lock,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
  Trash2,
  Video,
  Waypoints,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { LAND_TYPE_LABEL, PerUnitChip } from '@/components/ListingCard';
import { Avatar, Button, EmptyState, IconButton, RoleBadge, Skeleton, Text } from '@/components/ui';
import { calls } from '@/features/calls/store';
import { useDeleteListing, useListing, useStartConversation, useToggleSave, useUpdateListing } from '@/lib/queries';
import { gutter, makeStyles, radius, useTheme } from '@/theme';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useListing(id);
  const insets = useSafeAreaInsets();
  if (q.data) return <Detail l={q.data} />;
  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      {q.isError ? (
        <EmptyState
          icon={MapPin}
          title="Listing unavailable"
          body="It may have been removed by the owner."
          action={<Button title="Go back" size="md" onPress={() => router.back()} />}
        />
      ) : (
        <View style={{ padding: gutter, gap: 16 }}>
          <Skeleton style={{ height: 320 }} />
          <Skeleton style={{ height: 28, width: '60%' }} />
          <Skeleton style={{ height: 120 }} />
        </View>
      )}
    </View>
  );
}

function Detail({ l }: { l: Listing }) {
  const s = useStyles();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const save = useToggleSave(l);
  const start = useStartConversation();
  const update = useUpdateListing(l.id);
  const del = useDeleteListing();

  const openChat = async () => {
    const conv = await start.mutateAsync(l.id).catch((e: Error) => void toast.error(e.message));
    if (conv) router.push({ pathname: '/chat/[id]', params: { id: conv.id } });
  };
  const call = async (kind: 'audio' | 'video') => {
    const conv = await start.mutateAsync(l.id).catch((e: Error) => void toast.error(e.message));
    if (conv) void calls.start(conv.id, kind, l.owner, l.title);
  };
  const remove = () =>
    Alert.alert('Delete this listing?', 'Buyers will no longer see it. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => del.mutate(l.id, { onSuccess: () => router.back() }) },
    ]);

  const specs = [
    {
      icon: Ruler,
      label: 'Area',
      value: `${formatArea(l.area, l.areaUnit)}`,
      sub: l.areaUnit === 'sqft' ? null : `${groupInr(toSqft(l.area, l.areaUnit))} sq ft`,
    },
    { icon: Landmark, label: 'Land type', value: LAND_TYPE_LABEL[l.landType], sub: l.zoning },
    { icon: Waypoints, label: 'Road access', value: l.roadAccessFt != null ? `${l.roadAccessFt} ft road` : 'Not stated', sub: null },
    {
      icon: Droplets,
      label: 'Water',
      value: l.waterSource ? l.waterSource[0]!.toUpperCase() + l.waterSource.slice(1) : 'Not stated',
      sub: null,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
          >
            {l.images.map((uri) => (
              <Image
                key={uri}
                source={uri}
                style={{ width, height: width * 1.05, backgroundColor: c.skeleton }}
                contentFit="cover"
                transition={250}
                accessibilityIgnoresInvertColors
              />
            ))}
          </ScrollView>
          <View style={[s.topBar, { top: insets.top + 8 }]}>
            <IconButton icon={ChevronLeft} label="Back" variant="glass" onPress={() => router.back()} />
            {!l.isMine ? (
              <IconButton
                icon={Heart}
                label={l.saved ? 'Remove from saved' : 'Save'}
                variant="glass"
                color={l.saved ? c.danger : c.ink}
                onPress={() => save.mutate(!l.saved)}
              />
            ) : null}
          </View>
          <View style={s.counter}>
            <Text variant="micro" style={{ color: '#fff' }}>
              {page + 1} / {l.images.length}
            </Text>
          </View>
        </View>

        <View style={s.sheet}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={s.tag}>
              <Text variant="micro" color="inkSoft">
                {LAND_TYPE_LABEL[l.landType]}
              </Text>
            </View>
            {l.status === 'sold' ? (
              <View style={[s.tag, { backgroundColor: c.dangerSoft }]}>
                <Text variant="micro" color="danger">
                  Sold
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="title">{l.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <MapPin size={15} color={c.muted} />
            <Text variant="body" color="muted">
              {[l.locality, l.district, l.state].filter(Boolean).join(', ')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
            <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>
              {formatInr(l.priceInr)}
            </Text>
            <PerUnitChip listing={l} />
          </View>
          <Text variant="small" color="muted">
            ₹ {groupInr(l.priceInr)}
          </Text>

          <View style={s.grid}>
            {specs.map(({ icon: Icon, label, value, sub }) => (
              <View key={label} style={s.spec}>
                <Icon size={18} color={c.brand} />
                <Text variant="label" color="muted">
                  {label}
                </Text>
                <Text variant="bodyMedium">{value}</Text>
                {sub ? (
                  <Text variant="small" color="muted">
                    {sub}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          {l.titleDocs.length ? (
            <View style={{ gap: 10 }}>
              <Text variant="h1">Title documents</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {l.titleDocs.map((d) => (
                  <View key={d} style={s.doc}>
                    <FileCheck2 size={15} color={c.brand} />
                    <Text variant="smallMedium">{d}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {l.description ? (
            <View style={{ gap: 8 }}>
              <Text variant="h1">About this land</Text>
              <Text variant="body" color="inkSoft">
                {l.description}
              </Text>
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            <Text variant="h1">Location</Text>
            <View style={s.map}>
              <MapView
                style={StyleSheet.absoluteFill}
                liteMode
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                initialRegion={{ latitude: l.lat, longitude: l.lng, latitudeDelta: 0.06, longitudeDelta: 0.06 }}
              >
                {l.approxLocation && !l.isMine ? (
                  <Circle
                    center={{ latitude: l.lat, longitude: l.lng }}
                    radius={1100}
                    fillColor="rgba(28,106,78,0.18)"
                    strokeColor="rgba(28,106,78,0.6)"
                  />
                ) : (
                  <Marker coordinate={{ latitude: l.lat, longitude: l.lng }} />
                )}
              </MapView>
            </View>
            {l.approxLocation && !l.isMine ? (
              <Text variant="small" color="muted">
                Approximate area. The owner shares the exact location in chat.
              </Text>
            ) : null}
          </View>

          <View style={s.owner}>
            <Avatar name={l.owner.name} uri={l.owner.avatarUrl} size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="h2">{l.isMine ? 'You' : l.owner.name}</Text>
              <RoleBadge role={l.owner.role} verified={l.owner.verified} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Lock size={16} color={c.brand} />
              <Text variant="micro" color="muted">
                Phone hidden
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
        {l.isMine ? (
          <>
            <Button
              title={l.status === 'sold' ? 'Mark as available' : 'Mark as sold'}
              kind={l.status === 'sold' ? 'brand' : 'primary'}
              style={{ flex: 1 }}
              loading={update.isPending}
              onPress={() => update.mutate({ status: l.status === 'sold' ? 'active' : 'sold' })}
            />
            <IconButton icon={Trash2} label="Delete listing" size={54} color={c.danger} onPress={remove} />
          </>
        ) : (
          <>
            <Button title="Chat" icon={MessageCircle} kind="secondary" style={{ flex: 1 }} loading={start.isPending} onPress={openChat} />
            <Button title="Call" icon={Phone} style={{ flex: 1 }} disabled={start.isPending} onPress={() => call('audio')} />
            <IconButton icon={Video} label="Video call" variant="ink" size={54} onPress={() => call('video')} />
          </>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ c }) => ({
  topBar: { position: 'absolute', left: gutter, right: gutter, flexDirection: 'row', justifyContent: 'space-between' },
  counter: {
    position: 'absolute',
    right: gutter,
    bottom: 40,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  sheet: {
    marginTop: -24,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: c.bg,
    padding: gutter,
    paddingTop: 24,
    gap: 12,
  },
  tag: { backgroundColor: c.surfaceAlt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 8 },
  spec: { width: '48.5%', backgroundColor: c.surface, borderRadius: radius.md, padding: 14, gap: 4, borderWidth: 1, borderColor: c.line },
  doc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.brandSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  map: { height: 180, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.surfaceAlt },
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: c.line,
    marginTop: 8,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: gutter,
    paddingTop: 12,
    backgroundColor: c.bg,
    borderTopWidth: 1,
    borderColor: c.line,
  },
}));
