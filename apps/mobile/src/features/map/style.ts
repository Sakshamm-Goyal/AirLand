import type { ComponentProps } from 'react';
import type MapView from 'react-native-maps';

type MapStyleElement = NonNullable<ComponentProps<typeof MapView>['customMapStyle']>[number];

/**
 * Google Maps styles that keep the land readable: no shop/POI clutter, quiet roads, terrain-ish greens.
 * Matches the app's warm paper (light) and ink (dark) palettes.
 */
const common: MapStyleElement[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
];

export const MAP_STYLE_LIGHT: MapStyleElement[] = [
  ...common,
  { elementType: 'geometry', stylers: [{ color: '#F5F5F3' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6A6A6A' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#EDF1E8' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#D7E6D3' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#E2E2E2' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C7DCE3' }] },
];

// Slate rather than near-black: land, roads and water stay distinguishable on a dim phone screen.
export const MAP_STYLE_DARK: MapStyleElement[] = [
  ...common,
  { elementType: 'geometry', stylers: [{ color: '#2B302D' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#BAC2BC' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1E2220' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#5C645F' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#303833' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#2F4A3B' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#424A45' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#525B55' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#22404F' }] },
];
