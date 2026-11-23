import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner-native';
import { CodeInput, ResendCode } from '@/components/CodeInput';
import { FormScreen } from '@/components/FormScreen';
import { Button, Text } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useSendEmailCode, useVerifyEmail } from '@/lib/queries';
import { useSession } from '@/lib/session';

const done = () => (router.canGoBack() ? router.back() : router.replace('/explore'));

/** Enter the 6-digit code from the email. Sign-up already sent one (`?sent=1`); otherwise send it on open. */
export default function VerifyEmail() {
  const { sent } = useLocalSearchParams<{ sent?: string }>();
  const email = useSession((st) => st.user!.email);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const verify = useVerifyEmail();
  const send = useSendEmailCode();

  // biome-ignore lint/correctness/useExhaustiveDependencies: send once when the screen opens
  useEffect(() => {
    if (sent) return;
    send.mutate(undefined, {
      // 429 = one went out under 30 s ago, which is fine.
      onError: (e) => !(e instanceof ApiError && e.status === 429) && toast.error(e.message),
    });
  }, []);

  const submit = (v = code) => {
    if (v.length !== 6) return setError('Enter the 6-digit code');
    verify.mutate(v, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.success('Email verified');
        done();
      },
      onError: (e) => {
        setError(e.message);
        setCode('');
      },
    });
  };

  return (
    <FormScreen
      title="Check your email"
      subtitle={`Enter the 6-digit code we sent to ${email}.`}
      footer={<Button title="Verify email" onPress={() => submit()} loading={verify.isPending} />}
    >
      <CodeInput
        value={code}
        onChange={(v) => {
          setCode(v);
          setError(undefined);
        }}
        onComplete={submit}
        error={error}
      />
      <ResendCode onResend={() => send.mutateAsync()} />
      <Text variant="small" color="muted">
        Can't find it? Check spam or promotions. You can skip this and verify later from your profile.
      </Text>
    </FormScreen>
  );
}
