import { formatInr, type Listing } from '@landconnect/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronRight, Lock, LogOut, MapPinned, PhoneCall, Plus, ShieldCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Divider, RoleBadge, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { queryClient, useMyListings, useUpdateMe } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { closeSocket } from '@/lib/socket';
import { gutter, makeStyles, radius, useTheme } from '@/theme';

export default function Profile() {
  const s = useStyles();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSession((st) => st.user)!;
  const update = useUpdateMe();
  const canList = user.role !== 'buyer';
  const mine = useMyListings();

  const signOut = async () => {
    const token = useSession.getState().refreshToken;
    if (token) await api.post('/auth/logout', { refreshToken: token }).catch(() => {});
    closeSocket();
    queryClient.clear();
    await useSession.getState().clear();
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: gutter, paddingBottom: 40, gap: 20 }}
    >
      <Text variant="display">You</Text>

      <View style={s.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={user.name} uri={user.avatarUrl} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="h1">{user.name}</Text>
            <RoleBadge role={user.role} verified={user.verified} />
            <Text variant="small" color="muted">
              {user.email}
            </Text>
          </View>
        </View>
        {user.role === 'broker' && user.reraId ? (
          <View style={s.note}>
            <ShieldCheck size={16} color={c.brand} />
            <Text variant="small" color="inkSoft">
              RERA {user.reraId}
            </Text>
          </View>
        ) : null}
        <View style={s.note}>
          <Lock size={16} color={c.brand} />
          <Text variant="small" color="inkSoft" style={{ flex: 1 }}>
            {user.phone ? 'Your phone number is hidden from everyone.' : 'No phone number on file. People reach you in the app.'}
          </Text>
        </View>
      </View>

      {canList ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text variant="h1" style={{ flex: 1 }}>
              My listings
            </Text>
            <Button title="New" icon={Plus} size="md" onPress={() => router.push('/listing/new')} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {(mine.data?.items ?? []).map((l) => (
              <MiniListing key={l.id} l={l} />
            ))}
            {mine.data && !mine.data.items.length ? (
              <Text variant="body" color="muted">
                Nothing listed yet.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Text variant="h1">Privacy</Text>
        <View style={s.card}>
          <Toggle
            icon={<PhoneCall size={20} color={c.inkSoft} />}
            title="Allow calls"
            body="People you're chatting with can call you in the app."
            value={user.callPolicy === 'anyone_in_chat'}
            onChange={(v) => update.mutate({ callPolicy: v ? 'anyone_in_chat' : 'nobody' })}
          />
          <Divider />
          <Toggle
            icon={<MapPinned size={20} color={c.inkSoft} />}
            title="Approximate location by default"
            body="New listings show a ~1 km area instead of the exact pin."
            value={user.showApproxLocation}
            onChange={(v) => update.mutate({ showApproxLocation: v })}
          />
        </View>
      </View>

      <Button title="Sign out" kind="secondary" icon={LogOut} onPress={signOut} />
    </ScrollView>
  );
}

function Toggle({
  icon,
  title,
  body,
  value,
  onChange,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 }}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium">{title}</Text>
        <Text variant="small" color="muted">
          {body}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.brand, false: c.line }}
        thumbColor="#fff"
        accessibilityLabel={title}
      />
    </View>
  );
}

function MiniListing({ l }: { l: Listing }) {
  const s = useStyles();
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/listing/[id]', params: { id: l.id } })}
      style={s.mini}
      accessibilityRole="button"
      accessibilityLabel={l.title}
    >
      <Image source={l.images[0]} style={{ width: '100%', height: 110, backgroundColor: c.skeleton }} contentFit="cover" />
      <View style={{ padding: 10, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="h2">{formatInr(l.priceInr)}</Text>
          {l.status === 'sold' ? (
            <Text variant="micro" color="danger">
              SOLD
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="small" color="muted" numberOfLines={1} style={{ flex: 1 }}>
            {l.title}
          </Text>
          <ChevronRight size={16} color={c.muted} />
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ c }) => ({
  card: { backgroundColor: c.surface, borderRadius: radius.lg, padding: 16, gap: 14, borderWidth: 1, borderColor: c.line },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.brandSoft, padding: 10, borderRadius: radius.sm },
  mini: { width: 190, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
}));
