import { formatArea, formatInr, formatPerUnit, groupInr, type Listing, toSqft } from '@landconnect/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft,
  Droplets,
  FileCheck2,
  Heart,
  Lock,
  MapPin,
  Pencil,
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
import { LAND_TYPE_LABEL } from '@/components/ListingCard';
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
  const { width, height } = useWindowDimensions();
  const heroH = Math.round(Math.min(width * 0.95, height * 0.5));
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

  const place = [l.locality, l.district, l.state].filter(Boolean).join(', ');
  const facts = [
    formatArea(l.area, l.areaUnit),
    l.roadAccessFt != null ? `${l.roadAccessFt} ft road` : null,
    l.waterSource ? l.waterSource[0]!.toUpperCase() + l.waterSource.slice(1) : null,
  ].filter(Boolean);
  const highlights = [
    l.titleDocs.length
      ? { icon: FileCheck2, title: 'Title documents available', body: `${l.titleDocs.join(', ')} can be shared in chat.` }
      : null,
    {
      icon: Ruler,
      title: formatArea(l.area, l.areaUnit),
      body: l.areaUnit === 'sqft' ? 'Plot area' : `${groupInr(toSqft(l.area, l.areaUnit))} sq ft in total`,
    },
    {
      icon: Waypoints,
      title: l.roadAccessFt != null ? `${l.roadAccessFt} ft road access` : 'Road access not stated',
      body: l.roadAccessFt != null ? 'Vehicle access to the plot.' : 'Ask the owner in chat.',
    },
    {
      icon: Droplets,
      title: l.waterSource ? `Water: ${l.waterSource}` : 'Water source not stated',
      body: l.waterSource ? 'Water available on the land.' : 'Ask the owner in chat.',
    },
    { icon: Lock, title: 'Your number stays private', body: 'Chat and call the owner inside LandConnect.' },
  ].filter((h): h is { icon: typeof Ruler; title: string; body: string } => h != null);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            scrollEventThrottle={32}
          >
            {l.images.map((uri) => (
              <Image
                key={uri}
                source={uri}
                style={{ width, height: heroH, backgroundColor: c.skeleton }}
                contentFit="cover"
                transition={250}
                accessibilityIgnoresInvertColors
              />
            ))}
          </ScrollView>
          <View style={[s.topBar, { top: insets.top + 8 }]}>
            <IconButton icon={ChevronLeft} label="Back" variant="glass" size={40} onPress={() => router.back()} />
            {!l.isMine ? (
              <IconButton
                icon={Heart}
                label={l.saved ? 'Remove from saved' : 'Save'}
                variant="glass"
                size={40}
                color={l.saved ? c.accent : c.ink}
                onPress={() => save.mutate(!l.saved)}
              />
            ) : null}
          </View>
          <View style={s.counter} accessibilityLabel={`Photo ${page + 1} of ${l.images.length}`}>
            <Text variant="micro" color="onPhoto">
              {page + 1} / {l.images.length}
            </Text>
          </View>
        </View>

        <View style={s.sheet}>
          <View style={{ gap: 6 }}>
            {l.status === 'sold' ? (
              <View style={s.sold}>
                <Text variant="micro" color="danger">
                  Sold
                </Text>
              </View>
            ) : null}
            <Text variant="display">{l.title}</Text>
            <Text variant="bodyMedium" style={{ marginTop: 6 }}>
              {LAND_TYPE_LABEL[l.landType]} land in {place}
            </Text>
            <Text variant="small" color="muted">
              {facts.join(' · ')}
            </Text>
          </View>

          <View style={s.divider} />
          <View style={s.owner}>
            <Avatar name={l.owner.name} uri={l.owner.avatarUrl} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h2">{l.isMine ? 'Listed by you' : `Listed by ${l.owner.name}`}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <RoleBadge role={l.owner.role} verified={l.owner.verified} />
                <Text variant="small" color="muted">
                  · Phone hidden
                </Text>
              </View>
            </View>
          </View>

          <View style={s.divider} />
          <View style={{ gap: 22 }}>
            {highlights.map(({ icon: Icon, title, body }) => (
              <View key={title} style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-start' }}>
                <Icon size={24} color={c.ink} strokeWidth={1.6} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="h2">{title}</Text>
                  <Text variant="small" color="muted">
                    {body}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {l.description ? (
            <>
              <View style={s.divider} />
              <View style={{ gap: 10 }}>
                <Text variant="h1">About this land</Text>
                <Text variant="body" color="inkSoft">
                  {l.description}
                </Text>
              </View>
            </>
          ) : null}

          <View style={s.divider} />
          <View style={{ gap: 12 }}>
            <Text variant="h1">Where it is</Text>
            <Text variant="small" color="muted">
              {place}
            </Text>
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
                    fillColor="rgba(227,28,95,0.14)"
                    strokeColor="rgba(227,28,95,0.6)"
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
        </View>
      </ScrollView>

      <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
        {l.isMine ? (
          <>
            <Button
              title="Edit"
              icon={Pencil}
              kind="secondary"
              onPress={() => router.push({ pathname: '/listing/edit', params: { id: l.id } })}
            />
            <Button
              title={l.status === 'sold' ? 'Mark available' : 'Mark sold'}
              kind={l.status === 'sold' ? 'brand' : 'ink'}
              style={{ flex: 1 }}
              loading={update.isPending}
              onPress={() => update.mutate({ status: l.status === 'sold' ? 'active' : 'sold' })}
            />
            <IconButton icon={Trash2} label="Delete listing" size={54} color={c.danger} onPress={remove} />
          </>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Text variant="priceLg" numberOfLines={1} style={{ textDecorationLine: 'underline' }}>
                {formatInr(l.priceInr)}
              </Text>
              <Text variant="small" color="muted" numberOfLines={1}>
                {formatPerUnit(l.priceInr, l.area, l.areaUnit)}
              </Text>
            </View>
            <IconButton icon={Phone} label="Call" size={48} onPress={() => call('audio')} />
            <IconButton icon={Video} label="Video call" size={48} onPress={() => call('video')} />
            <Button title="Chat" loading={start.isPending} onPress={openChat} />
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  sheet: {
    marginTop: -24,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: c.bg,
    padding: gutter,
    paddingTop: 26,
  },
  sold: { alignSelf: 'flex-start', backgroundColor: c.dangerSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full },
  divider: { height: 1, backgroundColor: c.line, marginVertical: 24 },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  map: { height: 200, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.surfaceAlt },
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
