import { type ImageStyle, StyleSheet, type TextStyle, useColorScheme, type ViewStyle } from 'react-native';

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * Airbnb-like: pure white canvas, near-black text, one rose accent for the primary action, heart and active tab.
 * Big photos carry the colour. Every color in the app comes from here. Light and dark are both first-class.
 */
const light = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F7F7',
  ink: '#222222',
  inkSoft: '#484848',
  muted: '#6A6A6A',
  line: '#EBEBEB',
  onInk: '#FFFFFF',
  brand: '#0F7B5F',
  brandSoft: '#E6F4EF',
  accent: '#E31C5F',
  accentSoft: '#FFF0F4',
  ok: '#008A05',
  danger: '#C13515',
  dangerSoft: '#FEF0EC',
  overlay: 'rgba(0,0,0,0.5)',
  glass: 'rgba(255,255,255,0.94)',
  bubbleOut: '#222222',
  bubbleOutText: '#FFFFFF',
  bubbleIn: '#F2F2F2',
  skeleton: '#EFEFEF',
  // Text and chips laid over photos: same in both themes (photos don't change with the theme).
  onPhoto: '#FFFFFF',
  onPhotoSoft: 'rgba(255,255,255,0.82)',
  photoGlass: 'rgba(255,255,255,0.2)',
};

const dark: typeof light = {
  bg: '#121212',
  surface: '#1C1C1C',
  surfaceAlt: '#262626',
  ink: '#F5F5F5',
  inkSoft: '#D0D0D0',
  muted: '#A3A3A3',
  line: '#2F2F2F',
  onInk: '#121212',
  brand: '#3CC79A',
  brandSoft: '#14302A',
  accent: '#E8285F',
  accentSoft: '#3A1524',
  ok: '#3CC983',
  danger: '#FF6B57',
  dangerSoft: '#3A1D18',
  overlay: 'rgba(0,0,0,0.6)',
  glass: 'rgba(28,28,28,0.92)',
  bubbleOut: '#F5F5F5',
  bubbleOutText: '#121212',
  bubbleIn: '#262626',
  skeleton: '#262626',
  onPhoto: '#FFFFFF',
  onPhotoSoft: 'rgba(255,255,255,0.82)',
  photoGlass: 'rgba(255,255,255,0.2)',
};

export type Colors = typeof light;

export const font = {
  // Plus Jakarta Sans everywhere: the closest open-source match to Airbnb's Cereal.
  display: 'PlusJakartaSans_700Bold',
  body: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const type = {
  hero: { fontFamily: font.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  display: { fontFamily: font.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.5 },
  title: { fontFamily: font.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  h1: { fontFamily: font.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  h2: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: font.medium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: font.body, fontSize: 13.5, lineHeight: 19 },
  smallMedium: { fontFamily: font.medium, fontSize: 13.5, lineHeight: 19 },
  micro: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, textTransform: 'uppercase' },
  price: { fontFamily: font.semibold, fontSize: 15, lineHeight: 20, fontVariant: ['tabular-nums'] },
  priceLg: { fontFamily: font.bold, fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** Bottom-up darkening behind text laid over photos. */
export const scrim = ['rgba(8,12,10,0)', 'rgba(8,12,10,0.78)'] as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;
export const gutter = 20;

export const themes = { light: { c: light, dark: false }, dark: { c: dark, dark: true } } as const;
export type Theme = { c: Colors; dark: boolean };

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? themes.dark : themes.light;
}

/**
 * Styles that depend on the theme, created once per scheme at module load (zero per-render cost).
 *   const useStyles = makeStyles(({ c }) => ({ card: { backgroundColor: c.surface } }));
 *   const s = useStyles();
 */
export function makeStyles<S extends NamedStyles>(fn: (t: Theme) => S & NamedStyles) {
  const sheets = { light: StyleSheet.create(fn(themes.light)), dark: StyleSheet.create(fn(themes.dark)) };
  return () => sheets[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export const shadow = (dark: boolean) =>
  dark ? {} : { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 4 };
