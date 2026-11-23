import { type ImageStyle, StyleSheet, type TextStyle, useColorScheme, type ViewStyle } from 'react-native';

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/**
 * "Earthy premium": warm paper, near-black ink CTAs, copper for money, forest for trust.
 * Every color in the app comes from here. Light and dark are both first-class.
 */
const light = {
  bg: '#F6F4EF',
  surface: '#FFFFFF',
  surfaceAlt: '#EFECE5',
  ink: '#121614',
  inkSoft: '#3A403C',
  muted: '#6F766F',
  line: '#E4E0D6',
  onInk: '#FFFFFF',
  brand: '#1C6A4E',
  brandSoft: '#E1EFE7',
  accent: '#B85F31',
  accentSoft: '#F8E7DC',
  ok: '#1E9E5E',
  danger: '#D23B3B',
  dangerSoft: '#FBE4E2',
  overlay: 'rgba(10,14,12,0.55)',
  glass: 'rgba(255,255,255,0.86)',
  bubbleOut: '#1C3D30',
  bubbleOutText: '#F3F6F2',
  bubbleIn: '#FFFFFF',
  skeleton: '#E9E5DC',
};

const dark: typeof light = {
  bg: '#0D100F',
  surface: '#161A18',
  surfaceAlt: '#1E2321',
  ink: '#F1F0EB',
  inkSoft: '#C9CCC6',
  muted: '#8D948E',
  line: '#272D2A',
  onInk: '#0D100F',
  brand: '#43A97E',
  brandSoft: '#173226',
  accent: '#E5915F',
  accentSoft: '#3B2419',
  ok: '#3CC983',
  danger: '#F06060',
  dangerSoft: '#3A1B1B',
  overlay: 'rgba(0,0,0,0.6)',
  glass: 'rgba(22,26,24,0.82)',
  bubbleOut: '#2B6B50',
  bubbleOutText: '#F3F6F2',
  bubbleIn: '#1E2321',
  skeleton: '#1E2321',
};

export type Colors = typeof light;

export const font = {
  display: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_600SemiBold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const type = {
  hero: { fontFamily: font.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  display: { fontFamily: font.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  title: { fontFamily: font.display, fontSize: 24, lineHeight: 28, letterSpacing: -0.4 },
  h1: { fontFamily: font.displayMedium, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  h2: { fontFamily: font.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  bodyMedium: { fontFamily: font.medium, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: font.body, fontSize: 13, lineHeight: 18 },
  smallMedium: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8, textTransform: 'uppercase' },
  price: { fontFamily: font.display, fontSize: 22, lineHeight: 26, fontVariant: ['tabular-nums'] },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, full: 999 } as const;
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
  dark ? {} : { shadowColor: '#2A2116', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3 };
