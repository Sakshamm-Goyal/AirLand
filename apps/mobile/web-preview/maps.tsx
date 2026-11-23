/**
 * Web preview stand-in for react-native-maps: a small slippy map (Esri Light/Dark Gray Canvas tiles, no API key,
 * Web Mercator) with drag-to-pan, wheel/double-click zoom and markers/circles projected on top.
 * Never bundled for Android/iOS (see metro.config.js); phones use Google Maps through react-native-maps.
 */
import { createContext, createElement, forwardRef, type ReactNode, useContext, useImperativeHandle, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, useColorScheme, View, type ViewStyle } from 'react-native';

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
type LatLng = { latitude: number; longitude: number };
const TILE = 256;

// Web Mercator: world pixel coordinates at zoom z.
const world = (z: number) => TILE * 2 ** z;
const project = ({ latitude, longitude }: LatLng, z: number) => {
  const s = Math.sin((Math.max(-85, Math.min(85, latitude)) * Math.PI) / 180);
  return { x: ((longitude + 180) / 360) * world(z), y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world(z) };
};
const unproject = (x: number, y: number, z: number): LatLng => ({
  longitude: (x / world(z)) * 360 - 180,
  latitude: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / world(z)))) * 180) / Math.PI,
});
/** Largest whole zoom at which the region fits the view in both directions. */
const zoomFor = (r: Region, w: number, h: number) => {
  const zx = Math.log2((360 * Math.max(w, 1)) / (TILE * r.longitudeDelta));
  const n = project({ latitude: r.latitude + r.latitudeDelta / 2, longitude: 0 }, 0).y;
  const sth = project({ latitude: r.latitude - r.latitudeDelta / 2, longitude: 0 }, 0).y;
  const zy = Math.log2(Math.max(h, 1) / Math.max(sth - n, 1e-9));
  return Math.max(3, Math.min(17, Math.floor(Math.min(zx, zy) + 0.15)));
};

type View2 = { center: LatLng; zoom: number };
const Ctx = createContext<{ toScreen: (p: LatLng) => { x: number; y: number }; zoom: number; lat: number } | null>(null);

type Props = {
  initialRegion?: Region;
  style?: ViewStyle;
  children?: ReactNode;
  onRegionChangeComplete?: (r: Region) => void;
  onPress?: () => void;
  scrollEnabled?: boolean;
  zoomEnabled?: boolean;
  userInterfaceStyle?: 'light' | 'dark';
};

