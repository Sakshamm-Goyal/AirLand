import { formatArea, formatInr, formatPerUnit, type LandType, type Listing } from '@landconnect/shared';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useToggleSave } from '@/lib/queries';
import { timeAgo } from '@/lib/time';
import { makeStyles, radius, useTheme } from '@/theme';
import { Text } from './ui';

export const LAND_TYPE_LABEL: Record<LandType, string> = {
  agricultural: 'Agricultural',
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
  farmhouse: 'Farmhouse',
  plantation: 'Plantation',
};

const BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4';

export function PerUnitChip({ listing }: { listing: Pick<Listing, 'priceInr' | 'area' | 'areaUnit'> }) {
  const s = useStyles();
  return (
    <View style={s.perUnit}>
      <Text variant="micro" color="inkSoft">
        {formatPerUnit(listing.priceInr, listing.area, listing.areaUnit)}
      </Text>
    </View>
  );
}

/** Airbnb-style heart: white outline with a dark see-through fill, solid accent when saved. */
export function SaveHeart({ l, size = 26, style }: { l: Listing; size?: number; style?: object }) {
  const { c } = useTheme();
  const save = useToggleSave(l);
  if (l.isMine) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={l.saved ? `Remove ${l.title} from saved` : `Save ${l.title}`}
      hitSlop={10}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        save.mutate(!l.saved);
      }}
      style={[{ position: 'absolute', right: 12, top: 12, padding: 4 }, style]}
    >
      <Heart size={size} color={c.onPhoto} fill={l.saved ? c.accent : 'rgba(0,0,0,0.45)'} strokeWidth={2} />
    </Pressable>
  );
}

/** Swipeable photos with page dots. Every page opens the listing. */
function Photos({ l, onOpen }: { l: Listing; onOpen: () => void }) {
  const s = useStyles();
  const [{ w, h }, setSize] = useState({ w: 0, h: 0 });
  const [page, setPage] = useState(0);
  return (
    <View style={s.photos} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {w ? (
        <ScrollView
          key={l.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / w))}
        >
          {l.images.map((uri) => (
            <Pressable key={uri} onPress={onOpen} accessible={false}>
              <Image
                source={uri}
                style={{ width: w, height: h }}
                contentFit="cover"
                transition={200}
                recyclingKey={`${l.id}:${uri}`}
                placeholder={{ blurhash: BLURHASH }}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {l.images.length > 1 ? (
        <View style={s.dots} pointerEvents="none">
          {l.images.slice(0, 5).map((uri, i) => (
            <View key={uri} style={[s.dot, i === Math.min(page, 4) && s.dotOn]} />
          ))}
        </View>
      ) : null}
      <View style={s.pills} pointerEvents="none">
        {l.status === 'sold' ? (
          <View style={[s.pill, { backgroundColor: s.sold.backgroundColor }]}>
            <Text variant="micro" color="onPhoto">
              Sold
            </Text>
          </View>
        ) : null}
        {l.isMine ? (
          <View style={s.pill}>
            <Text variant="micro">Your listing</Text>
          </View>
        ) : l.owner.verified ? (
          <View style={s.pill}>
            <Text variant="micro">Verified seller</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Feed card: big swipeable photo, then place, title, size and price as short text lines. */
export function ListingCard({ listing: l }: { listing: Listing }) {
  const open = () => router.push({ pathname: '/listing/[id]', params: { id: l.id } });
  const place = [l.locality, l.district].filter(Boolean).join(', ');
  return (
    <View>
      <Photos l={l} onOpen={open} />
      <SaveHeart l={l} />
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${l.title}, ${formatInr(l.priceInr)}, ${l.locality}`}
        style={{ paddingTop: 12, gap: 2 }}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Text variant="h2" numberOfLines={1} style={{ flex: 1 }}>
            {place}
          </Text>
          <Text variant="small" color="muted">
            {timeAgo(l.createdAt)}
          </Text>
        </View>
        <Text variant="small" color="muted" numberOfLines={1}>
          {l.title}
        </Text>
        <Text variant="small" color="muted" numberOfLines={1}>
          {formatArea(l.area, l.areaUnit)} · {LAND_TYPE_LABEL[l.landType]}
        </Text>
        <Text variant="small" numberOfLines={1} style={{ marginTop: 4 }}>
          <Text variant="price">{formatInr(l.priceInr)}</Text>
          <Text variant="small" color="muted">
            {'  '}
            {formatPerUnit(l.priceInr, l.area, l.areaUnit)}
          </Text>
        </Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ c }) => ({
  photos: { width: '100%', aspectRatio: 20 / 19, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.skeleton },
  dots: { position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.onPhoto, opacity: 0.6 },
  dotOn: { opacity: 1, transform: [{ scale: 1.15 }] },
  pills: { position: 'absolute', left: 12, top: 12, right: 56, flexDirection: 'row', gap: 6 },
  pill: { backgroundColor: c.glass, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full },
  sold: { backgroundColor: c.danger },
  perUnit: { alignSelf: 'flex-start', backgroundColor: c.surfaceAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
}));
