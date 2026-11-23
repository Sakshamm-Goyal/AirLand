import { formatArea, formatInr, LAND_TYPES, type LandType, type Listing } from '@landconnect/shared';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { LocateFixed, MapPin, SearchX } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { LAND_TYPE_LABEL, PerUnitChip } from '@/components/ListingCard';
import { Chip, IconButton, Text } from '@/components/ui';
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT } from '@/features/map/style';
import { useMapListings } from '@/lib/queries';
import { gutter, makeStyles, radius, shadow, useTheme } from '@/theme';

const INDIA_SOUTH: Region = { latitude: 14.5, longitude: 77.2, latitudeDelta: 9, longitudeDelta: 9 };
const GAP = 12;
const r3 = (n: number) => n.toFixed(3);
const toBbox = (r: Region) =>
  [
    r.longitude - r.longitudeDelta / 2,
    r.latitude - r.latitudeDelta / 2,
    r.longitude + r.longitudeDelta / 2,
    r.latitude + r.latitudeDelta / 2,
  ]
    .map(r3)
    .join(',');

/**
 * Grid clustering on the visible region: listings in the same cell (~1/6 of the view wide) merge into one bubble.
 * ponytail: grid, not distance-based; neighbours across a cell edge stay apart. Swap for supercluster if maps get dense.
 */
function cluster(items: Listing[], region: Region, keep: string | null) {
  const cell = region.longitudeDelta / 6;
  const groups = new Map<string, Listing[]>();
  for (const l of items) {
    const key = l.id === keep ? l.id : `${Math.floor(l.lng / cell)}:${Math.floor(l.lat / cell)}`;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  return [...groups.values()];
}

/** Smallest region holding every listing, with breathing room for the header and carousel. */
function fit(items: Listing[]): Region {
  const lats = items.map((l) => l.lat);
  const lngs = items.map((l) => l.lng);
  const [s, n, w, e] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  // Extra room below (the card carousel covers the bottom) and above (header + chips).
  const span = Math.max(n - s, 0.05);
  const [south, north] = [s - span * 0.6, n + span * 0.5];
  return {
    latitude: (south + north) / 2,
    longitude: (w + e) / 2,
    latitudeDelta: north - south,
    longitudeDelta: Math.max((e - w) * 1.3, 0.1),
  };
}

export default function MapTab() {
  const s = useStyles();
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardW = Math.min(width - gutter * 2 - 28, 380);
  const map = useRef<MapView>(null);
  const list = useRef<FlashListRef<Listing>>(null);
  const [region, setRegion] = useState(INDIA_SOUTH);
  const bbox = toBbox(region);
  const [type, setType] = useState<LandType | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = useMapListings(bbox);
  const shown = (q.data?.items ?? []).filter((l) => !type || l.landType === type);

  // Frame the results once, on first load.
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current || !q.data?.items.length) return;
    framed.current = true;
    map.current?.animateToRegion(fit(q.data.items), 500);
  }, [q.data]);

  // Marker tap scrolls the carousel; ignore the scroll events that scroll produces.
  const quietUntil = useRef(0);
  const select = (l: Listing) => {
    setSelectedId(l.id);
    const index = shown.findIndex((x) => x.id === l.id);
    if (index < 0) return;
    quietUntil.current = Date.now() + 600;
    list.current?.scrollToIndex({ index, animated: true });
  };

  const locate = async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return toast('Location permission is off', { description: 'Enable it in Settings to see land near you.' });
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    map.current?.animateToRegion(
      { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.4, longitudeDelta: 0.4 },
      600,
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={INDIA_SOUTH}
        onRegionChangeComplete={setRegion}
        onPress={() => setSelectedId(null)}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        customMapStyle={dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
        userInterfaceStyle={dark ? 'dark' : 'light'}
      >
        {cluster(shown, region, selectedId).map((group) => {
          const l = group[0]!;
          if (group.length > 1) {
            const lat = group.reduce((a, x) => a + x.lat, 0) / group.length;
            const lng = group.reduce((a, x) => a + x.lng, 0) / group.length;
            return (
              <Marker
                key={`cluster:${group.map((x) => x.id).join(',')}`}
                coordinate={{ latitude: lat, longitude: lng }}
                anchor={{ x: 0.5, y: 0.5 }}
                zIndex={5}
                tracksViewChanges={false}
                onPress={(e) => {
                  e.stopPropagation();
                  map.current?.animateToRegion(fit(group), 500);
                }}
                accessibilityLabel={`${group.length} plots here. Zoom in`}
              >
                <View style={s.cluster}>
                  <Text variant="micro" color="onInk">
                    {group.length} plots
                  </Text>
                </View>
              </Marker>
            );
          }
          const on = selectedId === l.id;
          return (
            <Marker
              // Remount on select so Android redraws the (cached) custom marker bitmap.
              key={`${l.id}:${on}`}
              coordinate={{ latitude: l.lat, longitude: l.lng }}
              anchor={{ x: 0.5, y: 1 }}
              zIndex={on ? 10 : 1}
              onPress={(e) => {
                e.stopPropagation();
                select(l);
              }}
              tracksViewChanges={false}
              accessibilityLabel={`${l.title}, ${formatInr(l.priceInr)}`}
            >
              <View style={{ alignItems: 'center' }}>
                <View style={[s.pin, on && s.pinOn]}>
                  <Text variant="micro" color={on ? 'onPhoto' : 'ink'} style={{ fontVariant: ['tabular-nums'] }}>
                    {formatInr(l.priceInr).replace('₹ ', '₹')}
                  </Text>
                </View>
                <View style={[s.tip, on && { borderTopColor: c.accent }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0, gap: 10 }} pointerEvents="box-none">
        <View style={s.header}>
          <View style={s.title}>
            <MapPin size={18} color={c.brand} />
            <View style={{ flex: 1 }}>
              <Text variant="h2">Land on the map</Text>
              <Text variant="small" color="muted">
                {q.data ? `${shown.length} ${shown.length === 1 ? 'plot' : 'plots'} in this area` : 'Loading…'}
              </Text>
            </View>
            {q.isFetching ? <ActivityIndicator color={c.muted} size="small" /> : null}
          </View>
          <IconButton icon={LocateFixed} label="Show land near me" variant="surface" size={56} onPress={locate} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}>
          <Chip label="All" selected={!type} onPress={() => setType(null)} />
          {LAND_TYPES.map((t) => (
            <Chip key={t} label={LAND_TYPE_LABEL[t]} selected={type === t} onPress={() => setType(type === t ? null : t)} />
          ))}
        </ScrollView>
      </View>

      {q.data && !shown.length ? (
        <View style={[s.empty, { bottom: 24 }]}>
          <SearchX size={18} color={c.muted} />
          <Text variant="smallMedium" color="inkSoft">
            No land here. Move or zoom out the map.
          </Text>
        </View>
      ) : null}

      {shown.length ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 20, height: 132 }}>
          <FlashList<Listing>
            ref={list}
            data={shown}
            horizontal
            keyExtractor={(l) => l.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardW + GAP}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: gutter }}
            ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
            onScroll={(e) => {
              if (Date.now() < quietUntil.current) return;
              const l = shown[Math.round(e.nativeEvent.contentOffset.x / (cardW + GAP))];
              if (l && l.id !== selectedId) setSelectedId(l.id);
            }}
            scrollEventThrottle={64}
            renderItem={({ item }) => <MapCard l={item} width={cardW} on={item.id === selectedId} />}
          />
        </View>
      ) : null}
    </View>
  );
}

