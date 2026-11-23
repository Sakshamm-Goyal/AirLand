import type { Role } from '@landconnect/shared';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { ArrowRight, BadgeCheck, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  Text as RNText,
  type StyleProp,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { type Colors, font, makeStyles, radius, type TypeVariant, type, useTheme } from '@/theme';

// ── Text ─────────────────────────────────────────────────────────────────
export function Text({ variant = 'body', color, style, ...p }: TextProps & { variant?: TypeVariant; color?: keyof Colors }) {
  const { c } = useTheme();
  return <RNText {...p} style={[type[variant], { color: c[color ?? 'ink'] }, style]} />;
}

// ── Buttons ──────────────────────────────────────────────────────────────
/** primary = rose accent (the one main action), ink = black, secondary = outlined. */
type ButtonKind = 'primary' | 'ink' | 'brand' | 'accent' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  kind = 'primary',
  icon: Icon,
  loading,
  disabled,
  onPress,
  style,
  size = 'lg',
  haptic = true,
  textColor,
  arrow,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  textColor?: string;
  /** Trailing arrow after the label. */
  arrow?: boolean;
  title: string;
  kind?: ButtonKind;
  icon?: LucideIcon;
  loading?: boolean;
  size?: 'md' | 'lg';
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const bg = {
    primary: c.accent,
    ink: c.ink,
    brand: c.brand,
    accent: c.accent,
    secondary: c.surface,
    ghost: 'transparent',
    danger: c.danger,
  }[kind];
  const fg =
    textColor ??
    { primary: c.onPhoto, ink: c.onInk, brand: c.onPhoto, accent: c.onPhoto, secondary: c.ink, ghost: c.ink, danger: c.onPhoto }[kind];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={(e) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={({ pressed }) => [
        {
          height: size === 'lg' ? 54 : 44,
          paddingHorizontal: size === 'lg' ? 22 : 16,
          borderRadius: radius.md,
          backgroundColor: bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: off ? 0.5 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          borderWidth: kind === 'secondary' ? 1 : 0,
          borderColor: c.ink,
        },
        style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={19} color={fg} strokeWidth={2.2} /> : null}
      <RNText style={[size === 'lg' ? type.h2 : type.smallMedium, { color: fg, fontFamily: font.semibold }]}>{title}</RNText>
      {arrow ? <ArrowRight size={18} color={fg} strokeWidth={2.4} /> : null}
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  variant = 'surface',
  size = 44,
  color,
  style,
}: {
  icon: LucideIcon;
  label: string;
  onPress?: () => void;
  variant?: 'surface' | 'glass' | 'ink' | 'plain' | 'danger' | 'ok';
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const bg = { surface: c.surface, glass: c.glass, ink: c.ink, plain: 'transparent', danger: c.danger, ok: c.ok }[variant];
  const fg = color ?? (variant === 'ink' ? c.onInk : variant === 'danger' || variant === 'ok' ? '#fff' : c.ink);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.75 : 1,
          borderWidth: variant === 'surface' ? 1 : 0,
          borderColor: c.line,
        },
        variant === 'glass'
          ? { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 }
          : null,
        style,
      ]}
    >
      <Icon size={Math.round(size * 0.45)} color={fg} strokeWidth={2} />
    </Pressable>
  );
}

// ── Chips & badges ───────────────────────────────────────────────────────
export function Chip({
  label,
  selected,
  onPress,
  icon: Icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress?.();
      }}
      style={{
        height: 38,
        paddingHorizontal: 15,
        borderRadius: radius.full,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: selected ? c.ink : c.surface,
        borderWidth: 1,
        borderColor: selected ? c.ink : c.line,
      }}
    >
      {Icon ? <Icon size={15} color={selected ? c.onInk : c.inkSoft} /> : null}
      <Text variant="smallMedium" style={{ color: selected ? c.onInk : c.inkSoft }}>
        {label}
      </Text>
    </Pressable>
  );
}

const ROLE_LABEL: Record<Role, string> = { buyer: 'Buyer', seller: 'Seller', broker: 'Broker' };

export function RoleBadge({ role, verified }: { role: Role; verified?: boolean }) {
  const { c } = useTheme();
  const tone = role === 'seller' ? [c.accentSoft, c.accent] : role === 'broker' ? [c.brandSoft, c.brand] : [c.surfaceAlt, c.inkSoft];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ backgroundColor: tone[0], paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
        <Text variant="label" style={{ color: tone[1], fontSize: 10 }}>
          {ROLE_LABEL[role]}
        </Text>
      </View>
      {verified ? <BadgeCheck size={15} color={c.brand} accessibilityLabel="Verified" /> : null}
    </View>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────
const AVATAR_TINTS = ['#7A4E8C', '#2F6F8F', '#8C5A2B', '#2E7D5B', '#9A3F4F', '#4D5C9E'];
export function Avatar({ name, uri, size = 40 }: { name: string; uri?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const tint = AVATAR_TINTS[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_TINTS.length];
  if (uri) return <Image source={uri} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}
    >
      <RNText style={{ color: '#fff', fontFamily: font.semibold, fontSize: size * 0.38 }}>{initials}</RNText>
    </View>
  );
}

// ── Inputs ───────────────────────────────────────────────────────────────
export function Field({
  label,
  error,
  hint,
  right,
  style,
  ...p
}: TextInputProps & { label: string; error?: string; hint?: string; right?: ReactNode }) {
  const s = useFieldStyles();
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text variant="smallMedium" color="inkSoft">
        {label}
      </Text>
      <View style={[s.box, error ? { borderColor: c.danger } : null]}>
        <TextInput placeholderTextColor={c.muted} style={[s.input, style]} accessibilityLabel={label} {...p} />
        {right}
      </View>
      {error ? (
        <Text variant="small" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const useFieldStyles = makeStyles(({ c }) => ({
  box: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.muted,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: { flex: 1, ...type.bodyMedium, color: c.ink, paddingVertical: 12 },
}));

// ── Misc ─────────────────────────────────────────────────────────────────
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ backgroundColor: c.skeleton, borderRadius: radius.md }, a, style]} />;
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 32, paddingVertical: 56, gap: 10 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
        }}
      >
        <Icon size={28} color={c.muted} />
      </View>
      <Text variant="h1" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text variant="body" color="muted" style={{ textAlign: 'center' }}>
        {body}
      </Text>
      {action}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.line }, style]} />;
}
