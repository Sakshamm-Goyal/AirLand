// Per-weight imports so only these 6 font files ship (the package index pulls in every weight).
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { registerGlobals } from '@livekit/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
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
// Dev-only noise from expo-router's NativeTabs web build (tab preloading); harmless, but its toast covers real buttons.
// Logged as a format string ("The action '%s' … was not handled by any navigator"), so match the fixed part.
LogBox.ignoreLogs(['was not handled by any navigator']);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
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
