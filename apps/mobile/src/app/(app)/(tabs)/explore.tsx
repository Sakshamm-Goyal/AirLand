import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import type { LandType, Listing } from '@landconnect/shared';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  ChevronRight,
  Factory,
  Heart,
  House,
  LandPlot,
  LayoutGrid,
  type LucideIcon,
  MailCheck,
  Map as MapIcon,
  Plus,
  Search,
  SearchX,
  SlidersHorizontal,
  Store,
  Trees,
  Wheat,
  X,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ListingCard } from '@/components/ListingCard';
import { Button, Chip, EmptyState, IconButton, Skeleton, Text } from '@/components/ui';
import { type Filters, useListings } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { gutter, makeStyles, radius, shadow, type, useTheme } from '@/theme';

const PRICE_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: 'Any price' },
  { label: 'Under ₹ 25 L', max: 2_500_000 },
  { label: '₹ 25 L – 1 Cr', min: 2_500_000, max: 10_000_000 },
  { label: '₹ 1 – 5 Cr', min: 10_000_000, max: 50_000_000 },
  { label: 'Above ₹ 5 Cr', min: 50_000_000 },
];

/** Airbnb-style category bar: icon over label, underline on the selected one. */
type Category = { key: string; label: string; icon: LucideIcon; type?: LandType; saved?: boolean };
const CATEGORIES: Category[] = [
  { key: 'all', label: 'All', icon: LayoutGrid },
  { key: 'saved', label: 'Saved', icon: Heart, saved: true },
  { key: 'agricultural', label: 'Farmland', icon: Wheat, type: 'agricultural' },
  { key: 'residential', label: 'Plots', icon: LandPlot, type: 'residential' },
  { key: 'farmhouse', label: 'Farmhouse', icon: House, type: 'farmhouse' },
  { key: 'plantation', label: 'Plantation', icon: Trees, type: 'plantation' },
  { key: 'commercial', label: 'Commercial', icon: Store, type: 'commercial' },
  { key: 'industrial', label: 'Industrial', icon: Factory, type: 'industrial' },
];

