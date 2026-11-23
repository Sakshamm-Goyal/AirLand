import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { LAND_TYPES, type LandType, type Listing } from '@landconnect/shared';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Plus, Search, SearchX, SlidersHorizontal, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LAND_TYPE_LABEL, ListingCard } from '@/components/ListingCard';
import { Avatar, Button, Chip, EmptyState, IconButton, Skeleton, Text } from '@/components/ui';
import { type Filters, useListings } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { gutter, makeStyles, radius, type, useTheme } from '@/theme';

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

  // Debounced search: one request after typing pauses.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: text.trim() || undefined })), 300);
    return () => clearTimeout(t);
  }, [text]);

  const q = useListings(filters);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const canList = user.role !== 'buyer';

  const header = (
    <View style={{ paddingTop: insets.top + 8, gap: 16, paddingBottom: 16 }}>
      <View style={[s.row, { paddingHorizontal: gutter }]}>
        <View style={{ flex: 1 }}>
          <Text variant="small" color="muted">
            {greeting()}, {user.name.split(' ')[0]}
          </Text>
          <Text variant="display">Find your land</Text>
        </View>
        <Pressable onPress={() => router.push('/profile')} accessibilityLabel="Your profile" hitSlop={6}>
          <Avatar name={user.name} uri={user.avatarUrl} size={44} />
        </Pressable>
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
          size={52}
          onPress={() => sheet.current?.present()}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}>
        <Chip label="All" selected={!filters.type} onPress={() => setFilters((f) => ({ ...f, type: undefined }))} />
        {LAND_TYPES.map((t: LandType) => (
          <Chip
            key={t}
            label={LAND_TYPE_LABEL[t]}
            selected={filters.type === t}
            onPress={() => setFilters((f) => ({ ...f, type: f.type === t ? undefined : t }))}
          />
        ))}
      </ScrollView>
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
      />

      {canList ? (
        <Button title="List land" icon={Plus} onPress={() => router.push('/listing/new')} style={[s.fab, { bottom: 24 }]} />
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
  row: { flexDirection: 'row', alignItems: 'center' },
  search: {
    flex: 1,
    height: 52,
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
