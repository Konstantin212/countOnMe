import { BodyWeightEntry } from "@models/types";
import { apiFetch } from "./http";
import { parseNumeric } from "@services/utils/parsing";

type BodyWeightApiResponse = {
  id: string;
  day: string;
  weight_kg: string | number; // Decimal from backend
  created_at: string;
  updated_at: string;
};

const mapApiResponseToEntry = (
  response: BodyWeightApiResponse,
): BodyWeightEntry => {
  const weightKg = parseNumeric(response.weight_kg);
  if (weightKg === undefined) {
    throw new Error(`Invalid weight_kg value: ${response.weight_kg}`);
  }

  return {
    id: response.id,
    day: response.day,
    weightKg,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
  };
};

export const listBodyWeights = async (
  from?: string,
  to?: string,
): Promise<BodyWeightEntry[]> => {
  const query: Record<string, string> = {};
  if (from) {
    query.from = from;
  }
  if (to) {
    query.to = to;
  }

  const responses = await apiFetch<BodyWeightApiResponse[]>(
    "/v1/body-weights",
    { query },
  );

  return responses.map(mapApiResponseToEntry);
};

export const createBodyWeight = async (
  day: string,
  weightKg: number,
): Promise<BodyWeightEntry> => {
  const response = await apiFetch<BodyWeightApiResponse>("/v1/body-weights", {
    method: "POST",
    body: {
      day,
      weight_kg: weightKg,
    },
  });

  return mapApiResponseToEntry(response);
};

export const updateBodyWeight = async (
  id: string,
  weightKg: number,
): Promise<BodyWeightEntry> => {
  const response = await apiFetch<BodyWeightApiResponse>(
    `/v1/body-weights/${id}`,
    {
      method: "PATCH",
      body: {
        weight_kg: weightKg,
      },
    },
  );

  return mapApiResponseToEntry(response);
};

export const deleteBodyWeight = async (id: string): Promise<void> => {
  await apiFetch<void>(`/v1/body-weights/${id}`, {
    method: "DELETE",
  });
};
