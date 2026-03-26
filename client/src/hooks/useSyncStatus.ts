import { useCallback, useEffect, useMemo, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

import { getApiBaseUrl } from "@services/api/config";
import {
  getState,
  subscribe,
  sync as syncNow,
  type SyncState,
} from "@services/syncEngine";
import { getDeviceToken, getOrCreateDeviceId } from "@storage/device";

export type SyncStatus = {
  baseUrl: string;
  deviceId: string;
  hasToken: boolean;
  isOnline: boolean;
  queueSize: number;
  lastSyncAt: number | null;
  lastError: string | null;
  flushing: boolean;
  refresh: () => Promise<void>;
  flushNow: () => Promise<void>;
};

export const useSyncStatus = (): SyncStatus => {
  const baseUrl = useMemo(() => getApiBaseUrl(), []);
  const [isOnline, setIsOnline] = useState(true);
  const [deviceId, setDeviceId] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>(getState);

  // Subscribe to NetInfo for online status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected));
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to sync engine state changes
  useEffect(() => {
    const unsubscribe = subscribe((state) => {
      setSyncState(state);
    });
    return () => unsubscribe();
  }, []);

  // Load device identity on mount
  const refresh = useCallback(async () => {
    const id = await getOrCreateDeviceId();
    const token = await getDeviceToken();
    setDeviceId(id);
    setHasToken(Boolean(token));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flushNow = useCallback(async () => {
    await syncNow();
  }, []);

  const isSyncing =
    syncState.status === "pulling" || syncState.status === "pushing";

  return {
    baseUrl,
    deviceId,
    hasToken,
    isOnline,
    queueSize: syncState.pendingCount,
    lastSyncAt: syncState.lastSyncAt,
    lastError: syncState.lastError,
    flushing: isSyncing,
    refresh,
    flushNow,
  };
};
