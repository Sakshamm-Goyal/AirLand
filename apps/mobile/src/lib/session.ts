import type { AuthResponse, Me } from '@landconnect/shared';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const KEY = 'lc.refresh';

interface SessionState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: Me | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Set by sign-up: the app opens the "enter your code" screen once, on top of Explore. */
  askForEmailCode: boolean;
  set: (r: AuthResponse) => Promise<void>;
  setUser: (u: Me) => void;
  clear: () => Promise<void>;
}

/** Refresh token lives in the Keychain/Keystore; the access token only in memory. */
export const useSession = create<SessionState>((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  refreshToken: null,
  askForEmailCode: false,
  set: async (r) => {
    await SecureStore.setItemAsync(KEY, r.refreshToken);
    set({ status: 'signedIn', user: r.user, accessToken: r.accessToken, refreshToken: r.refreshToken });
  },
  setUser: (user) => set({ user }),
  clear: async () => {
    await SecureStore.deleteItemAsync(KEY);
    // `user` is intentionally kept: signed-in screens stay mounted during the exit animation and read it.
    // Without tokens it grants nothing; the next sign-in overwrites it.
    set({ status: 'signedOut', accessToken: null, refreshToken: null });
  },
}));

export const storedRefreshToken = () => SecureStore.getItemAsync(KEY);