function MapCard({ l, width, on }: { l: Listing; width: number; on: boolean }) {
  const s = useStyles();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/listing/[id]', params: { id: l.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${l.title}, ${formatInr(l.priceInr)}, ${l.locality}`}
      style={({ pressed }) => [s.card, on && s.cardOn, { width, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      <Image source={l.images[0]} style={s.thumb} contentFit="cover" transition={200} recyclingKey={l.id} />
      <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
        <Text variant="price" color="accent">
          {formatInr(l.priceInr)}
        </Text>
        <PerUnitChip listing={l} />
        <Text variant="smallMedium" numberOfLines={1}>
          {l.title}
        </Text>
        <Text variant="small" color="muted" numberOfLines={1}>
          {l.locality} · {formatArea(l.area, l.areaUnit)}
        </Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ c, dark }) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: gutter },
  title: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...shadow(dark),
  },
  pin: {
    backgroundColor: c.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: c.line,
    ...shadow(dark),
  },
  cluster: {
    backgroundColor: c.ink,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: c.surface,
    ...shadow(dark),
  },
  pinOn: { backgroundColor: c.accent, borderColor: c.accent, transform: [{ scale: 1.12 }] },
  tip: {
    width: 0,
    height: 0,
    marginTop: -1,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: c.surface,
  },
  card: {
    height: 132,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: dark ? c.line : 'transparent',
    ...shadow(dark),
  },
  cardOn: { borderColor: c.accent },
  thumb: { width: 108, height: '100%', borderRadius: radius.md, backgroundColor: c.skeleton },
  empty: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.full,
    ...shadow(dark),
  },
}));