export default function Explore() {
  const s = useStyles();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSession((st) => st.user)!;
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [band, setBand] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const sheet = useRef<BottomSheetModal>(null);

  // Debounced search: one request after typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: text.trim() || undefined })), 300);
    return () => clearTimeout(t);
  }, [text]);

  const q = useListings(filters);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const canList = user.role !== 'buyer';
  const active = filters.saved ? 'saved' : (filters.type ?? 'all');

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[s.top, { paddingTop: insets.top + 10 }, scrolled && s.topScrolled]}>
        <View style={s.searchRow}>
          <View style={s.search}>
            <Search size={20} color={c.ink} strokeWidth={2.4} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Search village, taluk or city"
              placeholderTextColor={c.muted}
              style={s.searchInput}
              returnKeyType="search"
              accessibilityLabel="Search listings"
            />
            {text ? <IconButton icon={X} label="Clear search" variant="plain" size={30} onPress={() => setText('')} /> : null}
            <IconButton
              icon={SlidersHorizontal}
              label="Price filter"
              variant={band ? 'ink' : 'surface'}
              size={38}
              onPress={() => sheet.current?.present()}
            />
          </View>
          {canList ? (
            <IconButton icon={Plus} label="List land" variant="ink" size={50} onPress={() => router.push('/listing/new')} />
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cats}>
          {CATEGORIES.map((cat) => {
            const on = active === cat.key;
            return (
              <Pressable
                key={cat.key}
                accessibilityRole="button"
                accessibilityLabel={cat.label}
                accessibilityState={{ selected: on }}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setFilters((f) => ({ ...f, type: cat.type, saved: cat.saved ? 'true' : undefined }));
                }}
                style={[s.cat, on && s.catOn]}
              >
                <cat.icon size={24} color={on ? c.ink : c.muted} strokeWidth={on ? 2 : 1.6} />
                <Text variant="micro" color={on ? 'ink' : 'muted'}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlashList<Listing>
        data={items}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: gutter, paddingBottom: 30 }}>
            <ListingCard listing={item} />
          </View>
        )}
        ListHeaderComponent={
          <>
            {user.emailVerified ? null : (
              <Pressable
                onPress={() => router.push('/verify-email')}
                accessibilityRole="button"
                accessibilityLabel="Verify your email"
                style={({ pressed }) => [s.banner, pressed && { opacity: 0.85 }]}
              >
                <MailCheck size={22} color={c.accent} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text variant="smallMedium">Verify your email</Text>
                  <Text variant="small" color="muted">
                    So you can reset your password if you forget it.
                  </Text>
                </View>
                <ChevronRight size={18} color={c.muted} />
              </Pressable>
            )}
            {items.length ? (
              <Text variant="small" color="muted" style={{ paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 14 }}>
                {items.length}
                {q.hasNextPage ? '+' : ''} {items.length === 1 ? 'plot' : 'plots'}
                {filters.saved ? ' saved' : ''} · owners' numbers stay private
              </Text>
            ) : (
              <View style={{ height: 16 }} />
            )}
          </>
        }
        ListEmptyComponent={
          q.isPending ? (
            <View style={{ paddingHorizontal: gutter, gap: 12 }}>
              {[0, 1].map((i) => (
                <View key={i} style={{ gap: 10, marginBottom: 20 }}>
                  <Skeleton style={{ aspectRatio: 20 / 19, borderRadius: radius.lg }} />
                  <Skeleton style={{ height: 16, width: '60%' }} />
                  <Skeleton style={{ height: 14, width: '40%' }} />
                </View>
              ))}
            </View>
          ) : q.isError ? (
            <EmptyState
              icon={SearchX}
              title="Couldn't load listings"
              body={(q.error as Error).message}
              action={<Button title="Try again" size="md" onPress={() => q.refetch()} />}
            />
          ) : filters.saved ? (
            <EmptyState icon={Heart} title="Nothing saved yet" body="Tap the heart on any plot to keep it here for later." />
          ) : (
            <EmptyState icon={SearchX} title="No land matches" body="Try another place, land type or price range." />
          )
        }
        onEndReached={() => q.hasNextPage && !q.isFetchingNextPage && q.fetchNextPage()}
        onEndReachedThreshold={0.6}
        refreshControl={
          <RefreshControl refreshing={q.isRefetching && !q.isFetchingNextPage} onRefresh={() => void q.refetch()} tintColor={c.muted} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardDismissMode="on-drag"
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)}
        scrollEventThrottle={64}
      />

      <Pressable
        onPress={() => router.push('/map')}
        accessibilityRole="button"
        accessibilityLabel="Show map"
        style={({ pressed }) => [s.mapPill, { transform: [{ scale: pressed ? 0.96 : 1 }] }]}
      >
        <Text variant="h2" color="onInk">
          Map
        </Text>
        <MapIcon size={17} color={c.onInk} />
      </Pressable>

      <BottomSheetModal
        ref={sheet}
        backdropComponent={(p) => <BottomSheetBackdrop {...p} disappearsOnIndex={-1} appearsOnIndex={0} />}
        backgroundStyle={{ backgroundColor: c.surface }}
        handleIndicatorStyle={{ backgroundColor: c.line }}
      >
        <BottomSheetView style={{ padding: gutter, paddingBottom: insets.bottom + 20, gap: 16 }}>
          <Text variant="title">Price</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PRICE_BANDS.map((b, i) => (
              <Chip key={b.label} label={b.label} selected={band === i} onPress={() => setBand(i)} />
            ))}
          </View>
          <Button
            title="Show results"
            onPress={() => {
              setFilters((f) => ({ ...f, minPrice: PRICE_BANDS[band]!.min, maxPrice: PRICE_BANDS[band]!.max }));
              sheet.current?.dismiss();
            }}
          />
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const useStyles = makeStyles(({ c, dark }) => ({
  top: { backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.line, zIndex: 2 },
  topScrolled: { ...shadow(dark), borderBottomColor: 'transparent' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: gutter },
  search: {
    flex: 1,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: c.surface,
    borderWidth: dark ? 1 : 0,
    borderColor: c.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 9,
    gap: 10,
    ...shadow(dark),
  },
  searchInput: { flex: 1, ...type.h2, color: c.ink },
  cats: { paddingHorizontal: gutter, gap: 26, paddingTop: 14 },
  cat: { alignItems: 'center', gap: 6, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent', minWidth: 48 },
  catOn: { borderBottomColor: c.ink },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: gutter,
    marginTop: 16,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: c.accentSoft,
  },
  mapPill: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.ink,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: radius.full,
    ...shadow(dark),
  },
}));
