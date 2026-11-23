import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Lock, MessagesSquare, Video } from 'lucide-react-native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LandArt } from '@/components/LandArt';
import { Button, Text } from '@/components/ui';
import { font, gutter } from '@/theme';

// Same photo library as the seed listings; the vector art underneath shows until it loads (or if offline).
const HERO = 'https://picsum.photos/id/18/1080/1800';

const POINTS = [
  { icon: Lock, text: 'Number hidden' },
  { icon: MessagesSquare, text: 'Chat per plot' },
  { icon: Video, text: 'In-app calls' },
];

export default function Welcome() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#0B100E' }}>
      <StatusBar style="light" />
      <View style={StyleSheet.absoluteFill}>
        <LandArt width={width} height={height} />
      </View>
      <Image source={HERO} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} accessibilityIgnoresInvertColors />
      <LinearGradient
        colors={['rgba(8,12,10,0.55)', 'rgba(8,12,10,0)', 'rgba(8,12,10,0.6)', 'rgba(8,12,10,0.96)']}
        locations={[0, 0.25, 0.5, 0.78]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.brand, { top: insets.top + 14 }]}>
        <Text style={styles.wordmark}>LandConnect</Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: gutter, paddingBottom: insets.bottom + 16, gap: 22 }}>
        <Animated.View entering={FadeInDown.duration(500)} style={{ gap: 12 }}>
          <Text variant="hero" style={{ color: '#fff', fontSize: 40, lineHeight: 44 }}>
            Buy and sell land, privately.
          </Text>
          <Text variant="body" style={{ color: '#D5DAD6' }}>
            Chat and call owners in the app. Your phone number is never shared.
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.tiles}>
          {POINTS.map(({ icon: Icon, text }) => (
            <View key={text} style={styles.tile}>
              <View style={styles.dot}>
                <Icon size={17} color="#fff" />
              </View>
              <Text variant="smallMedium" style={{ color: '#fff', textAlign: 'center' }}>
                {text}
              </Text>
            </View>
          ))}
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(240).duration(500)} style={{ gap: 6 }}>
          <Button title="Create an account" onPress={() => router.push('/sign-up')} />
          <Button
            title="Log in"
            kind="ghost"
            textColor="#fff"
            onPress={() => router.push('/sign-in')}
            style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { position: 'absolute', left: gutter, flexDirection: 'row', alignItems: 'center', gap: 10 },
  wordmark: { fontFamily: font.bold, fontSize: 15, letterSpacing: 2.5, textTransform: 'uppercase', color: '#fff' },
  tiles: {
    flexDirection: 'row',
    gap: 6,
    padding: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  tile: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 4 },
  dot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
