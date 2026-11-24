import { zodResolver } from '@hookform/resolvers/zod';
import {
  AREA_UNITS,
  formatInr,
  formatPerUnit,
  LAND_TYPES,
  type Listing,
  type ListingInput,
  listingInputSchema,
  UNIT_LABEL,
  WATER_SOURCES,
} from '@landconnect/shared';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { AlertCircle, ImagePlus, LocateFixed, MapPin, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { toast } from 'sonner-native';
import { applyServerErrors, FormScreen } from '@/components/FormScreen';
import { LAND_TYPE_LABEL } from '@/components/ListingCard';
import { Button, Chip, Field, IconButton, Text } from '@/components/ui';
import { useCreateListing, useUpdateListing } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { pickPhotos, uploadPhoto } from '@/lib/upload';
import { makeStyles, radius, useTheme } from '@/theme';
import { LocationPicker } from './LocationPicker';

type Photo = { local: string; url?: string; state: 'uploading' | 'done' | 'failed' };
const DOCS = ['RTC / Pahani', '7/12 extract', 'Khata', 'EC', 'Mutation', 'DC Conversion', 'Patta'];
const ZONING = ['Agricultural', 'Converted', 'Residential', 'Commercial', 'Industrial'];
const START: Region = { latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.08, longitudeDelta: 0.08 };
const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(/[^0-9.]/g, '')));

