import { formatArea, formatInr, formatPerUnit, type LandType, type Listing } from '@landconnect/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowUpRight, Heart, MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useToggleSave } from '@/lib/queries';
import { timeAgo } from '@/lib/time';
import { makeStyles, radius, shadow, useTheme } from '@/theme';
import { Avatar, IconButton, RoleBadge, Text } from './ui';

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

export function ListingCard({ listing: l }: { listing: Listing }) {
  const s = useStyles();
  const { c } = useTheme();
  const save = useToggleSave(l);
  const open = () => router.push({ pathname: '/listing/[id]', params: { id: l.id } });
  // The heart is a sibling layered over the card, not a child: a nested button is unreachable by screen readers
  // (an accessible container swallows its children) and is invalid HTML on web.
  return (
    <View>
      <Pressable
        onPress={open}
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
            placeholder={{ blurhash: 'L6Pj0^jE.AyE_3t7t7R**0o#DgR4' }}
          />
          <View style={s.typePill}>
            <Text variant="micro">{LAND_TYPE_LABEL[l.landType]}</Text>
          </View>
          {l.status === 'sold' ? (
            <View style={[s.typePill, { left: 'auto', right: 64, backgroundColor: c.danger }]}>
              <Text variant="micro" style={{ color: '#fff' }}>
                Sold
              </Text>
            </View>
          ) : null}
          {l.isMine ? (
            <View style={[s.typePill, { left: 'auto', right: 12, backgroundColor: c.ink }]}>
              <Text variant="micro" style={{ color: c.onInk }}>
                Your listing
              </Text>
            </View>
          ) : null}
        </View>

        <View style={s.body}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text variant="price">{formatInr(l.priceInr)}</Text>
            <PerUnitChip listing={l} />
          </View>
          <Text variant="h2" numberOfLines={1}>
            {l.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MapPin size={14} color={c.muted} />
            <Text variant="small" color="muted" numberOfLines={1} style={{ flex: 1 }}>
              {[l.locality, l.district].filter(Boolean).join(', ')} · {formatArea(l.area, l.areaUnit)}
            </Text>
          </View>
          <View style={s.footer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
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
      {!l.isMine ? (
        <IconButton
          icon={Heart}
          label={l.saved ? `Remove ${l.title} from saved` : `Save ${l.title}`}
          variant="glass"
          size={40}
          color={l.saved ? c.danger : c.ink}
          onPress={() => save.mutate(!l.saved)}
          style={{ position: 'absolute', right: 12, top: 12 }}
        />
      ) : null}
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
  image: { width: '100%', aspectRatio: 16 / 11, backgroundColor: c.skeleton },
  typePill: {
    position: 'absolute',
    left: 12,
    top: 12,
    backgroundColor: c.glass,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  body: { padding: 16, gap: 6 },
  perUnit: { backgroundColor: c.accentSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 },
  arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.ink, alignItems: 'center', justifyContent: 'center' },
}));
