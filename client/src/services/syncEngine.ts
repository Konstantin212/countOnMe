import type {
  BodyWeightEntry,
  Product,
  UserGoal,
  WaterLog,
} from "@models/types";
import {
  pullDeltas,
  pushMutations,
  type SyncItem,
  type SyncMutation,
} from "@services/api/sync";
import {
  loadOutbox,
  markFailed,
  removeFromOutbox,
  type OutboxEntry,
} from "@storage/outbox";
import {
  loadBodyWeights,
  loadGoal,
  loadProducts,
  loadSyncCursor,
  loadWaterLogs,
  saveBodyWeights,
  saveGoal,
  saveProducts,
  saveSyncCursor,
  saveWaterLogs,
} from "@storage/storage";
import { getQueue as getLegacyQueue } from "@storage/syncQueue";

// --- Types ---

export type SyncStatus = "idle" | "pulling" | "pushing" | "error";

export type SyncState = {
  status: SyncStatus;
  lastSyncAt: number | null;
  lastError: string | null;
  pendingCount: number;
};

type SyncListener = (state: SyncState) => void;

// --- Constants ---

const PUSH_BATCH_SIZE = 50;
const DEBOUNCE_MS = 2000;

// --- State ---

let currentState: SyncState = {
  status: "idle",
  lastSyncAt: null,
  lastError: null,
  pendingCount: 0,
};

const listeners = new Set<SyncListener>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

// --- Helpers ---

const notify = (): void => {
  for (const listener of listeners) {
    try {
      listener(currentState);
    } catch {
      // Listener errors should not break the engine
    }
  }
};

const setState = (patch: Partial<SyncState>): void => {
  currentState = { ...currentState, ...patch };
  notify();
};

// --- Runtime validation helpers ---

const asString = (value: unknown, fallback: string): string => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return fallback;
};

const asNumber = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  return fallback;
};

const asOptionalString = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return undefined;
};

const asOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  return undefined;
};

// --- Entity merge functions (pull) ---

const mergeProducts = async (items: SyncItem[]): Promise<void> => {
  const products = await loadProducts();
  let updated = [...products];

  for (const item of items) {
    const idx = updated.findIndex((p) => p.id === item.id);

    if (item.deletedAt) {
      // Remove deleted product
      if (idx >= 0) {
        updated = updated.filter((p) => p.id !== item.id);
      }
      continue;
    }

    const { data } = item;

    const product: Product = {
      id: item.id,
      name: asString(data.name, ""),
      barcode: asOptionalString(data.barcode),
      category: asOptionalString(data.category),
      portionSize: asOptionalNumber(data.portion_size),
      scaleType: asOptionalString(data.scale_type) as Product["scaleType"],
      scaleUnit: asOptionalString(data.scale_unit) as Product["scaleUnit"],
      caloriesPerBase: asOptionalNumber(data.calories_per_base),
      proteinPerBase: asOptionalNumber(data.protein_per_base),
      carbsPerBase: asOptionalNumber(data.carbs_per_base),
      fatPerBase: asOptionalNumber(data.fat_per_base),
      caloriesPer100g: asNumber(data.calories_per_100g, 0),
      proteinPer100g: asOptionalNumber(data.protein_per_100g),
      carbsPer100g: asOptionalNumber(data.carbs_per_100g),
      fatPer100g: asOptionalNumber(data.fat_per_100g),
      source: asString(data.source, "user") as Product["source"],
      createdAt: asString(data.created_at, item.updatedAt),
      updatedAt: item.updatedAt,
    };

    if (idx >= 0) {
      updated = updated.map((p) => (p.id === item.id ? product : p));
    } else {
      updated = [...updated, product];
    }
  }

  await saveProducts(updated);
};

const mergeBodyWeights = async (items: SyncItem[]): Promise<void> => {
  const weights = await loadBodyWeights();
  let updated = [...weights];

  for (const item of items) {
    const idx = updated.findIndex((w) => w.id === item.id);

    if (item.deletedAt) {
      if (idx >= 0) {
        updated = updated.filter((w) => w.id !== item.id);
      }
      continue;
    }

    const { data } = item;

    // Skip items missing required fields
    if (typeof data.day !== "string" || typeof data.weight_kg !== "number") {
      continue;
    }

    const weight: BodyWeightEntry = {
      id: item.id,
      day: data.day,
      weightKg: asNumber(data.weight_kg, 0),
      createdAt: asString(data.created_at, item.updatedAt),
      updatedAt: item.updatedAt,
    };

    if (idx >= 0) {
      updated = updated.map((w) => (w.id === item.id ? weight : w));
    } else {
      updated = [...updated, weight];
    }
  }

  await saveBodyWeights(updated);
};

