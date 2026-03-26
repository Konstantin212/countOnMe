import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  linkDevice,
  getProfile,
  deleteAccount,
  claimDeviceData,
} from "./authApi";

// Mock apiFetch
vi.mock("@services/api/http", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@services/api/http");
const mockApiFetch = vi.mocked(apiFetch);

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("linkDevice", () => {
    it("calls POST /v1/auth/link-device with device info", async () => {
      const mockResponse = {
        id: "ud-1",
        device_id: "dev-123",
        device_name: "ios",
        linked_at: "2026-01-01T00:00:00Z",
        last_seen_at: "2026-01-01T00:00:00Z",
      };
      mockApiFetch.mockResolvedValue(mockResponse);

      const result = await linkDevice("dev-123", "ios", "legacy-tok");

      expect(mockApiFetch).toHaveBeenCalledWith("/v1/auth/link-device", {
        method: "POST",
        body: {
          device_id: "dev-123",
          device_name: "ios",
          legacy_device_token: "legacy-tok",
        },
      });
      expect(result).toEqual(mockResponse);
    });

    it("sends undefined for optional params when not provided", async () => {
      mockApiFetch.mockResolvedValue({});

      await linkDevice("dev-123");

      expect(mockApiFetch).toHaveBeenCalledWith("/v1/auth/link-device", {
        method: "POST",
        body: {
          device_id: "dev-123",
          device_name: undefined,
          legacy_device_token: undefined,
        },
      });
    });
  });

  describe("getProfile", () => {
    it("calls GET /v1/auth/me", async () => {
      const mockProfile = {
        id: "u-1",
        email: "test@example.com",
        created_at: "2026-01-01T00:00:00Z",
        devices: [],
      };
      mockApiFetch.mockResolvedValue(mockProfile);

      const result = await getProfile();

      expect(mockApiFetch).toHaveBeenCalledWith("/v1/auth/me");
      expect(result).toEqual(mockProfile);
    });
  });

  describe("deleteAccount", () => {
    it("calls DELETE /v1/auth/account", async () => {
      mockApiFetch.mockResolvedValue(undefined);

      await deleteAccount();

      expect(mockApiFetch).toHaveBeenCalledWith("/v1/auth/account", {
        method: "DELETE",
      });
    });
  });

  describe("claimDeviceData", () => {
    it("calls POST /v1/auth/claim-device-data with device_id", async () => {
      const mockResponse = {
        claimed_counts: { products: 5, meals: 3 },
      };
      mockApiFetch.mockResolvedValue(mockResponse);

      const result = await claimDeviceData("dev-123");

      expect(mockApiFetch).toHaveBeenCalledWith("/v1/auth/claim-device-data", {
        method: "POST",
        body: { device_id: "dev-123" },
      });
      expect(result).toEqual(mockResponse);
    });

    it("propagates API errors", async () => {
      mockApiFetch.mockRejectedValue(new Error("Network error"));

      await expect(claimDeviceData("dev-123")).rejects.toThrow("Network error");
    });
  });
});
