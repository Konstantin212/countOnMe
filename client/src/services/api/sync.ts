import { apiFetch } from "./http";

// --- Types ---

export type SyncItem = {
  entityType: string;
  id: string;
  data: Record<string, unknown>;
  syncVersion: number;
  updatedAt: string;
  deletedAt: string | null;
};

export type SyncPullParams = {
  sinceVersion: number;
  limit?: number;
};

export type SyncPullResponse = {
  items: SyncItem[];
  nextVersion: number | null;
  hasMore: boolean;
};

export type SyncMutation = {
  entityType: string;
  action: "upsert" | "delete";
  id: string;
  data: Record<string, unknown> | null;
  updatedAt: string;
};

export type SyncConflict = {
  entityType: string;
  id: string;
  reason: string;
  serverVersion: Record<string, unknown>;
};

export type SyncPushResponse = {
  accepted: number;
  rejected: number;
  conflicts: SyncConflict[];
};

// --- API response types (snake_case from backend) ---

type SyncItemApiResponse = {
  entity_type: string;
  id: string;
  data: Record<string, unknown>;
  sync_version: number;
  updated_at: string;
  deleted_at: string | null;
};

type SyncPullApiResponse = {
  items: SyncItemApiResponse[];
  next_version: number | null;
  has_more: boolean;
};

type SyncConflictApiResponse = {
  entity_type: string;
  id: string;
  reason: string;
  server_version: Record<string, unknown>;
};

type SyncPushApiResponse = {
  accepted: number;
  rejected: number;
  conflicts: SyncConflictApiResponse[];
};

// --- Mappers ---

const mapSyncItem = (item: SyncItemApiResponse): SyncItem => ({
  entityType: item.entity_type,
  id: item.id,
  data: item.data,
  syncVersion: item.sync_version,
  updatedAt: item.updated_at,
  deletedAt: item.deleted_at,
});

const mapSyncConflict = (conflict: SyncConflictApiResponse): SyncConflict => ({
  entityType: conflict.entity_type,
  id: conflict.id,
  reason: conflict.reason,
  serverVersion: conflict.server_version,
});

// --- API functions ---

/**
 * Pull deltas from the server since a given sync version.
 */
export const pullDeltas = async (
  params: SyncPullParams,
): Promise<SyncPullResponse> => {
  const query: Record<string, string | number> = {
    since_version: params.sinceVersion,
  };
  if (params.limit !== undefined) {
    query.limit = params.limit;
  }

  const response = await apiFetch<SyncPullApiResponse>("/v1/sync/pull", {
    query,
  });

  return {
    items: response.items.map(mapSyncItem),
    nextVersion: response.next_version,
    hasMore: response.has_more,
  };
};

/**
 * Push mutations to the server in a batch.
 */
export const pushMutations = async (
  mutations: SyncMutation[],
): Promise<SyncPushResponse> => {
  const body = {
    mutations: mutations.map((m) => ({
      entity_type: m.entityType,
      action: m.action,
      id: m.id,
      data: m.data,
      updated_at: m.updatedAt,
    })),
  };

  const response = await apiFetch<SyncPushApiResponse>("/v1/sync/push", {
    method: "POST",
    body,
  });

  return {
    accepted: response.accepted,
    rejected: response.rejected,
    conflicts: response.conflicts.map(mapSyncConflict),
  };
};
