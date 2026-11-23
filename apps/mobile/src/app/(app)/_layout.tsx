import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '@/lib/session';
import { useTheme } from '@/theme';

export const unstable_settings = { anchor: '(tabs)' };

export default function AppLayout() {
  const { c } = useTheme();
  const askForEmailCode = useSession((s) => s.askForEmailCode);
  // Right after sign-up the verification email is already on its way: ask for the code (skippable).
  useEffect(() => {
    if (!askForEmailCode) return;
    useSession.setState({ askForEmailCode: false });
    // After the guard's redirect to Explore has settled. No cleanup: clearing the flag re-runs this effect.
    setTimeout(() => router.push({ pathname: '/verify-email', params: { sent: '1' } }), 300);
  }, [askForEmailCode]);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="listing/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="listing/edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="verify-email" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
