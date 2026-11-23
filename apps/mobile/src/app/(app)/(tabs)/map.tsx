import { formatArea, formatInr, type Listing } from '@landconnect/shared';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { ArrowUpRight, LocateFixed } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { PerUnitChip } from '@/components/ListingCard';
import { IconButton, Text } from '@/components/ui';
import { useMapListings } from '@/lib/queries';
import { gutter, makeStyles, radius, shadow, useTheme } from '@/theme';

const INDIA_SOUTH: Region = { latitude: 14.5, longitude: 77.2, latitudeDelta: 9, longitudeDelta: 9 };
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

export default function MapTab() {
  const s = useStyles();
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [bbox, setBbox] = useState(toBbox(INDIA_SOUTH));
  const [selected, setSelected] = useState<Listing | null>(null);
  const q = useMapListings(bbox);

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
    <View style={{ flex: 1 }}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        initialRegion={INDIA_SOUTH}
        onRegionChangeComplete={(r) => setBbox(toBbox(r))}
        onPress={() => setSelected(null)}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        userInterfaceStyle={dark ? 'dark' : 'light'}
      >
        {q.data?.items.map((l) => {
          const on = selected?.id === l.id;
          return (
            <Marker
              key={l.id}
              coordinate={{ latitude: l.lat, longitude: l.lng }}
              onPress={(e) => {
                e.stopPropagation();
                setSelected(l);
              }}
              tracksViewChanges={false}
              accessibilityLabel={`${l.title}, ${formatInr(l.priceInr)}`}
            >
              <View style={[s.pin, on && { backgroundColor: c.ink }]}>
                <Text variant="micro" style={{ color: on ? c.onInk : c.ink }}>
                  {formatInr(l.priceInr).replace('₹ ', '₹')}
                </Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={[s.header, { top: insets.top + 8 }]}>
        <View style={s.title}>
          <Text variant="h2">Land on the map</Text>
          <Text variant="small" color="muted">
            {q.data ? `${q.data.items.length} plots in view` : 'Loading…'}
          </Text>
        </View>
        {q.isFetching ? <ActivityIndicator color={c.ink} /> : null}
        <IconButton icon={LocateFixed} label="Show land near me" variant="surface" size={50} onPress={locate} />
      </View>

      {selected ? (
        <Animated.View entering={FadeInDown.springify().damping(18)} exiting={FadeOutDown} style={[s.preview, { bottom: 16 }]}>
          <Pressable
            style={{ flexDirection: 'row', gap: 12 }}
            onPress={() => router.push({ pathname: '/listing/[id]', params: { id: selected.id } })}
            accessibilityRole="button"
          >
            <Image source={selected.images[0]} style={s.thumb} contentFit="cover" transition={200} />
            <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
              <Text variant="price">{formatInr(selected.priceInr)}</Text>
              <PerUnitChip listing={selected} />
              <Text variant="smallMedium" numberOfLines={1}>
                {selected.title}
              </Text>
              <Text variant="small" color="muted" numberOfLines={1}>
                {selected.locality} · {formatArea(selected.area, selected.areaUnit)}
              </Text>
            </View>
            <View style={s.arrow}>
              <ArrowUpRight size={20} color={c.onInk} />
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ c, dark }) => ({
  header: { position: 'absolute', left: gutter, right: gutter, flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, backgroundColor: c.surface, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 10, ...shadow(dark) },
  pin: {
    backgroundColor: c.surface,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: c.line,
    ...shadow(dark),
  },
  preview: {
    position: 'absolute',
    left: gutter,
    right: gutter,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: 12,
    ...shadow(dark),
    borderWidth: dark ? 1 : 0,
    borderColor: c.line,
  },
  thumb: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: c.skeleton },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.ink,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
}));
