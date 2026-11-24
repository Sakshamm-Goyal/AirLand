import { zodResolver } from '@hookform/resolvers/zod';
import { type ResetPasswordInput, resetPasswordSchema } from '@landconnect/shared';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable } from 'react-native';
import { toast } from 'sonner-native';
import { CodeInput, ResendCode } from '@/components/CodeInput';
import { applyServerErrors, FormScreen } from '@/components/FormScreen';
import { Button, Field } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useForgotPassword, useResetPassword } from '@/lib/queries';
import { useTheme } from '@/theme';

/** Step 1: email → code is sent. Step 2: code + new password → signed in. */
export default function ForgotPassword() {
  const { c } = useTheme();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [show, setShow] = useState(false);
  const forgot = useForgotPassword();
  const reset = useResetPassword();
  const { control, handleSubmit, trigger, getValues, setError, formState } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: '', code: '', password: '' },
  });
  const err = formState.errors;

  const sendCode = async () => {
    if (!(await trigger('email'))) return;
    await forgot
      .mutateAsync({ email: getValues('email') })
      .then(() => setStep('code'))
      .catch((e) => applyServerErrors(e, setError));
  };
  const submit = () =>
    void handleSubmit((v) =>
      reset
        .mutateAsync(v)
        .then(() => toast.success('Password changed. Other devices are signed out.'))
        // Code problems come back as a plain message; show it under the code boxes.
        .catch((e) =>
          e instanceof ApiError && e.status === 400 && !e.fields
            ? setError('code', { message: e.message })
            : applyServerErrors(e, setError),
        ),
    )();

  if (step === 'email') {
    return (
      <FormScreen
        title="Forgot password?"
        subtitle="Enter your account email. We'll send a 6-digit code to reset it."
        footer={<Button title="Send code" onPress={() => void sendCode()} loading={forgot.isPending} />}
      >
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Field
              label="Email"
              maxLength={254}
              placeholder="you@example.com"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={err.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              autoFocus
              returnKeyType="send"
              onSubmitEditing={() => void sendCode()}
            />
          )}
        />
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Check your email"
      subtitle={`If ${getValues('email')} has an account, a code is on its way. Enter it and pick a new password.`}
      footer={<Button title="Reset password" onPress={submit} loading={reset.isPending} />}
    >
      <Controller
        control={control}
        name="code"
        render={({ field }) => <CodeInput value={field.value} onChange={field.onChange} error={err.code?.message} />}
      />
      <ResendCode onResend={() => forgot.mutateAsync({ email: getValues('email') })} />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <Field
            label="New password"
            maxLength={128}
            placeholder="At least 8 characters"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={err.password?.message}
            secureTextEntry={!show}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
            right={
              <Pressable onPress={() => setShow(!show)} accessibilityLabel={show ? 'Hide password' : 'Show password'} hitSlop={10}>
                {show ? <EyeOff size={20} color={c.muted} /> : <Eye size={20} color={c.muted} />}
              </Pressable>
            }
          />
        )}
      />
    </FormScreen>
  );
}
