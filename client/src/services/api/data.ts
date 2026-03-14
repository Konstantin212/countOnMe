import { apiFetch } from "./http";

export const resetDeviceData = async (): Promise<void> => {
  await apiFetch<void>("/v1/data/reset", { method: "DELETE" });
};
