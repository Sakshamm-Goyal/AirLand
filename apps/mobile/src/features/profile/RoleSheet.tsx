import { BottomSheetBackdrop, type BottomSheetModal, BottomSheetView, BottomSheetModal as Sheet } from '@gorhom/bottom-sheet';
import type { Role } from '@landconnect/shared';
import * as Haptics from 'expo-haptics';
import { BadgeCheck, Check, House, Info, type LucideIcon, Search } from 'lucide-react-native';
import { type RefObject, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { Button, Field, Text } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useChangeRole, useMyListings } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { gutter, makeStyles, radius, useTheme } from '@/theme';

const ROLE_INFO: Record<Role, { label: string; body: string; icon: LucideIcon }> = {
  buyer: { label: 'Buyer', body: 'Browse land, chat and call owners.', icon: Search },
  seller: { label: 'Seller', body: 'List your own land and talk to buyers.', icon: House },
  broker: { label: 'Broker', body: 'List land for clients. Needs your RERA number.', icon: BadgeCheck },
};

/** Bottom sheet to switch role. Chats, calls and saved plots stay; only what you can do changes. */
export function RoleSheet({ sheet, preselect }: { sheet: RefObject<BottomSheetModal | null>; preselect?: Role }) {
  const s = useStyles();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useSession((st) => st.user)!;
  const [pick, setPick] = useState<Role>(preselect ?? user.role);
  const [rera, setRera] = useState(user.reraId ?? '');
  const [reraError, setReraError] = useState<string>();
  const change = useChangeRole();
  const live = (useMyListings().data?.items ?? []).filter((l) => l.status === 'active').length;
  const blockedByListings = pick === 'buyer' && user.role !== 'buyer' && live > 0;
  const same = pick === user.role && (pick !== 'broker' || rera.trim() === (user.reraId ?? ''));

  const submit = () =>
    change.mutate(
      { role: pick, reraId: pick === 'broker' ? rera.trim() : undefined },
      {
        onSuccess: (r) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          sheet.current?.dismiss();
          const now = ROLE_INFO[r.user.role].label.toLowerCase();
          toast.success(`You're now a ${now}`, {
            description: r.user.role === 'buyer' ? 'Your chats and saved plots are still here.' : 'Tap New in Profile to list land.',
          });
        },
        onError: (e) => {
          if (e instanceof ApiError && e.fields?.reraId) return setReraError(e.fields.reraId);
          toast.error(e.message);
        },
      },
    );

  return (
    <Sheet
      ref={sheet}
      backdropComponent={(p) => <BottomSheetBackdrop {...p} disappearsOnIndex={-1} appearsOnIndex={0} />}
      backgroundStyle={{ backgroundColor: c.surface }}
      handleIndicatorStyle={{ backgroundColor: c.line }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onChange={(i) => {
        // Re-sync with the account each time it opens.
        if (i === 0) {
          setPick(preselect ?? user.role);
          setRera(user.reraId ?? '');
          setReraError(undefined);
        }
      }}
    >
      <BottomSheetView style={{ paddingHorizontal: gutter, paddingTop: 4, paddingBottom: insets.bottom + 16, gap: 16 }}>
        <View style={{ gap: 4 }}>
          <Text variant="title">Switch your role</Text>
          <Text variant="body" color="muted">
            Your chats, calls and saved plots stay with you.
          </Text>
        </View>

        <View style={{ gap: 10 }} accessibilityRole="radiogroup">
          {(Object.keys(ROLE_INFO) as Role[]).map((r) => {
            const { label, body, icon: Icon } = ROLE_INFO[r];
            const on = pick === r;
            return (
              <Pressable
                key={r}
                onPress={() => {
                  setPick(r);
                  setReraError(undefined);
                }}
                style={[s.option, on && { borderColor: c.ink, borderWidth: 2, padding: 13 }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${label}. ${body}${r === user.role ? ' Current role.' : ''}`}
              >
                <View style={[s.icon, { backgroundColor: on ? c.ink : c.surfaceAlt }]}>
                  <Icon size={20} color={on ? c.onInk : c.ink} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text variant="bodyMedium">{label}</Text>
                    {r === user.role ? (
                      <View style={s.current}>
                        <Text variant="micro" color="muted">
                          Current
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text variant="small" color="muted">
                    {body}
                  </Text>
                </View>
                {on ? <Check size={20} color={c.ink} /> : null}
              </Pressable>
            );
          })}
        </View>

        {pick === 'broker' ? (
          <Field
            label="RERA registration number"
            placeholder="e.g. PRM/KA/RERA/1251/309/AG/180511"
            value={rera}
            onChangeText={(v) => {
              setRera(v);
              setReraError(undefined);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            error={reraError}
            hint="Shown on your profile so buyers know you're registered."
          />
        ) : null}

        {blockedByListings ? (
          <View style={s.warn}>
            <Info size={18} color={c.danger} />
            <Text variant="small" color="inkSoft" style={{ flex: 1 }}>
              You have {live} live {live === 1 ? 'listing' : 'listings'}. Mark {live === 1 ? 'it' : 'them'} sold or delete{' '}
              {live === 1 ? 'it' : 'them'} first, so buyers aren't left messaging a plot nobody answers for.
            </Text>
          </View>
        ) : null}

        {blockedByListings ? (
          <Button title="Back to my listings" kind="secondary" onPress={() => sheet.current?.dismiss()} />
        ) : (
          <Button
            title={same ? `You're a ${ROLE_INFO[pick].label.toLowerCase()}` : `Switch to ${ROLE_INFO[pick].label}`}
            disabled={same}
            loading={change.isPending}
            onPress={submit}
          />
        )}
      </BottomSheetView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ c }) => ({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.line,
    minHeight: 72,
  },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  current: { backgroundColor: c.surfaceAlt, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full },
  warn: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.md, backgroundColor: c.dangerSoft },
}));
