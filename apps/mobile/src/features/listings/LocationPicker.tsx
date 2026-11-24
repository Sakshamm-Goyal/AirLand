import * as Location from 'expo-location';
import { LocateFixed, MapPin, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { Button, IconButton, Text } from '@/components/ui';
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT } from '@/features/map/style';
import { gutter, radius, shadow, useTheme } from '@/theme';

/**
 * Full-screen "move the map under the pin" picker (Airbnb host flow).
 * The form only shows a still preview, so scrolling the form can never drag the map.
 */
export function LocationPicker({
  visible,
  region,
  onClose,
  onPick,
}: {
  visible: boolean;
  region: Region;
  onClose: () => void;
  onPick: (r: Region) => void;
}) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const [center, setCenter] = useState(region);

  const locate = async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return toast('Location permission is off', { description: 'Enable it in Settings, or move the map by hand.' });
    const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    map.current?.animateToRegion(
      { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      500,
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.surfaceAlt }}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onRegionChangeComplete={setCenter}
          customMapStyle={dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
          toolbarEnabled={false}
          showsUserLocation
          showsMyLocationButton={false}
        />
        <View pointerEvents="none" style={styles.pin}>
          <MapPin size={44} color={c.accent} fill={c.surface} strokeWidth={2.2} />
          <View style={[styles.pinShadow, { backgroundColor: c.ink }]} />
        </View>

        <View style={[styles.top, { top: insets.top + 10 }]}>
          <IconButton icon={X} label="Close" variant="surface" size={48} onPress={onClose} />
          <View style={[styles.hint, { backgroundColor: c.surface }, shadow(dark)]}>
            <Text variant="bodyMedium">Move the map to your land</Text>
            <Text variant="small" color="muted">
              Pinch to zoom. The pin marks the plot.
            </Text>
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16, backgroundColor: c.surface }]}>
          <IconButton
            icon={LocateFixed}
            label="Use my location"
            variant="surface"
            size={56}
            onPress={() => void locate()}
            style={{ position: 'absolute', right: gutter, top: -72 }}
          />
          <Button title="Confirm location" onPress={() => onPick(center)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // The pin's tip sits exactly on the map centre.
  pin: { position: 'absolute', left: '50%', top: '50%', marginLeft: -22, marginTop: -42, alignItems: 'center' },
  pinShadow: { width: 10, height: 4, borderRadius: 5, opacity: 0.25, marginTop: -2 },
  top: { position: 'absolute', left: gutter, right: gutter, flexDirection: 'row', alignItems: 'center', gap: 10 },
  hint: { flex: 1, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: gutter,
    paddingTop: 16,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
});
