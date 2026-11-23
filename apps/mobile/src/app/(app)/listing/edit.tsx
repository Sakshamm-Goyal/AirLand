import { router, useLocalSearchParams } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { View } from 'react-native';
import { Button, EmptyState, Skeleton } from '@/components/ui';
import { ListingForm } from '@/features/listings/ListingForm';
import { useListing } from '@/lib/queries';
import { gutter } from '@/theme';

export default function EditListing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useListing(id);
  if (q.data?.isMine) return <ListingForm initial={q.data} />;
  return (
    <View style={{ flex: 1, padding: gutter, paddingTop: 80, gap: 16 }}>
      {q.isPending ? (
        <>
          <Skeleton style={{ height: 104 }} />
          <Skeleton style={{ height: 52 }} />
          <Skeleton style={{ height: 220 }} />
        </>
      ) : (
        <EmptyState
          icon={MapPin}
          title="Can't edit this listing"
          body="Only the owner can edit a listing."
          action={<Button title="Go back" size="md" onPress={() => router.back()} />}
        />
      )}
    </View>
  );
}
