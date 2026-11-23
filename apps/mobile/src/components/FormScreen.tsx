import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { ApiError } from '@/lib/api';
import { gutter, useTheme } from '@/theme';
import { IconButton, Text } from './ui';

/** Scrollable, keyboard-aware screen with a back button and a big title; footer stays pinned. */
export function FormScreen({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: gutter, paddingBottom: 32, gap: 18 }}
      >
        <IconButton icon={ChevronLeft} label="Back" onPress={() => router.back()} />
        <View style={{ gap: 6, marginBottom: 4 }}>
          <Text variant="display">{title}</Text>
          {subtitle ? (
            <Text variant="body" color="muted">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {children}
      </KeyboardAwareScrollView>
      {footer ? (
        <View
          style={{
            paddingHorizontal: gutter,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderColor: c.line,
            backgroundColor: c.bg,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/** Put server-side validation errors back on the form fields; anything else becomes a toast. */
export function applyServerErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>) {
  if (e instanceof ApiError && e.fields) {
    for (const [k, msg] of Object.entries(e.fields)) setError(k as Path<T>, { message: msg });
    return;
  }
  toast.error((e as Error).message);
}
