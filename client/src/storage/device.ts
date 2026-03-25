import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuid } from "uuid";

const STORAGE_KEYS = {
  deviceId: "device:id",
  deviceToken: "device:token",
};

export const getOrCreateDeviceId = async (): Promise<string> => {
  const existing = await AsyncStorage.getItem(STORAGE_KEYS.deviceId);
  if (existing) {
    return existing;
  }

  const id = uuid();
  await AsyncStorage.setItem(STORAGE_KEYS.deviceId, id);
  return id;
};

/**
 * @deprecated Legacy device token — kept for migration to Supabase auth.
 * Will be removed once all devices have migrated.
 */
export const getDeviceToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(STORAGE_KEYS.deviceToken);
};

/**
 * @deprecated Legacy device token — kept for migration to Supabase auth.
 * Will be removed once all devices have migrated.
 */
export const setDeviceToken = async (token: string): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.deviceToken, token);
};

/**
 * @deprecated Legacy device token — kept for migration to Supabase auth.
 * Will be removed once all devices have migrated.
 */
export const clearDeviceToken = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEYS.deviceToken);
};
