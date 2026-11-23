// Per-weight imports so only these 6 font files ship (the package index pulls in every weight).
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { registerGlobals } from '@livekit/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Toaster } from 'sonner-native';
import { CallOverlay } from '@/features/calls/CallOverlay';
import { refreshSession } from '@/lib/api';
import { usePushRegistration } from '@/lib/push';
import { queryClient } from '@/lib/queries';
import { useRealtime } from '@/lib/realtime';
import { useSession } from '@/lib/session';
import { font, useTheme } from '@/theme';

registerGlobals(); // WebRTC globals for livekit-client; must run before any Room is created
// Dev-only noise from expo-router's NativeTabs web build (tab preloading): harmless, but Expo's web overlay turns it
// into a toast that covers real buttons. LogBox.ignoreLogs is a no-op on web, so filter that one message at the source.
if (__DEV__ && Platform.OS === 'web') {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('was not handled by any navigator')) return;
    original(...args);
  };
}
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const status = useSession((s) => s.status);
  const { c, dark } = useTheme();

  // Restore the session from the Keychain/Keystore refresh token.
  useEffect(() => {
    void refreshSession().then((ok) => {
      if (!ok && useSession.getState().status === 'loading') useSession.setState({ status: 'signedOut' });
    });
  }, []);

  useRealtime();
  usePushRegistration();

  const ready = fontsLoaded && status !== 'loading';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // The Stack.Protected guards below decide what is reachable; this sends the user to a concrete screen when the
  // session flips (a guard redirect on its own lands on the bare group URL, which has no screen).
  const segments = useSegments();
  useEffect(() => {
    if (!ready) return;
    const inApp = segments[0] === '(app)';
    if (status === 'signedIn' && !inApp) router.replace('/explore');
    else if (status === 'signedOut' && inApp) router.replace('/');
  }, [ready, status, segments]);
  if (!ready) return null;

  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.surface, text: c.ink, border: c.line, primary: c.brand },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider value={navTheme}>
            <BottomSheetModalProvider>
              <StatusBar style={dark ? 'light' : 'dark'} />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'ios_from_right' }}>
                <Stack.Protected guard={status === 'signedIn'}>
                  <Stack.Screen name="(app)" />
                </Stack.Protected>
                {/* Signed-out screens live at the root: a guard redirect needs a concrete first screen, not a group URL. */}
                <Stack.Protected guard={status !== 'signedIn'}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="sign-in" />
                  <Stack.Screen name="sign-up" />
                  <Stack.Screen name="forgot-password" />
                </Stack.Protected>
              </Stack>
              <CallOverlay />
              <Toaster
                position="top-center"
                theme={dark ? 'dark' : 'light'}
                toastOptions={{
                  style: { backgroundColor: c.surface, borderColor: c.line },
                  titleStyle: { color: c.ink, fontFamily: font.semibold },
                }}
              />
            </BottomSheetModalProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
