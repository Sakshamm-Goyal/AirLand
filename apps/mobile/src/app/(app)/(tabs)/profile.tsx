import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { formatInr, type Listing, type Role } from '@landconnect/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ArrowLeftRight, ChevronRight, House, Lock, LogOut, MapPinned, PhoneCall, Plus, ShieldCheck } from 'lucide-react-native';
import { type ReactNode, useRef, useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Divider, RoleBadge, Text } from '@/components/ui';
import { RoleSheet } from '@/features/profile/RoleSheet';
import { api } from '@/lib/api';
import { queryClient, useBlocks, useMyListings, useSetBlocked, useUpdateMe } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { closeSocket } from '@/lib/socket';
import { gutter, makeStyles, radius, shadow, useTheme } from '@/theme';

export default function Profile() {
  const s = useStyles();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSession((st) => st.user)!;
  const update = useUpdateMe();
  const canList = user.role !== 'buyer';
  const mine = useMyListings();
  const blocks = useBlocks().data ?? [];
  const setBlocked = useSetBlocked();
  const roleSheet = useRef<BottomSheetModal>(null);
  const [preselect, setPreselect] = useState<Role>();
  const openRoles = (r?: Role) => {
    setPreselect(r);
    roleSheet.current?.present();
  };

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
      <Text variant="display">Profile</Text>

      <View style={s.profile}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Avatar name={user.name} uri={user.avatarUrl} size={88} />
          <Text variant="title" style={{ marginTop: 6 }}>
            {user.name}
          </Text>
          <RoleBadge role={user.role} verified={user.verified} />
          <Text variant="small" color="muted">
            {user.email}
          </Text>
          {user.emailVerified ? null : (
            <Pressable
              onPress={() => router.push('/verify-email')}
              accessibilityRole="button"
              hitSlop={10}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text variant="smallMedium" color="accent">
                Email not verified · Verify now
              </Text>
            </Pressable>
          )}
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
          <Text variant="small" color="inkSoft" style={{ flexShrink: 1 }}>
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
      ) : (
        <Pressable onPress={() => openRoles('seller')} style={s.promo} accessibilityRole="button" accessibilityLabel="Become a seller">
          <View style={[s.promoIcon, { backgroundColor: c.accentSoft }]}>
            <House size={22} color={c.accent} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="bodyMedium">Have land to sell?</Text>
            <Text variant="small" color="muted">
              Switch to a seller account and list it. Your chats stay.
            </Text>
          </View>
          <ChevronRight size={20} color={c.muted} />
        </Pressable>
      )}

      <View style={{ gap: 8 }}>
        <Text variant="h1">Account</Text>
        <Pressable onPress={() => openRoles()} style={s.row} accessibilityRole="button" accessibilityLabel="Switch role">
          <ArrowLeftRight size={20} color={c.inkSoft} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium">Role</Text>
            <Text variant="small" color="muted">
              {{ buyer: 'Buyer', seller: 'Seller', broker: 'Broker' }[user.role]} · switch any time
            </Text>
          </View>
          <Text variant="smallMedium" color="accent">
            Switch
          </Text>
          <ChevronRight size={18} color={c.muted} />
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="h1">Privacy</Text>
        <View style={s.list}>
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

      {blocks.length ? (
        <View style={{ gap: 8 }}>
          <Text variant="h1">Blocked people</Text>
          <View style={s.list}>
            {blocks.map((u, i) => (
              <View key={u.id} style={{ gap: 14 }}>
                {i ? <Divider /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={u.name} uri={u.avatarUrl} size={40} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text variant="bodyMedium">{u.name}</Text>
                    <RoleBadge role={u.role} />
                  </View>
                  <Button
                    title="Unblock"
                    size="md"
                    kind="secondary"
                    loading={setBlocked.isPending && setBlocked.variables?.userId === u.id}
                    onPress={() => setBlocked.mutate({ userId: u.id, blocked: false })}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Button title="Sign out" kind="secondary" icon={LogOut} onPress={signOut} />
      <RoleSheet sheet={roleSheet} preselect={preselect} />
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
        trackColor={{ true: c.ink, false: c.line }}
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

const useStyles = makeStyles(({ c, dark }) => ({
  profile: {
    backgroundColor: c.surface,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    borderWidth: dark ? 1 : 0,
    borderColor: c.line,
    ...shadow(dark),
  },
  list: { gap: 16, paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 6 },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  promoIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  mini: { width: 190, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
}));
