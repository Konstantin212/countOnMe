import { BodyWeightEntry } from "@models/types";
import { apiFetch } from "./http";

type BodyWeightApiResponse = {
  id: string;
  day: string;
  weight_kg: string;
  created_at: string;
  updated_at: string;
};

const mapApiResponseToEntry = (
  response: BodyWeightApiResponse,
): BodyWeightEntry => {
  return {
    id: response.id,
    day: response.day,
    weightKg: parseFloat(response.weight_kg),
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
