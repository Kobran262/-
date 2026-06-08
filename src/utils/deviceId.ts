import * as SecureStore from 'expo-secure-store';
import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'srecha_device_id';

export async function getDeviceId(): Promise<string> {
  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = uuidv4().slice(0, 2).toUpperCase();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export async function getFullDeviceId(): Promise<string> {
  const key = 'srecha_device_full_id';
  let id = await SecureStore.getItemAsync(key);
  if (!id) {
    id = uuidv4();
    await SecureStore.setItemAsync(key, id);
  }
  return id;
}