const mergeGoals = async (items: SyncItem[]): Promise<void> => {
  const currentGoal = await loadGoal();

  // Process items in order; last one wins
  let latestGoal: UserGoal | null = currentGoal;

  for (const item of items) {
    if (item.deletedAt) {
      if (latestGoal?.id === item.id) {
        latestGoal = null;
      }
      continue;
    }

    const { data } = item;

    // Skip items missing the critical required field
    if (
      typeof data.daily_calories_kcal !== "number" &&
      data.daily_calories_kcal !== undefined
    ) {
      // Allow undefined (will default to 0) but reject non-number truthy values
      if (data.daily_calories_kcal !== undefined) {
        continue;
      }
    }

    const goalType = asString(data.goal_type, "manual");

    const goal: UserGoal = {
      id: item.id,
      goalType: goalType as UserGoal["goalType"],
      gender: asOptionalString(data.gender) as UserGoal["gender"],
      birthDate: asOptionalString(data.birth_date),
      heightCm: asOptionalNumber(data.height_cm),
      currentWeightKg: asOptionalNumber(data.current_weight_kg),
      activityLevel: asOptionalString(
        data.activity_level,
      ) as UserGoal["activityLevel"],
      weightGoalType: asOptionalString(
        data.weight_goal_type,
      ) as UserGoal["weightGoalType"],
      targetWeightKg: asOptionalNumber(data.target_weight_kg),
      weightChangePace: asOptionalString(
        data.weight_change_pace,
      ) as UserGoal["weightChangePace"],
      bmrKcal: asOptionalNumber(data.bmr_kcal),
      tdeeKcal: asOptionalNumber(data.tdee_kcal),
      dailyCaloriesKcal: asNumber(data.daily_calories_kcal, 0),
      proteinPercent: asNumber(data.protein_percent, 0),
      carbsPercent: asNumber(data.carbs_percent, 0),
      fatPercent: asNumber(data.fat_percent, 0),
      proteinGrams: asNumber(data.protein_grams, 0),
      carbsGrams: asNumber(data.carbs_grams, 0),
      fatGrams: asNumber(data.fat_grams, 0),
      waterMl: asNumber(data.water_ml, 0),
      healthyWeightMinKg: asOptionalNumber(data.healthy_weight_min_kg),
      healthyWeightMaxKg: asOptionalNumber(data.healthy_weight_max_kg),
      currentBmi: asOptionalNumber(data.current_bmi),
      bmiCategory: asOptionalString(
        data.bmi_category,
      ) as UserGoal["bmiCategory"],
      createdAt: asString(data.created_at, item.updatedAt),
      updatedAt: item.updatedAt,
    };

    latestGoal = goal;
  }

  if (latestGoal) {
    await saveGoal(latestGoal);
  }
};

const mergeWaterLogs = async (items: SyncItem[]): Promise<void> => {
  const logs = await loadWaterLogs();
  let updated = [...logs];

  for (const item of items) {
    const idx = updated.findIndex((l) => l.id === item.id);

    if (item.deletedAt) {
      if (idx >= 0) {
        updated = updated.filter((l) => l.id !== item.id);
      }
      continue;
    }

    const { data } = item;

    // Skip items missing required fields
    if (typeof data.day !== "string" || typeof data.amount_ml !== "number") {
      continue;
    }

    const log: WaterLog = {
      id: item.id,
      day: data.day,
      amountMl: asNumber(data.amount_ml, 0),
      createdAt: asString(data.created_at, item.updatedAt),
      updatedAt: item.updatedAt,
    };

    if (idx >= 0) {
      updated = updated.map((l) => (l.id === item.id ? log : l));
    } else {
      updated = [...updated, log];
    }
  }

  await saveWaterLogs(updated);
};

const applyDeltas = async (items: SyncItem[]): Promise<void> => {
  // Group items by entity type
  const grouped: Record<string, SyncItem[]> = {};
  for (const item of items) {
    const key = item.entityType;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  }

  // Apply by entity type
  if (grouped["product"]) {
    await mergeProducts(grouped["product"]);
  }
  if (grouped["body_weight"]) {
    await mergeBodyWeights(grouped["body_weight"]);
  }
  if (grouped["user_goal"]) {
    await mergeGoals(grouped["user_goal"]);
  }
  if (grouped["water_log"]) {
    await mergeWaterLogs(grouped["water_log"]);
  }
  // Portions and food_entries: skip (no local storage / pull-only via direct API)
};

// --- Outbox to mutation mapper ---

const outboxEntryToMutation = (entry: OutboxEntry): SyncMutation => ({
  entityType: entry.entityType,
  action: entry.action,
  id: entry.entityId,
  data: entry.data,
  updatedAt: entry.updatedAt,
});

