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
  { elementType: 'geometry', stylers: [{ color: '#F1EEE7' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5E655F' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F6F4EF' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#E6EBDD' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#D7E6D3' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#F3DCC8' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C7DCE3' }] },
];

export const MAP_STYLE_DARK: MapStyleElement[] = [
  ...common,
  { elementType: 'geometry', stylers: [{ color: '#161A18' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8D948E' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0D100F' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#18211C' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#173226' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#272D2A' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3B2419' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0E1B22' }] },
];
