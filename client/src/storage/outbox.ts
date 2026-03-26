import AsyncStorage from "@react-native-async-storage/async-storage";

export type OutboxEntry = {
  id: string;
  entityType: string;
  action: "upsert" | "delete";
  entityId: string;
  data: Record<string, unknown> | null;
  updatedAt: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

const OUTBOX_STORAGE_KEY = "@countOnMe/outbox/v1";

const loadRaw = async (): Promise<OutboxEntry[]> => {
  const raw = await AsyncStorage.getItem(OUTBOX_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as OutboxEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveRaw = async (entries: OutboxEntry[]): Promise<void> => {
  await AsyncStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(entries));
};

/**
 * Enqueue a mutation to the outbox.
 * Deduplicates by entityType + entityId: if an entry with the same
 * combination already exists, it is replaced (last mutation wins locally).
 */
export const enqueueOutbox = async (
  entry: Omit<OutboxEntry, "createdAt" | "attempts">,
): Promise<void> => {
  const entries = await loadRaw();
  const dedupKey = `${entry.entityType}:${entry.entityId}`;

  const filtered = entries.filter(
    (e) => `${e.entityType}:${e.entityId}` !== dedupKey,
  );

  filtered.push({
    ...entry,
    createdAt: Date.now(),
    attempts: 0,
  });

  await saveRaw(filtered);
};

/**
 * Load all pending outbox entries, sorted by createdAt ascending.
 */
export const loadOutbox = async (): Promise<OutboxEntry[]> => {
  const entries = await loadRaw();
  return [...entries].sort((a, b) => a.createdAt - b.createdAt);
};

/**
 * Remove entries by their ids from the outbox.
 */
export const removeFromOutbox = async (ids: string[]): Promise<void> => {
  const idSet = new Set(ids);
  const entries = await loadRaw();
  const remaining = entries.filter((e) => !idSet.has(e.id));
  await saveRaw(remaining);
};

/**
 * Mark an outbox entry as failed with an error message.
 */
export const markFailed = async (id: string, error: string): Promise<void> => {
  const entries = await loadRaw();
  const updated = entries.map((e) =>
    e.id === id ? { ...e, attempts: e.attempts + 1, lastError: error } : e,
  );
  await saveRaw(updated);
};

/**
 * Clear all entries from the outbox.
 */
export const clearOutbox = async (): Promise<void> => {
  await AsyncStorage.removeItem(OUTBOX_STORAGE_KEY);
};

/**
 * Get the count of pending outbox entries.
 */
export const getOutboxCount = async (): Promise<number> => {
  const entries = await loadRaw();
  return entries.length;
};
