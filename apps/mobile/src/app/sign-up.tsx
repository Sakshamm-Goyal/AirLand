import { zodResolver } from '@hookform/resolvers/zod';
import { type Role, type SignUpInput, signUpSchema } from '@landconnect/shared';
import * as Haptics from 'expo-haptics';
import { Briefcase, Check, Home, type LucideIcon, Search } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { applyServerErrors, FormScreen } from '@/components/FormScreen';
import { Button, Field, Text } from '@/components/ui';
import { useSignUp } from '@/lib/queries';
import { makeStyles, radius, useTheme } from '@/theme';

const ROLES: { role: Role; title: string; body: string; icon: LucideIcon }[] = [
  { role: 'buyer', title: 'Buyer', body: 'Browse plots, chat and call owners', icon: Search },
  { role: 'seller', title: 'Seller', body: 'List your land and talk to buyers', icon: Home },
  { role: 'broker', title: 'Broker', body: 'List for clients and run deal rooms', icon: Briefcase },
];

export default function SignUp() {
  const s = useStyles();
  const { c } = useTheme();
  const signUp = useSignUp();
  const { control, handleSubmit, watch, setError, formState } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { role: 'buyer', name: '', email: '', password: '' },
  });
  const role = watch('role');
  const err = formState.errors;
  const submit = () =>
    void handleSubmit((v) => signUp.mutateAsync({ ...v, phone: v.phone || undefined }).catch((e) => applyServerErrors(e, setError)))();

  return (
    <FormScreen
      title="Join LandConnect"
      subtitle="Pick how you'll use the app. You can switch any time in Profile."
      footer={<Button title="Create account" onPress={submit} loading={signUp.isPending} />}
    >
      <Controller
        control={control}
        name="role"
        render={({ field }) => (
          <View style={{ gap: 10 }} accessibilityRole="radiogroup">
            {ROLES.map(({ role: r, title, body, icon: Icon }) => {
              const on = field.value === r;
              return (
                <Pressable
                  key={r}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    field.onChange(r);
                  }}
                  style={[s.role, on && s.roleOn]}
                >
                  <View style={[s.roleIcon, on && { backgroundColor: c.ink }]}>
                    <Icon size={20} color={on ? c.onInk : c.inkSoft} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="h2">{title}</Text>
                    <Text variant="small" color="muted">
                      {body}
                    </Text>
                  </View>
                  <View style={[s.radio, on && { backgroundColor: c.ink, borderColor: c.ink }]}>
                    {on ? <Check size={14} color={c.onInk} strokeWidth={3} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      />
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <Field
            label="Full name"
            placeholder="As on your ID"
            value={field.value}
            onChangeText={field.onChange}
            error={err.name?.message}
            autoComplete="name"
            textContentType="name"
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Field
            label="Email"
            placeholder="you@example.com"
            value={field.value}
            onChangeText={field.onChange}
            error={err.email?.message}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        )}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <Field
            label="Phone (optional)"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            error={err.phone?.message}
            keyboardType="phone-pad"
            autoComplete="tel"
            hint="Never shown to anyone. People reach you through in-app chat and calls."
          />
        )}
      />
      {role === 'broker' ? (
        <Controller
          control={control}
          name="reraId"
          render={({ field }) => (
            <Field
              label="RERA registration number"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              error={err.reraId?.message}
              autoCapitalize="characters"
              hint="Shown as a verified badge after review."
            />
          )}
        />
      ) : null}
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <Field
            label="Password"
            placeholder="At least 8 characters"
            value={field.value}
            onChangeText={field.onChange}
            error={err.password?.message}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            hint="At least 8 characters"
          />
        )}
      />
    </FormScreen>
  );
}

const useStyles = makeStyles(({ c }) => ({
  role: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  roleOn: { borderColor: c.ink },
  roleIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
}));
