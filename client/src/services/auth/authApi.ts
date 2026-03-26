import { apiFetch } from "@services/api/http";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export type UserDeviceResponse = {
  id: string;
  device_id: string;
  device_name: string | null;
  linked_at: string;
  last_seen_at: string;
};

export type UserProfileResponse = {
  id: string;
  email: string | null;
  created_at: string;
  devices: UserDeviceResponse[];
};

export type ClaimDeviceDataResponse = {
  claimed_counts: Record<string, number>;
};

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const linkDevice = async (
  deviceId: string,
  deviceName?: string,
  legacyToken?: string,
): Promise<UserDeviceResponse> => {
  return apiFetch<UserDeviceResponse>("/v1/auth/link-device", {
    method: "POST",
    body: {
      device_id: deviceId,
      device_name: deviceName,
      legacy_device_token: legacyToken,
    },
  });
};

export const getProfile = async (): Promise<UserProfileResponse> => {
  return apiFetch<UserProfileResponse>("/v1/auth/me");
};

export const claimDeviceData = async (
  deviceId: string,
): Promise<ClaimDeviceDataResponse> => {
  return apiFetch<ClaimDeviceDataResponse>("/v1/auth/claim-device-data", {
    method: "POST",
    body: { device_id: deviceId },
  });
};

export const deleteAccount = async (): Promise<void> => {
  return apiFetch<void>("/v1/auth/account", { method: "DELETE" });
};
