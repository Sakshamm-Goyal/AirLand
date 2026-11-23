import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { api } from './api';
import { useSession } from './session';

Notifications.setNotificationHandler({
  // In the foreground the socket already shows the call UI, so don't double-alert.
  handleNotification: async (n) => {
    const isCall = n.request.content.data?.type === 'call';
    return { shouldShowBanner: !isCall, shouldShowList: !isCall, shouldPlaySound: !isCall, shouldSetBadge: false };
  },
});

/**
 * Registers an Expo push token so a backgrounded callee is woken up; on open, the socket reconnects and the
 * server replays the still-ringing invite. ponytail: no native full-screen intent / CallKit yet; next step for
 * lock-screen ringing is react-native-callkeep + VoIP push.
 */
export function usePushRegistration() {
  const status = useSession((s) => s.status);
  useEffect(() => {
    if (status !== 'signedIn' || !Device.isDevice) return;
    (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('calls', {
            name: 'Calls',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 800, 1200, 800],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
        }
        const { granted } = await Notifications.requestPermissionsAsync();
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!granted || !projectId) return;
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
        await api.patch('/me', { pushToken: data });
      } catch {
        // Push is an enhancement; calls still ring while the app is open.
      }
    })();
  }, [status]);
}