// --- Legacy queue migration ---

const migrateLegacyQueue = async (): Promise<void> => {
  try {
    const legacyOps = await getLegacyQueue();
    if (legacyOps.length === 0) {
      return;
    }

    // Legacy ops use different resource names; map to new entity types
    const resourceToEntityType: Record<string, string> = {
      products: "product",
      goals: "user_goal",
      "body-weights": "body_weight",
    };

    const { enqueueOutbox } = await import("@storage/outbox");

    for (const op of legacyOps) {
      const entityType = resourceToEntityType[op.resource];
      if (!entityType) {
        continue;
      }

      const entityId = (op.payload?.id as string) ?? op.id;
      const action = op.action === "delete" ? "delete" : "upsert";

      await enqueueOutbox({
        id: `legacy:${op.id}`,
        entityType,
        action,
        entityId,
        data: action === "delete" ? null : op.payload,
        updatedAt: new Date(op.createdAt).toISOString(),
      });
    }

    // Clear the legacy queue storage
    const AsyncStorage = (
      await import("@react-native-async-storage/async-storage")
    ).default;
    await AsyncStorage.removeItem("syncQueue:v1");
  } catch {
    // Legacy migration is best-effort
  }
};

// --- Core sync operations ---

/**
 * Pull changes from the server and apply to local storage.
 */
export const pull = async (): Promise<void> => {
  setState({ status: "pulling" });

  let sinceVersion = await loadSyncCursor();
  let hasMore = true;

  while (hasMore) {
    const response = await pullDeltas({
      sinceVersion,
      limit: 500,
    });

    if (response.items.length > 0) {
      await applyDeltas(response.items);
    }

    if (response.nextVersion !== null) {
      sinceVersion = response.nextVersion;
      await saveSyncCursor(sinceVersion);
    }

    hasMore = response.hasMore;
  }
};

/**
 * Push pending outbox mutations to the server in batches.
 */
export const push = async (): Promise<void> => {
  setState({ status: "pushing" });

  const entries = await loadOutbox();
  if (entries.length === 0) {
    return;
  }

  // Process in batches of PUSH_BATCH_SIZE
  for (let i = 0; i < entries.length; i += PUSH_BATCH_SIZE) {
    const batch = entries.slice(i, i + PUSH_BATCH_SIZE);
    const mutations = batch.map(outboxEntryToMutation);

    try {
      const result = await pushMutations(mutations);

      // Remove accepted entries from outbox
      const acceptedIds = batch.map((e) => e.id);
      await removeFromOutbox(acceptedIds);

      // Handle conflicts — LWW means server is right, so we just remove them
      if (result.conflicts.length > 0) {
        // Conflicts are already handled server-side (server version wins).
        // The conflicting outbox entries were already removed above.
        // On next pull, we'll get the server's version.
      }
    } catch (error) {
      // Mark individual entries as failed
      for (const entry of batch) {
        const msg = error instanceof Error ? error.message : "Push failed";
        await markFailed(entry.id, msg);
      }
      throw error;
    }
  }
};

/**
 * Full sync: pull first (get latest server state), then push (send local changes).
 */
export const sync = async (): Promise<void> => {
  if (isSyncing) {
    return;
  }

  isSyncing = true;

  try {
    // Migrate legacy queue on first sync
    await migrateLegacyQueue();

    await pull();
    await push();

    const pendingCount = (await loadOutbox()).length;

    setState({
      status: "idle",
      lastSyncAt: Date.now(),
      lastError: null,
      pendingCount,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Sync failed";
    setState({
      status: "error",
      lastError: msg,
    });
  } finally {
    isSyncing = false;
  }
};

/**
 * Debounced sync — collapses rapid triggers within DEBOUNCE_MS.
 */
export const debouncedSync = (): void => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    sync();
  }, DEBOUNCE_MS);
};

/**
 * Subscribe to sync state changes.
 * Returns an unsubscribe function.
 */
export const subscribe = (listener: SyncListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Get the current sync state.
 */
export const getState = (): SyncState => currentState;

// --- Periodic sync ---

let periodicTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic sync at the given interval (default: 5 minutes).
 */
export const startPeriodicSync = (intervalMs: number = 300_000): void => {
  stopPeriodicSync();
  periodicTimer = setInterval(() => {
    if (!isSyncing) {
      sync();
    }
  }, intervalMs);
};

/**
 * Stop periodic sync.
 */
export const stopPeriodicSync = (): void => {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
};

// --- Reset (for testing) ---

export const __resetForTesting = (): void => {
  currentState = {
    status: "idle",
    lastSyncAt: null,
    lastError: null,
    pendingCount: 0,
  };
  listeners.clear();
  isSyncing = false;
  stopPeriodicSync();
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
};
