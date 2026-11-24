import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { ApiError, api } from './api';

/** Pick up to `max` photos from the library. Returns local URIs. */
export async function pickPhotos(max: number): Promise<string[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: max,
    quality: 1,
  });
  return res.canceled ? [] : res.assets.map((a) => a.uri);
}

/**
 * Resize to 1600 px wide JPEG q0.75 (~200–300 KB from a 4–8 MB camera photo) then upload.
 * Cuts upload time on 4G by ~20× and keeps the DB-backed image store small.
 */
export async function uploadPhoto(uri: string): Promise<string> {
  let file = uri;
  try {
    const ref = await ImageManipulator.manipulate(uri).resize({ width: 1600 }).renderAsync();
    file = (await ref.saveAsync({ compress: 0.75, format: SaveFormat.JPEG })).uri;
  } catch (e) {
    // Some gallery apps hand back images the resizer can't open. Send the original instead:
    // the server checks the bytes are a real photo and caps the size at 4 MB.
    console.warn('photo resize failed, uploading original', e);
  }
  const form = new FormData();
  if (Platform.OS === 'web') {
    // Browsers need a real Blob; the {uri,name,type} shape is React Native's FormData extension.
    form.append('file', await (await fetch(file)).blob(), 'photo.jpg');
  } else {
    form.append('file', { uri: file, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  }
  try {
    const { url } = await api.upload<{ url: string }>('/uploads', form);
    return url;
  } catch (e) {
    if (e instanceof ApiError && e.status === 413) throw new ApiError(413, 'That photo is too large (max 4 MB).');
    throw e;
  }
}
