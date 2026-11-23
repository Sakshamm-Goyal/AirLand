import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { LAND_TYPES, type LandType, type Listing } from '@landconnect/shared';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Heart, Plus, Search, SearchX, SlidersHorizontal, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LAND_TYPE_LABEL, ListingCard } from '@/components/ListingCard';
import { Avatar, Button, Chip, EmptyState, IconButton, Skeleton, Text } from '@/components/ui';
import { type Filters, useListings } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { font, gutter, makeStyles, radius, type, useTheme } from '@/theme';

const PRICE_BANDS: { label: string; min?: number; max?: number }[] = [
  { label: 'Any price' },
  { label: 'Under ₹ 25 L', max: 2_500_000 },
  { label: '₹ 25 L – 1 Cr', min: 2_500_000, max: 10_000_000 },
  { label: '₹ 1 – 5 Cr', min: 10_000_000, max: 50_000_000 },
  { label: 'Above ₹ 5 Cr', min: 50_000_000 },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Explore() {
  const s = useStyles();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSession((st) => st.user)!;
  const [text, setText] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [band, setBand] = useState(0);
  const sheet = useRef<BottomSheetModal>(null);
  // Extended FAB shrinks to an icon while scrolling down (Material pattern) so it never sits on card text.
  const [compactFab, setCompactFab] = useState(false);
  const lastY = useRef(0);

  // Debounced search: one request after typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: text.trim() || undefined })), 300);
    return () => clearTimeout(t);
  }, [text]);

  const q = useListings(filters);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const canList = user.role !== 'buyer';
  const browsing = Boolean(filters.q || filters.type || filters.saved || filters.minPrice || filters.maxPrice);

  const header = (
    <View style={{ paddingTop: insets.top + 10, gap: 18, paddingBottom: 14 }}>
      <View style={[s.row, { paddingHorizontal: gutter }]}>
        <Text style={s.wordmark}>LandConnect</Text>
        <Pressable onPress={() => router.push('/profile')} accessibilityLabel="Your profile" hitSlop={6}>
          <Avatar name={user.name} uri={user.avatarUrl} size={40} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: gutter, gap: 8 }}>
        <Text variant="hero">Find land{'\n'}worth owning</Text>
        <Text variant="small" color="muted">
          {greeting()}, {user.name.split(' ')[0]}. Talk to owners here; your number stays hidden.
        </Text>
      </View>
      <View style={[s.row, { paddingHorizontal: gutter, gap: 10 }]}>
        <View style={s.search}>
          <Search size={19} color={c.muted} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Village, taluk or city"
            placeholderTextColor={c.muted}
            style={s.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search listings"
          />
          {text ? <IconButton icon={X} label="Clear search" variant="plain" size={30} onPress={() => setText('')} /> : null}
        </View>
        <IconButton
          icon={SlidersHorizontal}
          label="Price filter"
          variant={band ? 'ink' : 'surface'}
          size={50}
          onPress={() => sheet.current?.present()}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}>
        <Chip
          label="All"
          selected={!filters.type && !filters.saved}
          onPress={() => setFilters((f) => ({ ...f, type: undefined, saved: undefined }))}
        />
        <Chip
          label="Saved"
          icon={Heart}
          selected={filters.saved === 'true'}
          onPress={() => setFilters((f) => ({ ...f, saved: f.saved ? undefined : 'true' }))}
        />
        {LAND_TYPES.map((t: LandType) => (
          <Chip
            key={t}
            label={LAND_TYPE_LABEL[t]}
            selected={filters.type === t}
            onPress={() => setFilters((f) => ({ ...f, type: f.type === t ? undefined : t }))}
          />
        ))}
      </ScrollView>
      {items.length ? (
        <View style={[s.section, { paddingHorizontal: gutter }]}>
          <Text variant="h1">{filters.saved ? 'Saved plots' : browsing ? 'Results' : 'Latest land'}</Text>
          <Text variant="small" color="muted">
            {items.length}
            {q.hasNextPage ? '+' : ''} {items.length === 1 ? 'plot' : 'plots'}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlashList<Listing>
        data={items}
        keyExtractor={(l) => l.id}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: gutter, paddingBottom: 16 }}>
            <ListingCard listing={item} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          q.isPending ? (
            <View style={{ paddingHorizontal: gutter, gap: 16 }}>
              {[0, 1].map((i) => (
                <Skeleton key={i} style={{ height: 340, borderRadius: radius.lg }} />
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
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardDismissMode="on-drag"
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          if (Math.abs(y - lastY.current) > 12) setCompactFab(y > lastY.current && y > 80);
          lastY.current = y;
        }}
        scrollEventThrottle={64}
      />

      {canList ? (
        compactFab ? (
          <IconButton
            icon={Plus}
            label="List land"
            variant="ink"
            size={58}
            onPress={() => router.push('/listing/new')}
            style={[s.fab, { bottom: 24 }]}
          />
        ) : (
          <Button title="List land" icon={Plus} onPress={() => router.push('/listing/new')} style={[s.fab, { bottom: 24 }]} />
        )
      ) : null}

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

const useStyles = makeStyles(({ c }) => ({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: font.bold, fontSize: 15, letterSpacing: 2.5, textTransform: 'uppercase', color: c.ink },
  section: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  search: {
    flex: 1,
    height: 50,
    borderRadius: radius.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    gap: 8,
  },
  searchInput: { flex: 1, ...type.bodyMedium, color: c.ink },
  fab: { position: 'absolute', right: gutter, paddingHorizontal: 20 },
}));
