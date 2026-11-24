import type { CallKind } from '@landconnect/shared';
import {
  AndroidAudioTypePresets,
  AudioSession,
  isTrackReference,
  setupIOSAudioManagement,
  type TrackReferenceOrPlaceholder,
  VideoTrack,
} from '@livekit/react-native';
import { AudioPresets, type LocalVideoTrack, type Participant, type RoomOptions, Track, VideoPresets } from 'livekit-client';
import { MicOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { Avatar, Text } from '@/components/ui';
import { font, radius } from '@/theme';

/**
 * Media tuned for Indian mobile networks (see CLAUDE.md "Calling quality"):
 * Opus DTX + RED for loss resilience, platform AEC/NS/AGC, simulcast + dynacast + adaptive stream for video.
 */
export const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: { pixelDensity: 'screen' },
  dynacast: true,
  audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  videoCaptureDefaults: { resolution: VideoPresets.h720.resolution, facingMode: 'user' },
  publishDefaults: {
    dtx: true,
    red: true,
    audioPreset: AudioPresets.speech,
    simulcast: true,
    videoCodec: 'h264', // hardware encoders on low-end Android; LiveKit falls back if unsupported
    videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
  },
  disconnectOnPageLeave: false,
};

/**
 * Configure + start the native audio session BEFORE connecting (LiveKit requirement).
 * Voice calls default to the earpiece, video calls to the speaker; Bluetooth/headset always win.
 */
export function useAudioSession(kind: CallKind, speaker: boolean) {
  const [ready, setReady] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: route is chosen once at connect; later changes go through setSpeaker
  useEffect(() => {
    let cancelled = false;
    let cleanupIOS: (() => void) | undefined;
    (async () => {
      await AudioSession.configureAudio({
        android: {
          audioTypeOptions: AndroidAudioTypePresets.communication,
          preferredOutputList: speaker ? ['bluetooth', 'headset', 'speaker', 'earpiece'] : ['bluetooth', 'headset', 'earpiece', 'speaker'],
        },
        ios: { defaultOutput: speaker ? 'speaker' : 'earpiece' },
      });
      if (Platform.OS === 'ios') cleanupIOS = setupIOSAudioManagement(speaker);
      await AudioSession.startAudioSession();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
      cleanupIOS?.();
      void AudioSession.stopAudioSession();
    };
  }, [kind]);
  return ready;
}

export async function setSpeaker(on: boolean) {
  if (Platform.OS === 'ios') return AudioSession.selectAudioOutput(on ? 'force_speaker' : 'default');
  return AudioSession.selectAudioOutput(on ? 'speaker' : 'earpiece');
}

export async function flipCamera(participant: { getTrackPublication: Participant['getTrackPublication'] }, toBack: boolean) {
  const track = participant.getTrackPublication(Track.Source.Camera)?.videoTrack as LocalVideoTrack | undefined;
  await track?.restartTrack({ facingMode: toBack ? 'environment' : 'user' });
}

/** Video if the camera is on, otherwise the person's avatar. Used for 1:1 and group tiles. */
export function Tile({
  trackRef,
  style,
  mirror,
  zOrder,
  showName = true,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  style?: ViewStyle;
  mirror?: boolean;
  zOrder?: number;
  showName?: boolean;
}) {
  const p = trackRef.participant;
  const name = p.name || 'Guest';
  const hasVideo = isTrackReference(trackRef) && !trackRef.publication.isMuted;
  return (
    <View style={[styles.tile, style]}>
      {hasVideo ? (
        <VideoTrack trackRef={trackRef} style={StyleSheet.absoluteFill} objectFit="cover" mirror={mirror} zOrder={zOrder} />
      ) : (
        <View style={styles.center}>
          <Avatar name={name} size={72} />
        </View>
      )}
      {showName ? (
        <View style={styles.name}>
          {!p.isMicrophoneEnabled ? <MicOff size={13} color="#fff" /> : null}
          <Text variant="micro" style={{ color: '#fff', fontFamily: font.semibold }}>
            {p.isLocal ? 'You' : name}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { backgroundColor: '#1B211E', borderRadius: radius.lg, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
