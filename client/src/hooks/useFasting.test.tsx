import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FastingSession } from "@models/types";
import * as fastingApi from "@services/api/fasting";
import { fastingRepository, outboxRepository } from "@storage/repositories";
import { useFasting } from "./useFasting";

const mockDbContext = {
  db: {
    withTransactionAsync: vi.fn(async (fn: () => Promise<void>) => await fn()),
  },
  userId: "test-user",
};
vi.mock("../storage/DatabaseProvider", () => ({
  useDatabaseContext: vi.fn(() => mockDbContext),
}));

vi.mock("@services/api/fasting");

vi.mock("../storage/repositories", () => ({
  fastingRepository: {
    findAll: vi.fn(() => Promise.resolve([])),
    findActive: vi.fn(() => Promise.resolve(null)),
    upsert: vi.fn(() => Promise.resolve()),
    markDeleted: vi.fn(() => Promise.resolve()),
  },
  outboxRepository: {
    enqueue: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("@services/syncEngine", () => ({
  debouncedSync: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "uuid-mock"),
}));

const mockListFastingSessions = vi.mocked(fastingApi.listFastingSessions);
const mockFindAll = vi.mocked(fastingRepository.findAll);
const mockUpsert = vi.mocked(fastingRepository.upsert);
const mockMarkDeleted = vi.mocked(fastingRepository.markDeleted);
const mockEnqueue = vi.mocked(outboxRepository.enqueue);

const makeFastingSession = (
  overrides: Partial<FastingSession> = {},
): FastingSession => ({
  id: "fs1",
  technique: "16:8",
  fastingHours: 16,
  startedAt: "2026-04-01T20:00:00.000Z",
  targetEndAt: "2026-04-02T12:00:00.000Z",
  endedAt: null,
  pausedAt: null,
  completed: false,
  createdAt: "2026-04-01T20:00:00.000Z",
  updatedAt: "2026-04-01T20:00:00.000Z",
  ...overrides,
});

describe("useFasting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindAll.mockResolvedValue([]);
    mockUpsert.mockResolvedValue();
    mockMarkDeleted.mockResolvedValue();
    mockListFastingSessions.mockResolvedValue([]);
  });

  it("loads sessions from local storage first", async () => {
    const localSessions = [makeFastingSession()];
    mockFindAll.mockResolvedValue(localSessions);
    mockListFastingSessions.mockResolvedValue(localSessions);

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessions).toEqual(localSessions);
    expect(mockFindAll).toHaveBeenCalledTimes(1);
  });

  it("derives active session from sessions list", async () => {
    const activeSession = makeFastingSession({
      id: "fs-active",
      endedAt: null,
    });
    const completedSession = makeFastingSession({
      id: "fs-done",
      endedAt: "2026-04-02T12:30:00.000Z",
      completed: true,
    });
    mockFindAll.mockResolvedValue([activeSession, completedSession]);
    mockListFastingSessions.mockResolvedValue([
      activeSession,
      completedSession,
    ]);

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.activeSession?.id).toBe("fs-active");
  });

  it("syncs with remote sessions if available", async () => {
    const localSessions = [makeFastingSession({ id: "fs1" })];
    const remoteSessions = [
      makeFastingSession({ id: "fs1" }),
      makeFastingSession({ id: "fs2", startedAt: "2026-04-02T20:00:00.000Z" }),
    ];
    mockFindAll.mockResolvedValue(localSessions);
    mockListFastingSessions.mockResolvedValue(remoteSessions);

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessions).toEqual(remoteSessions);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it("handles backend unavailable gracefully", async () => {
    const localSessions = [makeFastingSession()];
    mockFindAll.mockResolvedValue(localSessions);
    mockListFastingSessions.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.sessions).toEqual(localSessions);
    expect(result.current.error).toBeNull();
  });

  it("starts a new fasting session locally and enqueues to outbox", async () => {
    mockFindAll.mockResolvedValue([]);

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let created: FastingSession | undefined;
    await act(async () => {
      created = await result.current.startSession("16:8", 16);
    });

    expect(created).toBeDefined();
    expect(created?.id).toBe("uuid-mock");
    expect(created?.technique).toBe("16:8");
    expect(created?.fastingHours).toBe(16);
    expect(created?.endedAt).toBeNull();
    expect(created?.completed).toBe(false);
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.activeSession?.id).toBe("uuid-mock");
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: "fasting_session",
        action: "upsert",
        entityId: "uuid-mock",
        data: expect.objectContaining({
          technique: "16:8",
          fasting_hours: 16,
        }),
      }),
    );
  });

  it("ends the active session when no id provided", async () => {
    const activeSession = makeFastingSession({
      id: "fs-active",
      endedAt: null,
    });
    mockFindAll.mockResolvedValue([activeSession]);
    mockListFastingSessions.mockResolvedValue([activeSession]);

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let ended: FastingSession | null | undefined;
    await act(async () => {
      ended = await result.current.endSession();
    });

    expect(ended).not.toBeNull();
    expect(ended?.id).toBe("fs-active");
    expect(ended?.endedAt).toBeDefined();
    expect(result.current.activeSession).toBeNull();
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: "fasting_session",
        action: "upsert",
        entityId: "fs-active",
        data: expect.objectContaining({
          ended_at: expect.any(String),
        }),
      }),
    );
  });

  it("ends a specific session by id", async () => {
    const session = makeFastingSession({ id: "fs1", endedAt: null });
    mockFindAll.mockResolvedValue([session]);
    mockListFastingSessions.mockResolvedValue([session]);

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let ended: FastingSession | null | undefined;
    await act(async () => {
      ended = await result.current.endSession("fs1");
    });

    expect(ended?.id).toBe("fs1");
    expect(ended?.endedAt).toBeDefined();
  });

  it("returns null when ending non-existent session", async () => {
    mockFindAll.mockResolvedValue([]);

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let ended: FastingSession | null | undefined;
    await act(async () => {
      ended = await result.current.endSession("nonexistent");
    });

    expect(ended).toBeNull();
  });

  it("updates session locally and enqueues to outbox", async () => {
    const session = makeFastingSession();
    mockFindAll.mockResolvedValue([session]);
    mockListFastingSessions.mockResolvedValue([session]);

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let updated: FastingSession | null | undefined;
    await act(async () => {
      updated = await result.current.updateSession("fs1", {
        fastingHours: 18,
      });
    });

    expect(updated?.fastingHours).toBe(18);
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: "fasting_session",
        action: "upsert",
        data: expect.objectContaining({
          fasting_hours: 18,
        }),
      }),
    );
  });

  it("recalculates targetEndAt when fastingHours changes", async () => {
    const session = makeFastingSession({
      startedAt: "2026-04-01T20:00:00.000Z",
      fastingHours: 16,
      targetEndAt: "2026-04-02T12:00:00.000Z",
    });
    mockFindAll.mockResolvedValue([session]);
    mockListFastingSessions.mockResolvedValue([session]);

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let updated: FastingSession | null | undefined;
    await act(async () => {
      updated = await result.current.updateSession("fs1", {
        fastingHours: 20,
      });
    });

    // 20 hours from 2026-04-01T20:00:00 = 2026-04-02T16:00:00
    expect(updated?.targetEndAt).toBe("2026-04-02T16:00:00.000Z");
  });

  it("returns null when updating non-existent session", async () => {
    mockFindAll.mockResolvedValue([]);

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let updated: FastingSession | null | undefined;
    await act(async () => {
      updated = await result.current.updateSession("nonexistent", {
        fastingHours: 18,
      });
    });

    expect(updated).toBeNull();
  });

  it("deletes session locally and enqueues to outbox", async () => {
    const session = makeFastingSession();
    mockFindAll.mockResolvedValue([session]);
    mockListFastingSessions.mockResolvedValue([session]);

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = false;
    await act(async () => {
      success = await result.current.deleteSession("fs1");
    });

    expect(success).toBe(true);
    expect(result.current.sessions).toHaveLength(0);
    expect(mockMarkDeleted).toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        entityType: "fasting_session",
        action: "delete",
        entityId: "fs1",
        data: null,
      }),
    );
  });

  it("returns false when deleting non-existent session", async () => {
    mockFindAll.mockResolvedValue([]);

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let success: boolean = true;
    await act(async () => {
      success = await result.current.deleteSession("nonexistent");
    });

    expect(success).toBe(false);
  });

  it("refreshes sessions from storage and backend", async () => {
    const sessions = [makeFastingSession()];
    mockFindAll.mockResolvedValue([]);
    mockListFastingSessions.mockResolvedValue(sessions);

    const { result } = renderHook(() => useFasting());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockFindAll).toHaveBeenCalledTimes(2);
    expect(mockListFastingSessions).toHaveBeenCalledTimes(2);
  });
});
