import type { JoinInfo } from '@landconnect/shared';
import { LiveKitRoom, useConnectionState, useLocalParticipant, useTracks } from '@livekit/react-native';
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
import { gutter } from '@/theme';

/** Group video meeting for a deal room (site-visit planning, negotiation with broker + buyers). */
export default function Room() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conv = useConversation(id).data;
  const [join, setJoin] = useState<JoinInfo | null>(null);
  const audioReady = useAudioSession('video');

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

function Stage({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const state = useConnectionState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });
  const [back, setBack] = useState(false);
  const cols = tracks.length <= 1 ? 1 : 2;
  const tileW = (width - gutter * 2 - (cols - 1) * 10) / cols;
  const tileH = tracks.length <= 2 ? tileW * (cols === 1 ? 1.3 : 1.5) : tileW * 1.25;

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 10 }}>
      <View style={{ paddingHorizontal: gutter, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Users size={20} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text variant="h1" style={{ color: '#fff' }} numberOfLines={1}>
            {title}
          </Text>
          <Text variant="small" style={{ color: '#A9B8B0' }}>
            {state === ConnectionState.Reconnecting ? 'Reconnecting…' : `${tracks.length} in meeting`}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: gutter }}>
        {tracks.map((t) => (
          <Tile
            key={`${t.participant.identity}`}
            trackRef={t}
            mirror={t.participant.isLocal && !back}
            style={{ width: tileW, height: tileH }}
          />
        ))}
      </View>
      {tracks.length === 1 ? (
        <Text variant="body" style={{ color: '#A9B8B0', textAlign: 'center', marginTop: 16 }}>
          Waiting for others to join…
        </Text>
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
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'center', gap: 18 },
  btn: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
});
