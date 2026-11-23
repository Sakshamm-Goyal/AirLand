/**
 * Web preview stand-in for react-native-maps: an OpenStreetMap embed for the region, with markers projected on top.
 * Static (no panning). Never bundled for Android/iOS (see metro.config.js).
 */
import {
  createContext,
  createElement,
  forwardRef,
  type ReactNode,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
const Ctx = createContext<{ region: Region; w: number; h: number } | null>(null);

const MapView = forwardRef<
  unknown,
  { initialRegion?: Region; style?: ViewStyle; children?: ReactNode; onRegionChangeComplete?: (r: Region) => void; onPress?: () => void }
>(function MapView({ initialRegion, style, children, onRegionChangeComplete, onPress }, ref) {
  const [region, setRegion] = useState<Region>(initialRegion ?? { latitude: 20.5, longitude: 78.9, latitudeDelta: 20, longitudeDelta: 20 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  useImperativeHandle(ref, () => ({ animateToRegion: (r: Region) => setRegion(r) }));
  const onChange = useRef(onRegionChangeComplete);
  onChange.current = onRegionChangeComplete;
  useEffect(() => {
    onChange.current?.(region);
  }, [region]);
  // Match the bbox to the view's aspect so projected markers line up with the embed.
  const aspect = size.w && size.h ? size.w / size.h : 1;
  const lonD = Math.max(region.longitudeDelta, region.latitudeDelta * aspect);
  const latD = lonD / aspect;
  const box = [region.longitude - lonD / 2, region.latitude - latD / 2, region.longitude + lonD / 2, region.latitude + latD / 2];
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${box.join('%2C')}&layer=mapnik`;
  return (
    <View
      style={[{ overflow: 'hidden', backgroundColor: '#e8e4da' }, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {createElement('iframe', { src, title: 'Map', style: { border: 0, width: '100%', height: '100%', pointerEvents: 'none' } })}
      <Pressable style={StyleSheet.absoluteFill} onPress={onPress} />
      <Ctx.Provider value={{ region: { ...region, longitudeDelta: lonD, latitudeDelta: latD }, ...size }}>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {children}
        </View>
      </Ctx.Provider>
    </View>
  );
});
export default MapView;

export function Marker({
  coordinate,
  children,
  onPress,
}: {
  coordinate: { latitude: number; longitude: number };
  children?: ReactNode;
  onPress?: (e: { stopPropagation: () => void }) => void;
}) {
  const ctx = useContext(Ctx);
  if (!ctx?.w) return null;
  const { region: r, w, h } = ctx;
  const x = ((coordinate.longitude - (r.longitude - r.longitudeDelta / 2)) / r.longitudeDelta) * w;
  const y = ((r.latitude + r.latitudeDelta / 2 - coordinate.latitude) / r.latitudeDelta) * h;
  if (x < 0 || y < 0 || x > w || y > h) return null;
  return (
    <Pressable
      onPress={() => onPress?.({ stopPropagation: () => {} })}
      style={{ position: 'absolute', left: x, top: y, transform: [{ translateX: '-50%' }, { translateY: '-50%' }] }}
    >
      {children ?? (
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#D23B3B', borderWidth: 2, borderColor: '#fff' }} />
      )}
    </Pressable>
  );
}

export const Circle = () => null;
