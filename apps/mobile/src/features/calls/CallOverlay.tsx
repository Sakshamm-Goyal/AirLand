import { formatDuration, type PublicUser } from '@landconnect/shared';
import { LiveKitRoom, useConnectionState, useLocalParticipant, useRemoteParticipants, useTracks } from '@livekit/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { ConnectionQuality, ConnectionState, type Participant, ParticipantEvent, Track } from 'livekit-client';
import {
  Lock,
  MessageSquareText,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RefreshCcw,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  WifiLow,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, RoleBadge, Text } from '@/components/ui';
import { radius } from '@/theme';
import { flipCamera, ROOM_OPTIONS, setSpeaker, Tile, useAudioSession } from './media';
import { calls, useCall } from './store';

const QUICK_REPLIES = ["Can't talk now. I'll call you back.", 'In a meeting, please message me.', 'Call me in 10 minutes.'];

/** Full-screen call UI rendered above the whole app whenever a call is in progress. */
export function CallOverlay() {
  const phase = useCall((s) => s.phase);
  useEffect(() => {
    if (phase === 'idle') return;
    // Android back must not silently drop a live call.
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [phase]);
  if (phase === 'idle') return null;
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
      <StatusBar style="light" />
      <LinearGradient colors={['#173B2D', '#0B1310', '#070B09']} style={StyleSheet.absoluteFill} />
      {phase === 'active' ? <ActiveCall /> : <Ringing />}
    </Animated.View>
  );
}

// ── Ringing (incoming / outgoing / connecting) ───────────────────────────
function Pulse({ size }: { size: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
  }, [v]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: 1 + v.value * 0.7 }], opacity: 0.45 * (1 - v.value) }));
  return (
    <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: '#43A97E' }, a]} />
  );
}

/** Re-renders every 500 ms and returns the current time. */
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return now;
}

