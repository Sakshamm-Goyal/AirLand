import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Lock, MessagesSquare, Sprout, Video } from 'lucide-react-native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LandArt } from '@/components/LandArt';
import { Button, Text } from '@/components/ui';
import { gutter } from '@/theme';

// Same photo library as the seed listings; the vector art underneath shows until it loads (or if offline).
const HERO = 'https://picsum.photos/id/255/1080/1800';

const POINTS = [
  { icon: Lock, text: 'Your phone number is never shown' },
  { icon: MessagesSquare, text: 'Every chat is tied to a plot' },
  { icon: Video, text: 'Voice and video calls in the app' },
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
      <View style={[styles.brand, { top: insets.top + 16 }]}>
        <View style={styles.logo}>
          <Sprout size={18} color="#fff" />
        </View>
        <Text variant="h2" style={{ color: '#fff' }}>
          LandConnect
        </Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingHorizontal: gutter, paddingBottom: insets.bottom + 20, gap: 22 }}>
        <Animated.View entering={FadeInDown.duration(500)}>
          <Text variant="label" style={{ color: '#E5B48C', marginBottom: 10 }}>
            Farms, plots and farmhouses
          </Text>
          <Text variant="hero" style={{ color: '#fff' }}>
            Buy and sell land.{'\n'}Talk without sharing your number.
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={{ gap: 10 }}>
          {POINTS.map(({ icon: Icon, text }) => (
            <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.dot}>
                <Icon size={15} color="#fff" />
              </View>
              <Text variant="bodyMedium" style={{ color: '#DDE6E1' }}>
                {text}
              </Text>
            </View>
          ))}
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(240).duration(500)} style={{ gap: 10, marginTop: 8 }}>
          <Button
            title="Create an account"
            kind="secondary"
            textColor="#121614"
            onPress={() => router.push('/sign-up')}
            style={{ backgroundColor: '#fff', borderWidth: 0 }}
          />
          <Button
            title="I already have an account"
            kind="ghost"
            textColor="#fff"
            onPress={() => router.push('/sign-in')}
            style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { position: 'absolute', left: gutter, flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#1C6A4E', alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