const MapView = forwardRef<unknown, Props>(function MapView(
  { initialRegion, style, children, onRegionChangeComplete, onPress, scrollEnabled = true, zoomEnabled = true, userInterfaceStyle },
  ref,
) {
  const scheme = useColorScheme();
  const dark = (userInterfaceStyle ?? scheme) === 'dark';
  const init = initialRegion ?? { latitude: 20.5, longitude: 78.9, latitudeDelta: 20, longitudeDelta: 20 };
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View2 | null>(null);
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const v = view ?? { center: init, zoom: zoomFor(init, size.w, size.h) };

  const regionOf = (next: View2): Region => {
    const c = project(next.center, next.zoom);
    const nw = unproject(c.x - size.w / 2, c.y - size.h / 2, next.zoom);
    const se = unproject(c.x + size.w / 2, c.y + size.h / 2, next.zoom);
    return { ...next.center, latitudeDelta: nw.latitude - se.latitude, longitudeDelta: se.longitude - nw.longitude };
  };
  const commit = (next: View2) => {
    setView(next);
    onRegionChangeComplete?.(regionOf(next));
  };
  useImperativeHandle(ref, () => ({ animateToRegion: (r: Region) => commit({ center: r, zoom: zoomFor(r, size.w, size.h) }) }));

  const latest = useRef({ v, commit, onPress, scrollEnabled });
  latest.current = { v, commit, onPress, scrollEnabled };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => latest.current.scrollEnabled && setDrag({ dx: g.dx, dy: g.dy }),
      onPanResponderRelease: (_, g) => {
        setDrag({ dx: 0, dy: 0 });
        const { v: cur, commit: done, onPress: tap, scrollEnabled: canPan } = latest.current;
        if (Math.abs(g.dx) + Math.abs(g.dy) < 6 || !canPan) return tap?.();
        const c = project(cur.center, cur.zoom);
        done({ center: unproject(c.x - g.dx, c.y - g.dy, cur.zoom), zoom: cur.zoom });
      },
    }),
  ).current;

  const c = project(v.center, v.zoom);
  const left = c.x - size.w / 2 - drag.dx;
  const top = c.y - size.h / 2 - drag.dy;
  const n = 2 ** v.zoom;
  const tiles: ReactNode[] = [];
  if (size.w) {
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++) {
      for (let ty = Math.max(0, Math.floor(top / TILE)); ty <= Math.min(n - 1, Math.floor((top + size.h) / TILE)); ty++) {
        const x = ((tx % n) + n) % n;
        // Base canvas, then its label layer on top.
        for (const layer of [
          dark ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base',
          dark ? 'World_Dark_Gray_Reference' : 'World_Light_Gray_Reference',
        ]) {
          tiles.push(
            createElement('img', {
              key: `${layer}/${v.zoom}/${tx}/${ty}`,
              src: `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${layer}/MapServer/tile/${v.zoom}/${ty}/${x}`,
              alt: '',
              draggable: false,
              style: { position: 'absolute', left: tx * TILE - left, top: ty * TILE - top, width: TILE, height: TILE, userSelect: 'none' },
            }),
          );
        }
      }
    }
  }

  const zoomBy = (d: number) => zoomEnabled && commit({ center: v.center, zoom: Math.max(3, Math.min(17, v.zoom + d)) });
  return (
    <View
      style={[{ overflow: 'hidden', backgroundColor: dark ? '#262626' : '#EAE6DF' }, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {createElement(
        'div',
        {
          style: { position: 'absolute', inset: 0, cursor: scrollEnabled ? 'grab' : 'default', touchAction: 'none' },
          onWheel: (e: { deltaY: number }) => zoomBy(e.deltaY < 0 ? 1 : -1),
          onDoubleClick: () => zoomBy(1),
        },
        <View style={[StyleSheet.absoluteFill, { filter: dark ? 'none' : 'sepia(0.22) saturate(1.15)' } as ViewStyle]} {...pan.panHandlers}>
          {tiles}
        </View>,
      )}
      <Ctx.Provider
        value={{
          toScreen: (p) => ({ x: project(p, v.zoom).x - left, y: project(p, v.zoom).y - top }),
          zoom: v.zoom,
          lat: v.center.latitude,
        }}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {children}
        </View>
      </Ctx.Provider>
      <Text style={[styles.credit, dark && { color: '#aaa', backgroundColor: 'rgba(0,0,0,0.5)' }]}>Tiles © Esri · © OpenStreetMap</Text>
    </View>
  );
});
export default MapView;

export function Marker({
  coordinate,
  children,
  onPress,
  zIndex,
  anchor = { x: 0.5, y: 1 },
}: {
  anchor?: { x: number; y: number };
  coordinate: LatLng;
  children?: ReactNode;
  onPress?: (e: { stopPropagation: () => void }) => void;
  zIndex?: number;
}) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const { x, y } = ctx.toScreen(coordinate);
  return (
    <Pressable
      onPress={() => onPress?.({ stopPropagation: () => {} })}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex,
        transform: [{ translateX: `-${anchor.x * 100}%` }, { translateY: `-${anchor.y * 100}%` }],
      }}
    >
      {children ?? <View style={styles.dot} />}
    </Pressable>
  );
}

export function Circle({
  center,
  radius,
  fillColor,
  strokeColor,
}: {
  center: LatLng;
  radius: number;
  fillColor?: string;
  strokeColor?: string;
}) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const { x, y } = ctx.toScreen(center);
  const metersPerPx = (156543.03 * Math.cos((ctx.lat * Math.PI) / 180)) / 2 ** ctx.zoom;
  const r = radius / metersPerPx;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        backgroundColor: fillColor,
        borderWidth: 2,
        borderColor: strokeColor,
      }}
    />
  );
}

export const PROVIDER_GOOGLE = 'google';

const styles = StyleSheet.create({
  dot: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#D23B3B', borderWidth: 3, borderColor: '#fff' },
  credit: {
    position: 'absolute',
    left: 4,
    bottom: 3,
    fontSize: 9,
    color: '#555',
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});
