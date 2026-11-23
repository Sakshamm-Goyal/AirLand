import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

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
  const ref = await ImageManipulator.manipulate(uri).resize({ width: 1600 }).renderAsync();
  const out = await ref.saveAsync({ compress: 0.75, format: SaveFormat.JPEG });
  const form = new FormData();
  form.append('file', { uri: out.uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  const { url } = await api.upload<{ url: string }>('/uploads', form);
  return url;
}
