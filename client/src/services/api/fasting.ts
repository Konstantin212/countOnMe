import type { FastingSession } from "@models/types";
import { ApiError, apiFetch } from "./http";

type FastingSessionApiResponse = {
  id: string;
  technique: string;
  fasting_hours: number;
  started_at: string;
  target_end_at: string;
  ended_at: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

const mapApiResponseToSession = (
  response: FastingSessionApiResponse,
): FastingSession => ({
  id: response.id,
  technique: response.technique as FastingSession["technique"],
  fastingHours: response.fasting_hours,
  startedAt: response.started_at,
  targetEndAt: response.target_end_at,
  endedAt: response.ended_at,
  completed: response.completed,
  createdAt: response.created_at,
  updatedAt: response.updated_at,
});

export const startFastingSession = async (
  technique: string,
  fastingHours: number,
  startedAt: string,
): Promise<FastingSession> => {
  const response = await apiFetch<FastingSessionApiResponse>(
    "/v1/fasting-sessions",
    {
      method: "POST",
      body: {
        technique,
        fasting_hours: fastingHours,
        started_at: startedAt,
      },
    },
  );

  return mapApiResponseToSession(response);
};

export const endFastingSession = async (
  id: string,
  endedAt: string,
): Promise<FastingSession> => {
  const response = await apiFetch<FastingSessionApiResponse>(
    `/v1/fasting-sessions/${id}/end`,
    {
      method: "POST",
      body: {
        ended_at: endedAt,
      },
    },
  );

  return mapApiResponseToSession(response);
};

export const updateFastingSession = async (
  id: string,
  data: Partial<{
    started_at: string;
    target_end_at: string;
    ended_at: string;
    technique: string;
    fasting_hours: number;
  }>,
): Promise<FastingSession> => {
  const response = await apiFetch<FastingSessionApiResponse>(
    `/v1/fasting-sessions/${id}`,
    {
      method: "PATCH",
      body: data,
    },
  );

  return mapApiResponseToSession(response);
};

export const listFastingSessions = async (): Promise<FastingSession[]> => {
  const responses = await apiFetch<FastingSessionApiResponse[]>(
    "/v1/fasting-sessions",
  );

  return responses.map(mapApiResponseToSession);
};

export const getActiveFastingSession =
  async (): Promise<FastingSession | null> => {
    try {
      const response = await apiFetch<FastingSessionApiResponse>(
        "/v1/fasting-sessions/active",
      );
      return mapApiResponseToSession(response);
    } catch (error: unknown) {
      // Only treat 404 as "no active session"
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  };

export const deleteFastingSession = async (id: string): Promise<void> => {
  await apiFetch<void>(`/v1/fasting-sessions/${id}`, {
    method: "DELETE",
  });
};
