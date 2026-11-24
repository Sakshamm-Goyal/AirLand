import type { JoinInfo } from '@landconnect/shared';
import {
  LiveKitRoom,
  type TrackReferenceOrPlaceholder,
  useConnectionState,
  useIsSpeaking,
  useLocalParticipant,
  useTracks,
} from '@livekit/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ConnectionState, Track } from 'livekit-client';
import { Mic, MicOff, PhoneOff, RefreshCcw, Users, Video, VideoOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { Text } from '@/components/ui';
import { flipCamera, ROOM_OPTIONS, Tile, useAudioSession } from '@/features/calls/media';
import { useConversation } from '@/lib/queries';
import { emitAck } from '@/lib/socket';
import { radius } from '@/theme';
import { callService } from '../../../../modules/call-service';

/** Group video meeting for a deal room (site-visit planning, negotiation with broker + buyers). */
export default function Room() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conv = useConversation(id).data;
  const [join, setJoin] = useState<JoinInfo | null>(null);
  const audioReady = useAudioSession('video', true);

  useEffect(() => {
    emitAck<JoinInfo>('room:join', { conversationId: id })
      .then(setJoin)
      .catch((e: Error) => {
        toast.error(e.message);
        router.back();
      });
  }, [id]);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" />
      <LinearGradient colors={['#173B2D', '#0B1310']} style={StyleSheet.absoluteFill} />
      {join && audioReady ? (
        <LiveKitRoom
          serverUrl={join.url}
          token={join.token}
          connect
          audio
          video
          options={ROOM_OPTIONS}
          onDisconnected={() => router.back()}
        >
          <Stage title={conv?.title ?? 'Deal room'} />
        </LiveKitRoom>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color="#fff" />
          <Text variant="bodyMedium" style={{ color: '#DCE5E0' }}>
            Joining meeting…
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * WhatsApp-style grid that always fills the screen: 1 = full, 2 = top/bottom halves, 3 = one wide on top + two below,
 * 4 = 2×2, 5–8 = two columns (an odd last tile spans the width). Tap a tile to see just that person; tap again for all.
 */
function layout(n: number, W: number, H: number, gap: number) {
  if (n <= 1) return [{ w: W, h: H }];
  if (n === 2) return [0, 1].map(() => ({ w: W, h: (H - gap) / 2 }));
  if (n === 3) {
    const h = (H - gap) / 2;
    return [{ w: W, h }, ...[0, 1].map(() => ({ w: (W - gap) / 2, h }))];
  }
  const rows = Math.ceil(n / 2);
  const h = (H - gap * (rows - 1)) / rows;
  return Array.from({ length: n }, (_, i) => ({ w: n % 2 === 1 && i === n - 1 ? W : (W - gap) / 2, h }));
}

const GAP = 6;

function Stage({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const state = useConnectionState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const all = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });
  // Others first, you last (bottom-right), like WhatsApp.
  const tracks = [...all.filter((t) => !t.participant.isLocal), ...all.filter((t) => t.participant.isLocal)];
  const [back, setBack] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const focused = tracks.find((t) => t.participant.identity === focus);
  const shown = focused ? [focused] : tracks;

  // Same as 1:1 calls: keep the meeting alive if the app is minimised.
  const connected = state === ConnectionState.Connected;
  useEffect(() => {
    if (connected) callService.start(`Meeting · ${title}`, 'Tap to return to the meeting', true);
  }, [connected, title]);
  useEffect(() => callService.stop, []);

  const top = insets.top + 64;
  const bottom = insets.bottom + 100;
  const W = width - GAP * 2;
  const H = height - top - bottom;
  const sizes = layout(shown.length, W, H, GAP);

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Users size={20} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text variant="h2" style={{ color: '#fff' }} numberOfLines={1}>
            {title}
          </Text>
          <Text variant="small" style={{ color: '#A9B8B0' }}>
            {state === ConnectionState.Reconnecting
              ? 'Reconnecting…'
              : focused
                ? `Showing ${focused.participant.isLocal ? 'you' : focused.participant.name || 'them'} · tap to see everyone`
                : `${tracks.length} in meeting`}
          </Text>
        </View>
      </View>

      <View style={{ position: 'absolute', top, left: GAP, right: GAP, height: H, flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {shown.map((t, i) => (
          <GroupTile
            key={t.participant.identity}
            t={t}
            w={sizes[i]!.w}
            h={sizes[i]!.h}
            mirror={t.participant.isLocal && !back}
            onPress={() => tracks.length > 1 && setFocus(focus ? null : t.participant.identity)}
          />
        ))}
      </View>
      {tracks.length === 1 ? (
        <View pointerEvents="none" style={[styles.waiting, { top: top + H / 2 - 20 }]}>
          <Text variant="bodyMedium" style={{ color: '#fff' }}>
            Waiting for others to join…
          </Text>
        </View>
      ) : null}

      <View style={[styles.controls, { paddingBottom: insets.bottom + 20 }]}>
        <Btn label="Flip camera" icon={RefreshCcw} onPress={() => flipCamera(localParticipant, !back).then(() => setBack(!back))} />
        <Btn
          label={isCameraEnabled ? 'Camera off' : 'Camera on'}
          icon={isCameraEnabled ? Video : VideoOff}
          active={!isCameraEnabled}
          onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        />
        <Btn
          label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
          icon={isMicrophoneEnabled ? Mic : MicOff}
          active={!isMicrophoneEnabled}
          onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        />
        <Btn label="Leave meeting" icon={PhoneOff} danger onPress={() => router.back()} />
      </View>
    </View>
  );
}

/** One participant; a green ring while they talk. */
function GroupTile({
  t,
  w,
  h,
  mirror,
  onPress,
}: {
  t: TrackReferenceOrPlaceholder;
  w: number;
  h: number;
  mirror: boolean;
  onPress: () => void;
}) {
  const speaking = useIsSpeaking(t.participant);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t.participant.isLocal ? 'You' : t.participant.name || 'Guest'}${speaking ? ', speaking' : ''}`}
      style={[styles.tile, { width: w, height: h, borderColor: speaking ? '#43A97E' : 'transparent' }]}
    >
      <Tile trackRef={t} mirror={mirror} style={{ flex: 1, borderRadius: radius.lg - 2 }} />
    </Pressable>
  );
}

function Btn({
  label,
  icon: Icon,
  onPress,
  active,
  danger,
}: {
  label: string;
  icon: typeof Mic;
  onPress: () => unknown;
  active?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => void onPress()}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: danger ? '#E0413A' : active ? '#fff' : 'rgba(255,255,255,0.16)', opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Icon size={24} color={active && !danger ? '#0B1310' : '#fff'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  tile: { borderRadius: radius.lg, borderWidth: 2, overflow: 'hidden' },
  waiting: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 99,
  },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'center', gap: 18 },
  btn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
});
