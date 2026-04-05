import type {
  BodyWeightEntry,
  FastingSession,
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
import type { Database } from "@storage/database";
import type { OutboxEntry } from "@storage/outbox";
import {
  productRepository,
  goalRepository,
  bodyWeightRepository,
  waterLogRepository,
  fastingRepository,
  outboxRepository,
  syncCursorRepository,
} from "@storage/repositories";

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

// --- Database reference (set by DatabaseProvider on mount) ---

let _db: Database | null = null;
let _userId: string | null = null;

/**
 * Set the database instance for the sync engine.
 * Called by DatabaseProvider after DB initialisation.
 */
export const setDatabase = (db: Database, userId: string): void => {
  _db = db;
  _userId = userId;
};

const getDb = (): Database | null => _db;
const getUserId = (): string | null => _userId;

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

const mergeProducts = async (
  db: Database,
  userId: string,
  items: SyncItem[],
): Promise<void> => {
  for (const item of items) {
    if (item.deletedAt) {
      await productRepository.markDeleted(db, item.id);
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

    await productRepository.upsert(db, userId, product);
  }
};

const mergeBodyWeights = async (
  db: Database,
  userId: string,
  items: SyncItem[],
): Promise<void> => {
  for (const item of items) {
    if (item.deletedAt) {
      await bodyWeightRepository.markDeleted(db, item.id);
      continue;
    }

    const { data } = item;

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

    await bodyWeightRepository.upsert(db, userId, weight);
  }
};

const mergeGoals = async (
  db: Database,
  userId: string,
  items: SyncItem[],
): Promise<void> => {
  for (const item of items) {
    if (item.deletedAt) {
      await goalRepository.remove(db, item.id);
      continue;
    }

    const { data } = item;

    if (
      typeof data.daily_calories_kcal !== "number" &&
      data.daily_calories_kcal !== undefined
    ) {
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

    await goalRepository.upsert(db, userId, goal);
  }
};

const mergeWaterLogs = async (
  db: Database,
  userId: string,
  items: SyncItem[],
): Promise<void> => {
  for (const item of items) {
    if (item.deletedAt) {
      await waterLogRepository.markDeleted(db, item.id);
      continue;
    }

    const { data } = item;

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

    await waterLogRepository.upsert(db, userId, log);
  }
};

const mergeFastingSessions = async (
  db: Database,
  userId: string,
  items: SyncItem[],
): Promise<void> => {
  for (const item of items) {
    if (item.deletedAt) {
      await fastingRepository.markDeleted(db, item.id);
      continue;
    }

    const { data } = item;

    if (
      typeof data.technique !== "string" ||
      typeof data.fasting_hours !== "number"
    ) {
      continue;
    }

    const session: FastingSession = {
      id: item.id,
      technique: asString(
        data.technique,
        "custom",
      ) as FastingSession["technique"],
      fastingHours: asNumber(data.fasting_hours, 0),
      startedAt: asString(data.started_at, item.updatedAt),
      targetEndAt: asString(data.target_end_at, item.updatedAt),
      endedAt: asOptionalString(data.ended_at) ?? null,
      pausedAt: asOptionalString(data.paused_at) ?? null,
      completed: data.completed === true || data.completed === 1,
      createdAt: asString(data.created_at, item.updatedAt),
      updatedAt: item.updatedAt,
    };

    await fastingRepository.upsert(db, userId, session);
  }
};

const applyDeltas = async (
  db: Database,
  userId: string,
  items: SyncItem[],
): Promise<void> => {
  const grouped: Record<string, SyncItem[]> = {};
  for (const item of items) {
    const key = item.entityType;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
  }

  if (grouped["product"]) {
    await mergeProducts(db, userId, grouped["product"]);
  }
  if (grouped["body_weight"]) {
    await mergeBodyWeights(db, userId, grouped["body_weight"]);
  }
  if (grouped["user_goal"]) {
    await mergeGoals(db, userId, grouped["user_goal"]);
  }
  if (grouped["water_log"]) {
    await mergeWaterLogs(db, userId, grouped["water_log"]);
  }
  if (grouped["fasting_session"]) {
    await mergeFastingSessions(db, userId, grouped["fasting_session"]);
  }
};

// --- Outbox to mutation mapper ---

const outboxEntryToMutation = (entry: OutboxEntry): SyncMutation => ({
  entityType: entry.entityType,
  action: entry.action,
  id: entry.entityId,
  data: entry.data,
  updatedAt: entry.updatedAt,
});

// --- Core sync operations ---

/**
 * Pull changes from the server and apply to local storage.
 */
export const pull = async (): Promise<void> => {
  const db = getDb();
  const userId = getUserId();
  if (!db || !userId) return;

  setState({ status: "pulling" });

  let sinceVersion = await syncCursorRepository.getCursor(db, "all");
  let hasMore = true;

  while (hasMore) {
    const response = await pullDeltas({
      sinceVersion,
      limit: 500,
    });

    if (response.items.length > 0) {
      await applyDeltas(db, userId, response.items);
    }

    if (response.nextVersion !== null) {
      sinceVersion = response.nextVersion;
      await syncCursorRepository.setCursor(db, "all", sinceVersion);
    }

    hasMore = response.hasMore;
  }
};

/**
 * Push pending outbox mutations to the server in batches.
 */
export const push = async (): Promise<void> => {
  const db = getDb();
  if (!db) return;

  setState({ status: "pushing" });

  const entries = await outboxRepository.loadAll(db);
  if (entries.length === 0) {
    return;
  }

  for (let i = 0; i < entries.length; i += PUSH_BATCH_SIZE) {
    const batch = entries.slice(i, i + PUSH_BATCH_SIZE);
    const mutations = batch.map(outboxEntryToMutation);

    try {
      const result = await pushMutations(mutations);

      const acceptedIds = batch.map((e) => e.id);
      await outboxRepository.remove(db, acceptedIds);

      if (result.conflicts.length > 0) {
        // Conflicts handled server-side (LWW). Next pull gets server version.
      }
    } catch (error) {
      for (const entry of batch) {
        const msg = error instanceof Error ? error.message : "Push failed";
        await outboxRepository.markFailed(db, entry.id, msg);
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

  const db = getDb();
  if (!db) return;

  isSyncing = true;

  try {
    await pull();
    await push();

    const pendingCount = await outboxRepository.count(db);

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
  _db = null;
  _userId = null;
  stopPeriodicSync();
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
};
