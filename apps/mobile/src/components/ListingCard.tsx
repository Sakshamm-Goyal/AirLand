import { formatArea, formatInr, formatPerUnit, type LandType, type Listing } from '@landconnect/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowUpRight, Camera, Heart, MapPin } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useToggleSave } from '@/lib/queries';
import { timeAgo } from '@/lib/time';
import { makeStyles, radius, scrim, shadow, useTheme } from '@/theme';
import { Avatar, IconButton, RoleBadge, Text } from './ui';

export const LAND_TYPE_LABEL: Record<LandType, string> = {
  agricultural: 'Agricultural',
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
  farmhouse: 'Farmhouse',
  plantation: 'Plantation',
};

const BLURHASH = 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4';

export function PerUnitChip({ listing, onPhoto }: { listing: Pick<Listing, 'priceInr' | 'area' | 'areaUnit'>; onPhoto?: boolean }) {
  const s = useStyles();
  return (
    <View style={onPhoto ? s.perUnitPhoto : s.perUnit}>
      <Text variant="micro" color={onPhoto ? 'onPhoto' : 'accent'}>
        {formatPerUnit(listing.priceInr, listing.area, listing.areaUnit)}
      </Text>
    </View>
  );
}

const open = (id: string) => router.push({ pathname: '/listing/[id]', params: { id } });

/** Heart layered over a card as a sibling, not a child: nested buttons are unreachable by screen readers and invalid HTML. */
function SaveHeart({ l }: { l: Listing }) {
  const { c } = useTheme();
  const save = useToggleSave(l);
  if (l.isMine) return null;
  return (
    <IconButton
      icon={Heart}
      label={l.saved ? `Remove ${l.title} from saved` : `Save ${l.title}`}
      variant="glass"
      size={40}
      color={l.saved ? c.danger : c.ink}
      onPress={() => save.mutate(!l.saved)}
      style={{ position: 'absolute', right: 12, top: 12 }}
    />
  );
}

function StatusPills({ l }: { l: Listing }) {
  const s = useStyles();
  return (
    <View style={s.pills}>
      <View style={s.glassPill}>
        <Text variant="micro">{LAND_TYPE_LABEL[l.landType]}</Text>
      </View>
      {l.status === 'sold' ? (
        <View style={[s.glassPill, s.soldPill]}>
          <Text variant="micro" color="onPhoto">
            Sold
          </Text>
        </View>
      ) : null}
      {l.isMine ? (
        <View style={[s.glassPill, s.minePill]}>
          <Text variant="micro" color="onInk">
            Your listing
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Feed card: photo with the price laid over a scrim, then title, place and who's selling. */
export function ListingCard({ listing: l }: { listing: Listing }) {
  const s = useStyles();
  const { c } = useTheme();
  return (
    <View>
      <Pressable
        onPress={() => open(l.id)}
        accessibilityRole="button"
        accessibilityLabel={`${l.title}, ${formatInr(l.priceInr)}, ${l.locality}`}
        style={({ pressed }) => [s.card, { transform: [{ scale: pressed ? 0.985 : 1 }] }]}
      >
        <View>
          <Image
            source={l.images[0]}
            style={s.image}
            contentFit="cover"
            transition={250}
            recyclingKey={l.id}
            placeholder={{ blurhash: BLURHASH }}
          />
          <LinearGradient colors={scrim} locations={[0.45, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <StatusPills l={l} />
          <View style={s.overlay}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text variant="display" color="onPhoto" style={s.price}>
                {formatInr(l.priceInr)}
              </Text>
              <PerUnitChip listing={l} onPhoto />
            </View>
            {l.images.length > 1 ? (
              <View style={s.photoCount}>
                <Camera size={13} color={c.onPhoto} />
                <Text variant="micro" color="onPhoto">
                  {l.images.length}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={s.body}>
          <Text variant="h2" numberOfLines={1}>
            {l.title}
          </Text>
          <View style={s.row}>
            <MapPin size={14} color={c.muted} />
            <Text variant="small" color="muted" numberOfLines={1} style={{ flex: 1 }}>
              {[l.locality, l.district].filter(Boolean).join(', ')} · {formatArea(l.area, l.areaUnit)}
            </Text>
          </View>
          <View style={s.footer}>
            <View style={[s.row, { gap: 8, flex: 1 }]}>
              <Avatar name={l.owner.name} uri={l.owner.avatarUrl} size={28} />
              <Text variant="smallMedium" numberOfLines={1} style={{ flexShrink: 1 }}>
                {l.owner.name}
              </Text>
              <RoleBadge role={l.owner.role} verified={l.owner.verified} />
              <Text variant="small" color="muted" numberOfLines={1} style={{ flexShrink: 0 }}>
                · {timeAgo(l.createdAt)}
              </Text>
            </View>
            <View style={s.arrow}>
              <ArrowUpRight size={20} color={c.onInk} />
            </View>
          </View>
        </View>
      </Pressable>
      <SaveHeart l={l} />
    </View>
  );
}

/** Tall, all-photo card for horizontal rails. */
export function FeaturedCard({ listing: l, width }: { listing: Listing; width: number }) {
  const s = useStyles();
  const { c } = useTheme();
  return (
    <View style={{ width }}>
      <Pressable
        onPress={() => open(l.id)}
        accessibilityRole="button"
        accessibilityLabel={`${l.title}, ${formatInr(l.priceInr)}, ${l.locality}`}
        style={({ pressed }) => [s.featured, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <Image
          source={l.images[0]}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={250}
          recyclingKey={l.id}
          placeholder={{ blurhash: BLURHASH }}
        />
        <LinearGradient colors={scrim} locations={[0.35, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <StatusPills l={l} />
        <View style={s.featuredText}>
          <Text variant="title" color="onPhoto" style={s.price}>
            {formatInr(l.priceInr)}
          </Text>
          <Text variant="bodyMedium" color="onPhoto" numberOfLines={2}>
            {l.title}
          </Text>
          <View style={s.row}>
            <MapPin size={13} color={c.onPhotoSoft} />
            <Text variant="small" color="onPhotoSoft" numberOfLines={1} style={{ flex: 1 }}>
              {l.locality} · {formatArea(l.area, l.areaUnit)}
            </Text>
          </View>
        </View>
      </Pressable>
      <SaveHeart l={l} />
    </View>
  );
}

const useStyles = makeStyles(({ c, dark }) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: dark ? 1 : 0,
    borderColor: c.line,
    ...shadow(dark),
  },
  image: { width: '100%', aspectRatio: 4 / 3, backgroundColor: c.skeleton },
  pills: { position: 'absolute', left: 12, top: 12, right: 60, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  glassPill: { backgroundColor: c.glass, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.full },
  soldPill: { backgroundColor: c.danger },
  minePill: { backgroundColor: c.ink },
  overlay: { position: 'absolute', left: 16, right: 16, bottom: 14, flexDirection: 'row', alignItems: 'flex-end' },
  price: { fontVariant: ['tabular-nums'] },
  perUnit: { alignSelf: 'flex-start', backgroundColor: c.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  perUnitPhoto: { alignSelf: 'flex-start', backgroundColor: c.photoGlass, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  photoCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.photoGlass,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  body: { padding: 16, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 },
  arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
  featured: { height: 300, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.skeleton },
  featuredText: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 4 },
}));