function PeerHeader({ peer, listingTitle, status }: { peer: PublicUser; listingTitle: string | null; status: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <View style={{ width: 132, height: 132, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Pulse size={132} />
        <Avatar name={peer.name} uri={peer.avatarUrl} size={124} />
      </View>
      <Text variant="display" style={{ color: '#fff' }}>
        {peer.name}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <RoleBadge role={peer.role} verified={peer.verified} />
        <Lock size={13} color="#A9B8B0" />
        <Text variant="small" style={{ color: '#A9B8B0' }}>
          Number hidden
        </Text>
      </View>
      {listingTitle ? (
        <View style={styles.contextPill}>
          <Text variant="small" style={{ color: '#DCE5E0' }} numberOfLines={1}>
            re: {listingTitle}
          </Text>
        </View>
      ) : null}
      <Text variant="bodyMedium" style={{ color: '#C9D4CE', marginTop: 6 }} accessibilityLiveRegion="polite">
        {status}
      </Text>
    </View>
  );
}

function Ringing() {
  const { phase, peer, kind, listingTitle, expiresAt, callId } = useCall();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const left = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : null;
  const [replies, setReplies] = useState(false);
  if (!peer) return null;
  const incoming = phase === 'incoming';
  const label = kind === 'video' ? 'video' : 'voice';
  const status =
    phase === 'connecting' || phase === 'active'
      ? 'Connecting…'
      : incoming
        ? `Incoming ${label} call${left != null ? ` · ${left}s` : ''}`
        : callId
          ? 'Ringing…'
          : 'Calling…';

  return (
    <View style={{ flex: 1, paddingTop: insets.top + 64, paddingBottom: insets.bottom + 32, justifyContent: 'space-between' }}>
      <View>
        <Text variant="label" style={{ color: '#8FA59A', textAlign: 'center', marginBottom: 28 }}>
          LandConnect {label} call
        </Text>
        <PeerHeader peer={peer} listingTitle={listingTitle} status={status} />
      </View>

      {incoming ? (
        <View style={{ gap: 26, paddingHorizontal: 32 }}>
          {replies ? (
            <Animated.View entering={FadeIn} style={{ gap: 8 }}>
              {QUICK_REPLIES.map((r) => (
                <Pressable key={r} onPress={() => calls.decline(r)} style={styles.reply} accessibilityRole="button">
                  <Text variant="bodyMedium" style={{ color: '#fff' }}>
                    {r}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>
          ) : (
            <Pressable onPress={() => setReplies(true)} style={[styles.reply, { alignSelf: 'center', flexDirection: 'row', gap: 8 }]}>
              <MessageSquareText size={16} color="#fff" />
              <Text variant="smallMedium" style={{ color: '#fff' }}>
                Reply with a message
              </Text>
            </Pressable>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            <RoundAction label="Decline" color="#E0413A" onPress={() => calls.decline()} icon={PhoneOff} />
            <RoundAction label="Accept" color="#22A45D" onPress={calls.accept} icon={kind === 'video' ? Video : Phone} />
          </View>
        </View>
      ) : (
        <View style={{ alignItems: 'center' }}>
          <RoundAction label={phase === 'connecting' ? 'End' : 'Cancel'} color="#E0413A" onPress={calls.hangUp} icon={PhoneOff} />
        </View>
      )}
    </View>
  );
}

function RoundAction({ label, color, onPress, icon: Icon }: { label: string; color: string; onPress: () => void; icon: typeof Phone }) {
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.round, { backgroundColor: color, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
      >
        <Icon size={30} color="#fff" />
      </Pressable>
      <Text variant="smallMedium" style={{ color: '#E5ECE8' }}>
        {label}
      </Text>
    </View>
  );
}

// ── Active call (LiveKit) ────────────────────────────────────────────────
function ActiveCall() {
  const { join, kind } = useCall();
  const audioReady = useAudioSession(kind);
  if (!join || !audioReady) return <Ringing />;
  return (
    <LiveKitRoom
      serverUrl={join.url}
      token={join.token}
      connect
      audio
      video={kind === 'video'}
      options={ROOM_OPTIONS}
      onError={() => calls.hangUp()}
      onDisconnected={() => useCall.getState().phase === 'active' && calls.hangUp()}
    >
      <CallStage />
    </LiveKitRoom>
  );
}

function CallStage() {
  const { kind, peer, answeredAt } = useCall();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const connection = useConnectionState();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], { onlySubscribed: false });
  const local = tracks.find((t) => t.participant.isLocal);
  const remote = tracks.find((t) => !t.participant.isLocal);
  const [speaker, setSpeakerOn] = useState(kind === 'video');
  const [back, setBack] = useState(false);
  const now = useNow();
  const elapsed = answeredAt ? Math.floor((now - answeredAt) / 1000) : 0;

  // The other side vanished without hanging up (crash / dead battery): end after 12 s alone.
  const [aloneSince, setAloneSince] = useState<number | null>(null);
  useEffect(() => {
    if (remotes.length) return setAloneSince(null);
    if (connection === ConnectionState.Connected) setAloneSince((t) => t ?? Date.now());
  }, [remotes.length, connection]);
  useEffect(() => {
    if (!aloneSince) return;
    const t = setTimeout(calls.hangUp, 12_000);
    return () => clearTimeout(t);
  }, [aloneSince]);

  const myQuality = useQuality(localParticipant);
  const theirQuality = useQuality(remotes[0]);
  const weak = [myQuality, theirQuality].find((q) => q === ConnectionQuality.Poor || q === ConnectionQuality.Lost);
  const weakText = weak
    ? myQuality === weak
      ? 'Your connection is weak'
      : `${peer?.name.split(' ')[0] ?? 'Their'}'s connection is weak`
    : null;

  const statusLine =
    connection === ConnectionState.Reconnecting
      ? 'Reconnecting…'
      : connection !== ConnectionState.Connected
        ? 'Connecting…'
        : !remotes.length
          ? 'Waiting for them to join…'
          : formatDuration(elapsed);

  const video = kind === 'video';
  return (
    <View style={{ flex: 1 }}>
      {video && remote ? <Tile trackRef={remote} style={StyleSheet.absoluteFill as never} showName={false} /> : null}
      {video ? null : (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {peer ? <PeerHeader peer={peer} listingTitle={null} status={statusLine} /> : null}
        </View>
      )}

      <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={[styles.topShade, { paddingTop: insets.top + 12 }]}>
        {video ? (
          <View style={{ alignItems: 'center', gap: 2 }}>
            <Text variant="h1" style={{ color: '#fff' }}>
              {peer?.name}
            </Text>
            <Text variant="smallMedium" style={{ color: '#D5DED9' }}>
              {statusLine}
            </Text>
          </View>
        ) : null}
        {weakText ? (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.weak} accessibilityLiveRegion="polite">
            <WifiLow size={14} color="#FFD29A" />
            <Text variant="micro" style={{ color: '#FFE7C7' }}>
              {weakText}
            </Text>
          </Animated.View>
        ) : null}
      </LinearGradient>

      {video && local ? (
        <SelfView screen={{ width, height }} top={insets.top + 80}>
          {<Tile trackRef={local} mirror={!back} zOrder={1} showName={false} style={{ flex: 1 }} />}
        </SelfView>
      ) : null}

      <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
        {video ? (
          <Control label="Flip camera" icon={RefreshCcw} onPress={() => flipCamera(localParticipant, !back).then(() => setBack(!back))} />
        ) : (
          <Control
            label={speaker ? 'Speaker on' : 'Speaker off'}
            icon={speaker ? Volume2 : VolumeX}
            active={speaker}
            onPress={() => setSpeaker(!speaker).then(() => setSpeakerOn(!speaker))}
          />
        )}
        {video ? (
          <Control
            label={isCameraEnabled ? 'Turn camera off' : 'Turn camera on'}
            icon={isCameraEnabled ? Video : VideoOff}
            active={!isCameraEnabled}
            onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          />
        ) : null}
        <Control
          label={isMicrophoneEnabled ? 'Mute' : 'Unmute'}
          icon={isMicrophoneEnabled ? Mic : MicOff}
          active={!isMicrophoneEnabled}
          onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        />
        <Control label="End call" icon={PhoneOff} danger onPress={calls.hangUp} />
      </View>
    </View>
  );
}

/** LiveKit's per-participant estimate (packet loss, jitter, RTT), updated every few seconds. */
function useQuality(p: Participant | undefined) {
  const [q, setQ] = useState(p?.connectionQuality ?? ConnectionQuality.Unknown);
  useEffect(() => {
    if (!p) return;
    setQ(p.connectionQuality);
    p.on(ParticipantEvent.ConnectionQualityChanged, setQ);
    return () => {
      p.off(ParticipantEvent.ConnectionQualityChanged, setQ);
    };
  }, [p]);
  return q;
}

function Control({
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
        styles.control,
        { backgroundColor: danger ? '#E0413A' : active ? '#fff' : 'rgba(255,255,255,0.16)', transform: [{ scale: pressed ? 0.93 : 1 }] },
      ]}
    >
      <Icon size={24} color={active && !danger ? '#0B1310' : '#fff'} />
    </Pressable>
  );
}

/** Draggable picture-in-picture self view that snaps to the nearest corner. */
function SelfView({ children, screen, top }: { children: React.ReactNode; screen: { width: number; height: number }; top: number }) {
  const W = 112;
  const H = 164;
  const M = 16;
  const x = useSharedValue(screen.width - W - M);
  const y = useSharedValue(top);
  const start = useSharedValue({ x: 0, y: 0 });
  const pan = Gesture.Pan()
    .onBegin(() => {
      start.value = { x: x.value, y: y.value };
    })
    .onUpdate((e) => {
      x.value = start.value.x + e.translationX;
      y.value = start.value.y + e.translationY;
    })
    .onEnd(() => {
      x.value = withSpring(x.value + W / 2 < screen.width / 2 ? M : screen.width - W - M);
      y.value = withSpring(y.value + H / 2 < screen.height / 2 ? top : screen.height - H - 170);
    });
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: W,
            height: H,
            borderRadius: radius.lg,
            overflow: 'hidden',
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.7)',
          },
          a,
        ]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  contextPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    maxWidth: '80%',
    marginTop: 4,
  },
  reply: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  round: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  topShade: { position: 'absolute', left: 0, right: 0, top: 0, paddingBottom: 40 },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'center', gap: 18, paddingTop: 20 },
  weak: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(120,60,10,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
  },
  control: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
});
