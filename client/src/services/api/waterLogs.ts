import type { WaterLog } from "@models/types";

import { apiFetch } from "./http";

type WaterLogApiResponse = {
  id: string;
  day: string;
  amount_ml: number;
  created_at: string;
  updated_at: string;
};

const mapApiResponseToWaterLog = (response: WaterLogApiResponse): WaterLog => ({
  id: response.id,
  day: response.day,
  amountMl: response.amount_ml,
  createdAt: response.created_at,
  updatedAt: response.updated_at,
});

export const listWaterLogs = async (
  from?: string,
  to?: string,
): Promise<WaterLog[]> => {
  const query: Record<string, string> = {};
  if (from) {
    query.from = from;
  }
  if (to) {
    query.to = to;
  }

  const responses = await apiFetch<WaterLogApiResponse[]>("/v1/water-logs", {
    query,
  });

  return responses.map(mapApiResponseToWaterLog);
};

export const createWaterLog = async (
  day: string,
  amountMl: number,
): Promise<WaterLog> => {
  const response = await apiFetch<WaterLogApiResponse>("/v1/water-logs", {
    method: "POST",
    body: { day, amount_ml: amountMl },
  });

  return mapApiResponseToWaterLog(response);
};

export const updateWaterLog = async (
  id: string,
  amountMl: number,
): Promise<WaterLog> => {
  const response = await apiFetch<WaterLogApiResponse>(`/v1/water-logs/${id}`, {
    method: "PATCH",
    body: { amount_ml: amountMl },
  });

  return mapApiResponseToWaterLog(response);
};

export const deleteWaterLog = async (id: string): Promise<void> => {
  await apiFetch<void>(`/v1/water-logs/${id}`, {
    method: "DELETE",
  });
};
