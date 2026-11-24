/**
 * Web preview stand-in for @livekit/react-native. Browsers can't load the native WebRTC module, so this keeps the
 * call screens rendering (signalling over Socket.IO still runs for real) with avatars instead of audio/video.
 * Never bundled for Android/iOS (see metro.config.js).
 */
import { type ReactNode, useState } from 'react';
import { View } from 'react-native';

const noop = () => {};
const asyncNoop = async () => {};

function participant(isLocal: boolean, name: string, extra: object = {}) {
  return {
    isLocal,
    name,
    identity: isLocal ? 'me' : 'peer',
    isMicrophoneEnabled: true,
    isCameraEnabled: true,
    connectionQuality: 'excellent',
    on: noop,
    off: noop,
    getTrackPublication: () => undefined,
    ...extra,
  };
}

const remote = participant(false, 'Audio/video run on the phone app');

export const registerGlobals = noop;
export const AudioSession = {
  configureAudio: asyncNoop,
  startAudioSession: asyncNoop,
  stopAudioSession: asyncNoop,
  selectAudioOutput: asyncNoop,
};
export const AndroidAudioTypePresets = { communication: {}, media: {} };
export const setupIOSAudioManagement = () => noop;

export function LiveKitRoom({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function useLocalParticipant() {
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);
  const localParticipant = participant(true, 'You', {
    isMicrophoneEnabled: mic,
    setMicrophoneEnabled: async (v: boolean) => setMic(v),
    setCameraEnabled: async (v: boolean) => setCam(v),
  });
  return { localParticipant, isMicrophoneEnabled: mic, isCameraEnabled: cam };
}

export const useRemoteParticipants = () => [remote];
export const useConnectionState = () => 'connected';
const NAMES = ['Asha Sharma', 'Priya Brokers', 'Ramesh Gowda', 'Kiran Rao', 'Meera Iyer', 'Vikram Shah', 'Anil Kumar'];
/** `?people=N` on the URL previews the meeting grid with N tiles (default 2). */
export const useTracks = () => {
  const n = Math.max(1, Math.min(8, Number(new URLSearchParams(globalThis.location?.search ?? '').get('people')) || 2));
  return [
    { participant: participant(true, 'You'), source: 'camera' },
    ...NAMES.slice(0, n - 1).map((name, i) => ({ participant: participant(false, name, { identity: `peer${i}` }), source: 'camera' })),
  ];
};
export const useIsSpeaking = (p: { identity?: string }) => p.identity === 'peer0';
export const isTrackReference = () => false;
export const VideoTrack = () => <View />;
