import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuid } from "uuid";

import type { FastingSession, FastingTechnique } from "@models/types";
import { listFastingSessions as apiListFastingSessions } from "@services/api/fasting";
import { useDatabaseContext } from "@storage/DatabaseProvider";
import { fastingRepository, outboxRepository } from "@storage/repositories";
import { debouncedSync } from "@services/syncEngine";

export type UseFastingResult = {
  sessions: FastingSession[];
  activeSession: FastingSession | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startSession: (
    technique: FastingTechnique,
    fastingHours: number,
  ) => Promise<FastingSession>;
  endSession: (id?: string) => Promise<FastingSession | null>;
  updateSession: (
    id: string,
    data: Partial<FastingSession>,
  ) => Promise<FastingSession | null>;
  deleteSession: (id: string) => Promise<boolean>;
};

export const useFasting = (): UseFastingResult => {
  const { db, userId } = useDatabaseContext();
  const [sessions, setSessions] = useState<FastingSession[]>([]);
  const sessionsRef = useRef<FastingSession[]>([]);
  const [activeSession, setActiveSession] = useState<FastingSession | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const deriveActive = (list: FastingSession[]): FastingSession | null => {
    return list.find((s) => s.endedAt === null) ?? null;
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const localSessions = await fastingRepository.findAll(db, userId);

      if (isMountedRef.current) {
        sessionsRef.current = localSessions;
        setSessions(localSessions);
        setActiveSession(deriveActive(localSessions));
      }

      try {
        const remoteSessions = await apiListFastingSessions();

        if (isMountedRef.current) {
          sessionsRef.current = remoteSessions;
          setSessions(remoteSessions);
          setActiveSession(deriveActive(remoteSessions));
          // Update local storage with remote data
          await db.withTransactionAsync(async () => {
            for (const session of remoteSessions) {
              await fastingRepository.upsert(db, userId, session);
            }
          });
        }
      } catch {
        // Backend not available, use local data
      }
    } catch {
      if (isMountedRef.current) {
        setError("Failed to load fasting sessions");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [db, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startSession = useCallback(
    async (
      technique: FastingTechnique,
      fastingHours: number,
    ): Promise<FastingSession> => {
      const timestamp = new Date().toISOString();
      const startedAt = new Date();
      const targetEndAt = new Date(
        startedAt.getTime() + fastingHours * 3600000,
      ).toISOString();

      const newSession: FastingSession = {
        id: uuid(),
        technique,
        fastingHours,
        startedAt: startedAt.toISOString(),
        targetEndAt,
        endedAt: null,
        completed: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const updatedSessions = [newSession, ...sessionsRef.current];
      sessionsRef.current = updatedSessions;

      if (isMountedRef.current) {
        setSessions(updatedSessions);
        setActiveSession(newSession);
      }

      try {
        await fastingRepository.upsert(db, userId, newSession);
        await outboxRepository.enqueue(db, {
          id: `fasting_session:${newSession.id}`,
          entityType: "fasting_session",
          action: "upsert",
          entityId: newSession.id,
          data: {
            technique: newSession.technique,
            fasting_hours: newSession.fastingHours,
            started_at: newSession.startedAt,
            target_end_at: newSession.targetEndAt,
            created_at: newSession.createdAt,
          },
          updatedAt: newSession.updatedAt,
        });
        debouncedSync();
      } catch {
        // Storage failure -- state already updated optimistically
      }

      return newSession;
    },
    [db, userId],
  );

  const endSession = useCallback(
    async (id?: string): Promise<FastingSession | null> => {
      const targetId =
        id ?? sessionsRef.current.find((s) => s.endedAt === null)?.id;
      if (!targetId) return null;

      const existing = sessionsRef.current.find((s) => s.id === targetId);
      if (!existing) return null;

      const endedAt = new Date();
      const completed = endedAt >= new Date(existing.targetEndAt);
      const timestamp = endedAt.toISOString();

      const updatedSession: FastingSession = {
        ...existing,
        endedAt: timestamp,
        completed,
        updatedAt: timestamp,
      };

      const updatedSessions = sessionsRef.current.map((s) =>
        s.id === targetId ? updatedSession : s,
      );
      sessionsRef.current = updatedSessions;

      if (isMountedRef.current) {
        setSessions(updatedSessions);
        setActiveSession(deriveActive(updatedSessions));
      }

      try {
        await fastingRepository.upsert(db, userId, updatedSession);
        await outboxRepository.enqueue(db, {
          id: `fasting_session:${updatedSession.id}`,
          entityType: "fasting_session",
          action: "upsert",
          entityId: updatedSession.id,
          data: {
            technique: updatedSession.technique,
            fasting_hours: updatedSession.fastingHours,
            started_at: updatedSession.startedAt,
            target_end_at: updatedSession.targetEndAt,
            ended_at: updatedSession.endedAt,
            completed: updatedSession.completed,
            created_at: updatedSession.createdAt,
          },
          updatedAt: updatedSession.updatedAt,
        });
        debouncedSync();
      } catch {
        // Storage failure -- state already updated optimistically
      }

      return updatedSession;
    },
    [db, userId],
  );

  const updateSession = useCallback(
    async (
      id: string,
      data: Partial<FastingSession>,
    ): Promise<FastingSession | null> => {
      const existing = sessionsRef.current.find((s) => s.id === id);
      if (!existing) return null;

      const timestamp = new Date().toISOString();

      // Recalculate targetEndAt if fastingHours or startedAt changed
      const newStartedAt = data.startedAt ?? existing.startedAt;
      const newFastingHours = data.fastingHours ?? existing.fastingHours;
      const needsRecalc =
        data.startedAt !== undefined || data.fastingHours !== undefined;
      const newTargetEndAt = needsRecalc
        ? new Date(
            new Date(newStartedAt).getTime() + newFastingHours * 3600000,
          ).toISOString()
        : (data.targetEndAt ?? existing.targetEndAt);

      const updatedSession: FastingSession = {
        ...existing,
        ...data,
        startedAt: newStartedAt,
        fastingHours: newFastingHours,
        targetEndAt: newTargetEndAt,
        updatedAt: timestamp,
      };

      const updatedSessions = sessionsRef.current.map((s) =>
        s.id === id ? updatedSession : s,
      );
      sessionsRef.current = updatedSessions;

      if (isMountedRef.current) {
        setSessions(updatedSessions);
        setActiveSession(deriveActive(updatedSessions));
      }

      try {
        await fastingRepository.upsert(db, userId, updatedSession);
        await outboxRepository.enqueue(db, {
          id: `fasting_session:${updatedSession.id}`,
          entityType: "fasting_session",
          action: "upsert",
          entityId: updatedSession.id,
          data: {
            technique: updatedSession.technique,
            fasting_hours: updatedSession.fastingHours,
            started_at: updatedSession.startedAt,
            target_end_at: updatedSession.targetEndAt,
            ended_at: updatedSession.endedAt,
            completed: updatedSession.completed,
            created_at: updatedSession.createdAt,
          },
          updatedAt: updatedSession.updatedAt,
        });
        debouncedSync();
      } catch {
        // Storage failure -- state already updated optimistically
      }

      return updatedSession;
    },
    [db, userId],
  );

  const deleteSession = useCallback(
    async (id: string): Promise<boolean> => {
      const exists = sessionsRef.current.some((s) => s.id === id);
      if (!exists) return false;

      sessionsRef.current = sessionsRef.current.filter((s) => s.id !== id);

      if (isMountedRef.current) {
        setSessions(sessionsRef.current);
        setActiveSession(deriveActive(sessionsRef.current));
      }

      try {
        await fastingRepository.markDeleted(db, id);
        await outboxRepository.enqueue(db, {
          id: `fasting_session:${id}`,
          entityType: "fasting_session",
          action: "delete",
          entityId: id,
          data: null,
          updatedAt: new Date().toISOString(),
        });
        debouncedSync();
      } catch {
        // Storage failure -- state already updated optimistically
      }

      return true;
    },
    [db, userId],
  );

  return {
    sessions,
    activeSession,
    loading,
    error,
    refresh,
    startSession,
    endSession,
    updateSession,
    deleteSession,
  };
};
