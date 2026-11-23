// Web preview stand-in for expo-secure-store (no Keychain in a browser). Not used on devices.
export const getItemAsync = async (k: string) => localStorage.getItem(k);
export const setItemAsync = async (k: string, v: string) => localStorage.setItem(k, v);
export const deleteItemAsync = async (k: string) => localStorage.removeItem(k);
