import { requireOptionalNativeModule } from 'expo';

/** Android-only ongoing-call foreground service (iOS keeps calls alive via the audio/voip background modes). */
const native = requireOptionalNativeModule<{ start(title: string, text: string, video: boolean): boolean; stop(): boolean }>('CallService');

export const callService = {
  start: (title: string, text: string, video: boolean) => native?.start(title, text, video) ?? false,
  stop: () => void native?.stop(),
};
