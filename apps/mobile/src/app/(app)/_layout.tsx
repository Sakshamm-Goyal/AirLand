import { Stack } from 'expo-router';
import { useTheme } from '@/theme';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="listing/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="listing/edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