/** Create a listing, or edit one when `initial` is given. Used by listing/new and listing/edit. */
export function ListingForm({ initial }: { initial?: Listing }) {
  const s = useStyles();
  const { c } = useTheme();
  const create = useCreateListing();
  const update = useUpdateListing(initial?.id ?? '');
  const approxDefault = useSession((st) => st.user?.showApproxLocation ?? true);
  const [photos, setPhotos] = useState<Photo[]>(initial?.images.map((u) => ({ local: u, url: u, state: 'done' as const })) ?? []);
  const [geocoding, setGeocoding] = useState(false);
  // Text state for area so "2." survives while typing "2.5" (a number field would collapse it to 2).
  const [areaText, setAreaText] = useState(initial ? String(initial.area) : '');
  // Only reverse-geocode after the user moves the map; the initial region must not overwrite saved place names.
  const moved = useRef(false);
  const map = useRef<MapView>(null);
  const [picking, setPicking] = useState(false);
  const startRegion: Region = initial
    ? { latitude: initial.lat, longitude: initial.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : START;

  const { control, handleSubmit, watch, setValue, setError, formState } = useForm<ListingInput>({
    resolver: zodResolver(listingInputSchema),
    defaultValues: initial
      ? {
          title: initial.title,
          description: initial.description,
          landType: initial.landType,
          area: initial.area,
          areaUnit: initial.areaUnit,
          priceInr: initial.priceInr,
          lat: initial.lat,
          lng: initial.lng,
          locality: initial.locality,
          district: initial.district,
          state: initial.state,
          approxLocation: initial.approxLocation,
          titleDocs: initial.titleDocs,
          images: initial.images,
          roadAccessFt: initial.roadAccessFt,
          waterSource: initial.waterSource,
          zoning: initial.zoning,
        }
      : {
          title: '',
          description: '',
          landType: 'agricultural',
          areaUnit: 'acre',
          lat: START.latitude,
          lng: START.longitude,
          locality: '',
          district: '',
          state: '',
          approxLocation: approxDefault,
          titleDocs: [],
          images: [],
          roadAccessFt: null,
          waterSource: null,
          zoning: null,
        },
  });
  const err = formState.errors;
  const [area, unit, price] = watch(['area', 'areaUnit', 'priceInr']);

  // Keep the form's `images` in sync with finished uploads.
  useEffect(() => {
    setValue(
      'images',
      photos.filter((p) => p.url).map((p) => p.url!),
      { shouldValidate: formState.isSubmitted },
    );
  }, [photos, setValue, formState.isSubmitted]);

  const upload = (local: string) => {
    setPhotos((p) => p.map((x) => (x.local === local ? { ...x, state: 'uploading' } : x)));
    uploadPhoto(local)
      .then((url) => setPhotos((p) => p.map((x) => (x.local === local ? { ...x, url, state: 'done' } : x))))
      .catch((e: Error) => {
        // Say why, once per batch; the tile itself offers a retry.
        console.warn('photo upload failed', e);
        toast.error("A photo didn't upload", { id: 'photo-upload', description: `${e.message} Tap the photo to try again.` });
        setPhotos((p) => p.map((x) => (x.local === local ? { ...x, state: 'failed' } : x)));
      });
  };

  const addPhotos = async () => {
    let uris: string[];
    try {
      uris = await pickPhotos(10 - photos.length);
    } catch (e) {
      console.warn('photo picker failed', e);
      return toast.error("Couldn't open your photos", { description: (e as Error).message });
    }
    setPhotos((p) => [...p, ...uris.map((local) => ({ local, state: 'uploading' as const }))]);
    // Upload in parallel; each tile updates as it finishes.
    for (const local of uris) upload(local);
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const [g] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (g) {
        setValue('locality', g.district || g.subregion || g.city || g.name || '', { shouldValidate: formState.isSubmitted });
        setValue('district', g.subregion || g.city || '');
        setValue('state', g.region || '');
      }
    } catch {
      // Offline or geocoder unavailable: the user types it.
    } finally {
      setGeocoding(false);
    }
  };

  const goToMyLocation = async () => {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return toast('Location permission is off');
    const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    pick({ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 });
  };

  const pick = (r: Region) => {
    setPicking(false);
    setValue('lat', r.latitude);
    setValue('lng', r.longitude);
    map.current?.animateToRegion(r, 400);
    void reverseGeocode(r.latitude, r.longitude);
  };
  const lat = watch('lat');
  const lng = watch('lng');

  const uploading = photos.some((p) => p.state === 'uploading');
  const submit = () =>
    void handleSubmit(async (v) => {
      try {
        if (initial) {
          await update.mutateAsync(v);
          toast.success('Listing updated');
          router.back();
        } else {
          const l = await create.mutateAsync(v);
          toast.success('Your land is live');
          router.replace({ pathname: '/listing/[id]', params: { id: l.id } });
        }
      } catch (e) {
        applyServerErrors(e, setError);
      }
    })();

  return (
    <FormScreen
      title={initial ? 'Edit listing' : 'List your land'}
      subtitle={initial ? 'Changes are visible to buyers right away.' : 'Good photos and a clear price get the most enquiries.'}
      footer={
        <Button
          title={uploading ? 'Uploading photos…' : initial ? 'Save changes' : 'Publish listing'}
          onPress={submit}
          loading={create.isPending || update.isPending}
          disabled={uploading}
        />
      }
    >
      <Section title="Photos" error={err.images?.message}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {photos.length < 10 ? (
            <Pressable onPress={addPhotos} style={s.addPhoto} accessibilityRole="button" accessibilityLabel="Add photos">
              <ImagePlus size={26} color={c.inkSoft} />
              <Text variant="micro" color="muted">
                {photos.length}/10
              </Text>
            </Pressable>
          ) : null}
          {photos.map((p) => (
            <View key={p.local} style={s.photo}>
              <Image source={p.local} style={StyleSheet.absoluteFill} contentFit="cover" />
              {p.state === 'uploading' ? (
                <View style={s.photoState}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : p.state === 'failed' ? (
                <Pressable
                  style={s.photoState}
                  onPress={() => upload(p.local)}
                  accessibilityRole="button"
                  accessibilityLabel="Upload failed. Tap to retry"
                >
                  <AlertCircle color="#fff" />
                  <Text variant="micro" style={{ color: '#fff' }}>
                    Tap to retry
                  </Text>
                </Pressable>
              ) : null}
              <IconButton
                icon={X}
                label="Remove photo"
                variant="glass"
                size={28}
                style={{ position: 'absolute', top: 6, right: 6 }}
                onPress={() => setPhotos((ps) => ps.filter((x) => x.local !== p.local))}
              />
            </View>
          ))}
        </ScrollView>
      </Section>

      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <Field
            label="Title"
            placeholder="e.g. 2 acre mango farm near Chevella"
            value={field.value}
            onChangeText={field.onChange}
            error={err.title?.message}
            hint={`${field.value?.length ?? 0}/120 · short and specific works best`}
            maxLength={120}
          />
        )}
      />

      <Section title="Land type">
        <Controller
          control={control}
          name="landType"
          render={({ field }) => (
            <View style={s.wrap}>
              {LAND_TYPES.map((t) => (
                <Chip key={t} label={LAND_TYPE_LABEL[t]} selected={field.value === t} onPress={() => field.onChange(t)} />
              ))}
            </View>
          )}
        />
      </Section>

      <Section title="Area" error={err.area?.message}>
        <Controller
          control={control}
          name="area"
          render={({ field }) => (
            <Field
              label="Size"
              placeholder="2.5"
              keyboardType="decimal-pad"
              value={areaText}
              // Up to 9,999,999.99 of any unit: covers a cent of land to a whole estate.
              onChangeText={(v) => {
                const [whole = '', ...rest] = v.replace(/[^0-9.]/g, '').split('.');
                const clean = rest.length ? `${whole.slice(0, 7)}.${rest.join('').slice(0, 2)}` : whole.slice(0, 7);
                setAreaText(clean);
                field.onChange(num(clean));
              }}
              maxLength={10}
              error={err.area?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="areaUnit"
          render={({ field }) => (
            <View style={s.wrap}>
              {AREA_UNITS.map((u) => (
                <Chip key={u} label={UNIT_LABEL[u]} selected={field.value === u} onPress={() => field.onChange(u)} />
              ))}
            </View>
          )}
        />
      </Section>

      <Controller
        control={control}
        name="priceInr"
        render={({ field }) => (
          <Field
            label="Asking price (₹)"
            placeholder="1,12,00,000"
            keyboardType="number-pad"
            value={field.value ? field.value.toLocaleString('en-IN') : ''}
            // 12 digits = up to ₹1 lakh crore, the schema's ceiling.
            onChangeText={(v) => field.onChange(num(v.replace(/\D/g, '').slice(0, 12)))}
            error={err.priceInr?.message}
            hint={price ? `${formatInr(price)}${area ? ` · ${formatPerUnit(price, area, unit)}` : ''}` : 'Total price for the whole plot'}
          />
        )}
      />

      <Section title="Location" error={err.locality?.message}>
        {/* A still preview: scrolling the form must never pan the map. Tap opens the full-screen picker. */}
        <Pressable
          style={s.mapBox}
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel="Set the plot's location on a map"
        >
          <MapView
            ref={map}
            style={StyleSheet.absoluteFill}
            initialRegion={startRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
            pointerEvents="none"
          />
          <View pointerEvents="none" style={s.centerPin}>
            <MapPin size={36} color={c.danger} fill={c.surface} />
          </View>
          <View pointerEvents="none" style={s.mapCta}>
            <Text variant="smallMedium">{moved.current || initial ? 'Adjust pin' : 'Set location'}</Text>
          </View>
          {geocoding ? <ActivityIndicator style={{ position: 'absolute', left: 12, bottom: 18 }} color={c.ink} /> : null}
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="small" color="muted" style={{ flex: 1 }}>
            Tap the map to place the pin on your land.
          </Text>
          <Button title="Use my location" icon={LocateFixed} kind="ghost" size="md" onPress={() => void goToMyLocation()} />
        </View>
        <LocationPicker
          visible={picking}
          region={{ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
          onClose={() => setPicking(false)}
          onPick={(r) => {
            moved.current = true;
            pick(r);
          }}
        />
        <Controller
          control={control}
          name="locality"
          render={({ field }) => (
            <Field label="Village / locality" value={field.value} onChangeText={field.onChange} maxLength={120} autoCapitalize="words" />
          )}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="district"
              render={({ field }) => (
                <Field label="District" value={field.value ?? ''} onChangeText={field.onChange} maxLength={80} autoCapitalize="words" />
              )}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="state"
              render={({ field }) => (
                <Field label="State" value={field.value ?? ''} onChangeText={field.onChange} maxLength={60} autoCapitalize="words" />
              )}
            />
          </View>
        </View>
        <Controller
          control={control}
          name="approxLocation"
          render={({ field }) => (
            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">Show approximate location</Text>
                <Text variant="small" color="muted">
                  Buyers see a ~1 km area until you share the exact spot in chat.
                </Text>
              </View>
              <Switch value={field.value} onValueChange={field.onChange} trackColor={{ true: c.brand, false: c.line }} thumbColor="#fff" />
            </View>
          )}
        />
      </Section>

      <Section title="Details">
        <Controller
          control={control}
          name="roadAccessFt"
          render={({ field }) => (
            <Field
              label="Road width (ft)"
              placeholder="30"
              keyboardType="number-pad"
              value={field.value?.toString() ?? ''}
              onChangeText={(v) => field.onChange(num(v.replace(/\D/g, '').slice(0, 3)) ?? null)}
              maxLength={3}
              error={err.roadAccessFt ? 'Up to 500 ft' : undefined}
              hint="Width of the road touching the plot"
            />
          )}
        />
        <Text variant="smallMedium" color="inkSoft">
          Water source
        </Text>
        <Controller
          control={control}
          name="waterSource"
          render={({ field }) => (
            <View style={s.wrap}>
              {WATER_SOURCES.map((w) => (
                <Chip
                  key={w}
                  label={w[0]!.toUpperCase() + w.slice(1)}
                  selected={field.value === w}
                  onPress={() => field.onChange(field.value === w ? null : w)}
                />
              ))}
            </View>
          )}
        />
        <Text variant="smallMedium" color="inkSoft">
          Zoning
        </Text>
        <Controller
          control={control}
          name="zoning"
          render={({ field }) => (
            <View style={s.wrap}>
              {ZONING.map((z) => (
                <Chip key={z} label={z} selected={field.value === z} onPress={() => field.onChange(field.value === z ? null : z)} />
              ))}
            </View>
          )}
        />
        <Text variant="smallMedium" color="inkSoft">
          Title documents available
        </Text>
        <Controller
          control={control}
          name="titleDocs"
          render={({ field }) => {
            const v = field.value ?? [];
            return (
              <View style={s.wrap}>
                {DOCS.map((d) => (
                  <Chip
                    key={d}
                    label={d}
                    selected={v.includes(d)}
                    onPress={() => field.onChange(v.includes(d) ? v.filter((x) => x !== d) : [...v, d])}
                  />
                ))}
              </View>
            );
          }}
        />
      </Section>

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <Field
            label="Description"
            placeholder="Soil, crops, fencing, nearby landmarks…"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            multiline
            style={{ minHeight: 110, textAlignVertical: 'top' }}
            maxLength={4000}
            hint={`${(field.value ?? '').length}/4000`}
          />
        )}
      />
    </FormScreen>
  );
}

function Section({ title, error, children }: { title: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text variant="h1">{title}</Text>
      {children}
      {error ? (
        <Text variant="small" color="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ c }) => ({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addPhoto: {
    width: 104,
    height: 104,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: c.muted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photo: { width: 104, height: 104, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.skeleton },
  photoState: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBox: { height: 220, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.surfaceAlt },
  mapCta: {
    position: 'absolute',
    left: 12,
    top: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  centerPin: { position: 'absolute', left: '50%', top: '50%', marginLeft: -18, marginTop: -34 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: c.line,
  },
}));
