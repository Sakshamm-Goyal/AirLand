import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@landconnect/shared';
import { router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { applyServerErrors, FormScreen } from '@/components/FormScreen';
import { Button, Chip, Field, Text } from '@/components/ui';
import { useSignIn } from '@/lib/queries';
import { useTheme } from '@/theme';

// Seeded demo accounts (apps/api/src/db/seed.ts). Test values for this app only.
const DEMO = ['buyer', 'seller', 'broker'] as const;
const DEMO_PASSWORD = 'landconnect123';

export default function SignIn() {
  const { c } = useTheme();
  const [show, setShow] = useState(false);
  const signIn = useSignIn();
  const { control, handleSubmit, setValue, setError, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const submit = () => void handleSubmit((v) => signIn.mutateAsync(v).catch((e) => applyServerErrors(e, setError)))();

  return (
    <FormScreen
      title="Welcome back"
      subtitle="Sign in to continue your land conversations."
      footer={<Button title="Sign in" onPress={submit} loading={signIn.isPending} />}
    >
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Field
            label="Email"
            placeholder="you@example.com"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.email?.message}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <Field
            label="Password"
            placeholder="At least 8 characters"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.password?.message}
            secureTextEntry={!show}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
            right={
              <Pressable onPress={() => setShow(!show)} accessibilityLabel={show ? 'Hide password' : 'Show password'} hitSlop={10}>
                {show ? <EyeOff size={20} color={c.muted} /> : <Eye size={20} color={c.muted} />}
              </Pressable>
            }
          />
        )}
      />
      <View style={{ gap: 10, marginTop: 8 }}>
        <Text variant="label" color="muted">
          Try a demo account
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {DEMO.map((r) => (
            <Chip
              key={r}
              label={r[0]!.toUpperCase() + r.slice(1)}
              onPress={() => {
                setValue('email', `${r}@demo.test`);
                setValue('password', DEMO_PASSWORD);
              }}
            />
          ))}
        </View>
      </View>
      <Pressable onPress={() => router.replace('/sign-up')} style={{ alignSelf: 'center', marginTop: 12 }} hitSlop={10}>
        <Text variant="bodyMedium" color="muted">
          New here?{' '}
          <Text variant="bodyMedium" color="accent">
            Create an account
          </Text>
        </Text>
      </Pressable>
    </FormScreen>
  );
}
