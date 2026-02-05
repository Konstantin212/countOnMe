import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import {
  createCalculatedGoal,
  createManualGoal,
  deleteGoal,
  updateGoal,
} from '@services/api/goals';
import { createProduct, deleteProduct, updateProduct } from '@services/api/products';

type Resource = 'products' | 'goals';
type Action = 'create' | 'update' | 'delete';

export type SyncOp = {
  id: string;
  resource: Resource;
  action: Action;
  payload: any;
  createdAt: number;
  attempts: number;
  nextAttemptAt?: number;
  lastError?: string;
};

const STORAGE_KEYS = {
  queue: 'syncQueue:v1',
  lastSyncAt: 'syncQueue:lastSyncAt',
  lastError: 'syncQueue:lastError',
};

const loadQueue = async (): Promise<SyncOp[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.queue);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as SyncOp[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveQueue = async (queue: SyncOp[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.queue, JSON.stringify(queue));
};

export const getLastSyncAt = async (): Promise<number | null> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.lastSyncAt);
  return raw ? Number(raw) : null;
};

export const getLastSyncError = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(STORAGE_KEYS.lastError);
};

const setLastSyncAt = async (ts: number): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.lastSyncAt, String(ts));
};

const setLastSyncError = async (err: string | null): Promise<void> => {
  if (!err) {
    await AsyncStorage.removeItem(STORAGE_KEYS.lastError);
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEYS.lastError, err);
};

const backoffMs = (attempts: number) => {
  const base = 1500; // 1.5s
  const max = 60_000; // 60s cap
  const exp = Math.min(attempts, 6); // cap exponential growth
  return Math.min(max, base * Math.pow(2, exp));
};

export const enqueue = async (op: Omit<SyncOp, 'attempts' | 'createdAt'>): Promise<void> => {
  const queue = await loadQueue();
  queue.push({
    ...op,
    createdAt: Date.now(),
    attempts: 0,
  });
  await saveQueue(queue);
};

export const getQueue = async (): Promise<SyncOp[]> => {
  return await loadQueue();
};

const applyOp = async (op: SyncOp) => {
  if (op.resource === 'products') {
    const { id, name } = op.payload ?? {};
    if (op.action === 'create') {
      await createProduct({ id, name });
      return;
    }
    if (op.action === 'update') {
      await updateProduct(id, { name });
      return;
    }
    if (op.action === 'delete') {
      await deleteProduct(id);
      return;
    }
  }

  if (op.resource === 'goals') {
    const { id, goalType, ...rest } = op.payload ?? {};
    if (op.action === 'create') {
      // Goals are created via API call directly in the hook, so this is mostly for offline sync
      // We don't need to re-create here as the goal was already created via the API
      return;
    }
    if (op.action === 'update') {
      if (id) {
        await updateGoal(id, rest);
      }
      return;
    }
    if (op.action === 'delete') {
      if (id) {
        await deleteGoal(id);
      }
      return;
    }
  }

  throw new Error(`Unsupported op: ${op.resource}.${op.action}`);
};

export type FlushResult = {
  attempted: number;
  succeeded: number;
  remaining: number;
  skipped: number;
  offline: boolean;
};

export const flush = async (): Promise<FlushResult> => {
  const net = await NetInfo.fetch();
  const offline = !net.isConnected;
  if (offline) {
    return { attempted: 0, succeeded: 0, remaining: (await loadQueue()).length, skipped: 0, offline };
  }

  let queue = await loadQueue();
  const now = Date.now();

  let attempted = 0;
  let succeeded = 0;
  let skipped = 0;

  const next: SyncOp[] = [];

  for (const op of queue) {
    if (op.nextAttemptAt && op.nextAttemptAt > now) {
      skipped += 1;
      next.push(op);
      continue;
    }

    attempted += 1;
    try {
      await applyOp(op);
      succeeded += 1;
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : 'Unknown sync error';
      const attempts = (op.attempts ?? 0) + 1;
      const delay = backoffMs(attempts);
      next.push({
        ...op,
        attempts,
        lastError: msg,
        nextAttemptAt: Date.now() + delay,
      });
      await setLastSyncError(msg);
    }
  }

  queue = next;
  await saveQueue(queue);

  if (succeeded > 0 && queue.length === 0) {
    await setLastSyncError(null);
  }
  if (attempted > 0 && succeeded === attempted) {
    await setLastSyncAt(Date.now());
  }

  return { attempted, succeeded, remaining: queue.length, skipped, offline: false };
};

