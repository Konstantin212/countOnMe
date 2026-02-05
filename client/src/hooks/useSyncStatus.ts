import { useCallback, useEffect, useMemo, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

import { getApiBaseUrl } from '@services/api/config';
import { getDeviceToken, getOrCreateDeviceId } from '@storage/device';
import { flush, getLastSyncAt, getLastSyncError, getQueue } from '@storage/syncQueue';

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
  const [deviceId, setDeviceId] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [lastSyncAt, setLastSyncAtState] = useState<number | null>(null);
  const [lastError, setLastErrorState] = useState<string | null>(null);
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected));
    });
    return () => sub();
  }, []);

  const refresh = useCallback(async () => {
    const id = await getOrCreateDeviceId();
    const token = await getDeviceToken();
    const queue = await getQueue();
    const syncAt = await getLastSyncAt();
    const err = await getLastSyncError();

    setDeviceId(id);
    setHasToken(Boolean(token));
    setQueueSize(queue.length);
    setLastSyncAtState(syncAt);
    setLastErrorState(err);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flushNow = useCallback(async () => {
    setFlushing(true);
    try {
      await flush();
    } finally {
      setFlushing(false);
      await refresh();
    }
  }, [refresh]);

  return {
    baseUrl,
    deviceId,
    hasToken,
    isOnline,
    queueSize,
    lastSyncAt,
    lastError,
    flushing,
    refresh,
    flushNow,
  };
};

