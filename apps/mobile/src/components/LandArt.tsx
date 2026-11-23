import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** Layered-hills illustration used as a brand hero and image fallback. Pure vector, no asset to ship. */
export function LandArt({ width, height, tone = 'dusk' }: { width: number; height: number; tone?: 'dusk' | 'day' }) {
  const sky = tone === 'dusk' ? ['#1B2B26', '#C77B4A'] : ['#CFE3EC', '#F3E6CB'];
  return (
    <Svg width={width} height={height} viewBox="0 0 400 520" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={sky[0]} />
          <Stop offset="1" stopColor={sky[1]} />
        </LinearGradient>
        <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.45" stopColor="#0B100E" stopOpacity="0" />
          <Stop offset="1" stopColor="#0B100E" stopOpacity="0.95" />
        </LinearGradient>
      </Defs>
      <Rect width="400" height="520" fill="url(#sky)" />
      <Circle cx="290" cy="250" r="46" fill="#F6D7A7" opacity={tone === 'dusk' ? 0.9 : 1} />
      <Path d="M0 300 C 80 250, 150 270, 220 290 S 340 260, 400 280 L400 520 L0 520Z" fill="#3E5E47" />
      <Path d="M0 340 C 90 300, 170 330, 250 345 S 360 320, 400 330 L400 520 L0 520Z" fill="#2E4B37" />
      <Path d="M0 380 C 110 360, 200 395, 400 370 L400 520 L0 520Z" fill="#7A5A33" />
      {Array.from({ length: 14 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static decorative furrows, never reordered
        <Path key={i} d={`M${i * 32 - 40} 520 L${i * 30 + 10} 382`} stroke="#5F4526" strokeWidth="3" opacity="0.55" />
      ))}
      <Rect width="400" height="520" fill="url(#shade)" />
    </Svg>
  );
}
