import { formatArea, formatInr, formatPerUnit, type LandType, type Listing } from '@landconnect/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowRight, Heart } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useToggleSave } from '@/lib/queries';
import { makeStyles, radius, useTheme } from '@/theme';
import { IconButton, Text } from './ui';

export const LAND_TYPE_LABEL: Record<LandType, string> = {
  agricultural: 'Agricultural',
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
  farmhouse: 'Farmhouse',
  plantation: 'Plantation',
};

export function PerUnitChip({ listing }: { listing: Pick<Listing, 'priceInr' | 'area' | 'areaUnit'> }) {
  const s = useStyles();
  return (
    <View style={s.perUnit}>
      <Text variant="micro" color="accent">
        {formatPerUnit(listing.priceInr, listing.area, listing.areaUnit)}
      </Text>
    </View>
  );
}

/** Pills over the photo: verified seller, sold, your listing. */
function PhotoPills({ l }: { l: Listing }) {
  const s = useStyles();
  return (
    <View style={s.pills}>
      {l.status === 'sold' ? (
        <View style={[s.pill, s.soldPill]}>
          <Text variant="micro" color="onPhoto">
            Sold
          </Text>
        </View>
      ) : null}
      {l.isMine ? (
        <View style={[s.pill, s.minePill]}>
          <Text variant="micro" color="onInk">
            Your listing
          </Text>
        </View>
      ) : l.owner.verified ? (
        <View style={s.pill}>
          <Text variant="micro">Verified seller</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Feed card, "luxury minimal": inset photo, then name in display caps, place/size, copper price on the right and a
 * black arrow. The heart is a sibling layered over the card (nested buttons are unreachable by screen readers).
 */
export function ListingCard({ listing: l }: { listing: Listing }) {
  const s = useStyles();
  const { c } = useTheme();
  const save = useToggleSave(l);
  return (
    <View>
      <Pressable
        onPress={() => router.push({ pathname: '/listing/[id]', params: { id: l.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${l.title}, ${formatInr(l.priceInr)}, ${l.locality}`}
        style={({ pressed }) => [s.card, { transform: [{ scale: pressed ? 0.985 : 1 }] }]}
      >
        <Image
          source={l.images[0]}
          style={s.image}
          contentFit="cover"
          transition={250}
          recyclingKey={l.id}
          placeholder={{ blurhash: 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4' }}
        />
        <View style={s.body}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text variant="h1" numberOfLines={2}>
              {l.title}
            </Text>
            <Text variant="small" color="muted" numberOfLines={1}>
              {formatArea(l.area, l.areaUnit)} · {[l.locality, l.district].filter(Boolean).join(', ')}
            </Text>
          </View>
          <View style={s.price}>
            <Text variant="micro" color="muted" numberOfLines={1}>
              {formatPerUnit(l.priceInr, l.area, l.areaUnit)}
            </Text>
            <Text variant="price" color="accent" numberOfLines={1}>
              {formatInr(l.priceInr)}
            </Text>
          </View>
          <View style={s.go}>
            <ArrowRight size={18} color={c.onInk} strokeWidth={2.2} />
          </View>
        </View>
      </Pressable>
      <PhotoPills l={l} />
      {!l.isMine ? (
        <IconButton
          icon={Heart}
          label={l.saved ? `Remove ${l.title} from saved` : `Save ${l.title}`}
          variant="glass"
          size={38}
          color={l.saved ? c.accent : c.ink}
          onPress={() => save.mutate(!l.saved)}
          style={{ position: 'absolute', right: 16, top: 16 }}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ c }) => ({
  card: { backgroundColor: c.surface, borderRadius: 24, padding: 6, borderWidth: 1, borderColor: c.line },
  image: { width: '100%', aspectRatio: 16 / 10, borderRadius: 19, backgroundColor: c.skeleton },
  pills: { position: 'absolute', left: 16, top: 16, right: 64, flexDirection: 'row', gap: 6 },
  pill: { backgroundColor: c.glass, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full },
  soldPill: { backgroundColor: c.danger },
  minePill: { backgroundColor: c.ink },
  body: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10, paddingTop: 14, paddingBottom: 10 },
  price: { alignItems: 'flex-end', gap: 1, maxWidth: '40%' },
  go: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
  perUnit: { alignSelf: 'flex-start', backgroundColor: c.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
}));
