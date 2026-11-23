import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { toast } from 'sonner-native';
import { makeStyles, radius, type, useTheme } from '@/theme';
import { Text } from './ui';

const LENGTH = 6;

/**
 * Six boxes over one invisible input: paste, autofill ("one-time-code") and backspace all work natively.
 * Calls onComplete once all digits are in.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  error,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  error?: string;
  autoFocus?: boolean;
}) {
  const s = useStyles();
  const { c } = useTheme();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Pressable onPress={() => input.current?.focus()} accessible={false} style={s.row}>
        {Array.from({ length: LENGTH }, (_, i) => {
          const active = focused && i === Math.min(value.length, LENGTH - 1);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed slots, the index is the identity
            <View key={i} style={[s.box, active && { borderColor: c.ink, borderWidth: 2 }, error ? { borderColor: c.danger } : null]}>
              <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
                {value[i] ?? ''}
              </Text>
            </View>
          );
        })}
        <TextInput
          ref={input}
          value={value}
          onChangeText={(t) => {
            const v = t.replace(/\D/g, '').slice(0, LENGTH);
            onChange(v);
            if (v.length === LENGTH && v !== value) onComplete?.(v);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={LENGTH}
          caretHidden
          accessibilityLabel="Verification code"
          style={s.hidden}
        />
      </Pressable>
      {error ? (
        <Text variant="small" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** "Resend code" link with a cooldown that matches the server's 30 s limit. */
export function ResendCode({ onResend, startAt = 30 }: { onResend: () => Promise<unknown>; startAt?: number }) {
  const [left, setLeft] = useState(startAt);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  const wait = left > 0 || busy;
  return (
    <Pressable
      disabled={wait}
      accessibilityRole="button"
      accessibilityState={{ disabled: wait }}
      hitSlop={12}
      style={{ alignSelf: 'flex-start', minHeight: 48, justifyContent: 'center' }}
      onPress={() => {
        setBusy(true);
        onResend()
          .then(() => setLeft(startAt))
          .catch((e: Error) => toast.error(e.message))
          .finally(() => setBusy(false));
      }}
    >
      <Text variant="bodyMedium" color={wait ? 'muted' : 'accent'}>
        {left > 0 ? `Resend code in ${left}s` : busy ? 'Sending…' : 'Resend code'}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ c }) => ({
  row: { flexDirection: 'row', gap: 8 },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.muted,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: { position: 'absolute', inset: 0, opacity: 0.01, color: 'transparent', ...type.body },
}));
