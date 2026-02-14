import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "./http";

// Mock storage device functions
vi.mock("@storage/device", () => ({
  getDeviceToken: vi.fn(),
  setDeviceToken: vi.fn(),
  clearDeviceToken: vi.fn(),
  getOrCreateDeviceId: vi.fn(),
}));

// Mock registerDevice function
vi.mock("./devices", () => ({
  registerDevice: vi.fn(),
}));

// Import mocked functions after vi.mock calls
const {
  getDeviceToken: mockGetDeviceToken,
  setDeviceToken: mockSetDeviceToken,
  clearDeviceToken: mockClearDeviceToken,
  getOrCreateDeviceId: mockGetOrCreateDeviceId,
} = await import("@storage/device");

const { registerDevice: mockRegisterDevice } = await import("./devices");

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("http utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDeviceToken.mockReset();
    mockSetDeviceToken.mockReset();
    mockClearDeviceToken.mockReset();
    mockGetOrCreateDeviceId.mockReset();
    mockRegisterDevice.mockReset();
    mockFetch.mockReset();
  });

  describe("ApiError", () => {
    it("creates error with message", () => {
      const error = new ApiError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.name).toBe("ApiError");
      expect(error.status).toBeUndefined();
      expect(error.details).toBeUndefined();
    });

    it("creates error with status and details", () => {
      const error = new ApiError("Test error", {
        status: 404,
        details: { reason: "Not found" },
      });
      expect(error.message).toBe("Test error");
      expect(error.status).toBe(404);
      expect(error.details).toEqual({ reason: "Not found" });
    });

    it("is an instance of Error", () => {
      const error = new ApiError("Test error");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("apiFetch - token management", () => {
    it("uses cached token when available", async () => {
      mockGetDeviceToken.mockResolvedValue("cached-token");
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: "success" }),
      });

      const result = await apiFetch("/test");

      expect(mockGetDeviceToken).toHaveBeenCalledTimes(1);
      expect(mockRegisterDevice).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer cached-token",
          }),
        }),
      );
      expect(result).toEqual({ data: "success" });
    });

    it("registers device when no token exists", async () => {
      mockGetDeviceToken.mockResolvedValue(null);
      mockGetOrCreateDeviceId.mockResolvedValue("device-id-123");
      mockRegisterDevice.mockResolvedValue({
        device_id: "device-id-123",
        device_token: "new-token",
      });
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: "success" }),
      });

      await apiFetch("/test");

      expect(mockGetDeviceToken).toHaveBeenCalledTimes(1);
      expect(mockClearDeviceToken).toHaveBeenCalledTimes(1);
      expect(mockGetOrCreateDeviceId).toHaveBeenCalledTimes(1);
      expect(mockRegisterDevice).toHaveBeenCalledWith("device-id-123");
      expect(mockSetDeviceToken).toHaveBeenCalledWith("new-token");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer new-token",
          }),
        }),
      );
    });
  });

  describe("apiFetch - 401 retry logic", () => {
    it("retries with new token on 401 response", async () => {
      mockGetDeviceToken.mockResolvedValue("expired-token");
      mockGetOrCreateDeviceId.mockResolvedValue("device-id-123");
      mockRegisterDevice.mockResolvedValue({
        device_id: "device-id-123",
        device_token: "refreshed-token",
      });

      // First call returns 401, second call succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: "success after retry" }),
        });

      const result = await apiFetch("/test");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockClearDeviceToken).toHaveBeenCalledTimes(1);
      expect(mockRegisterDevice).toHaveBeenCalledWith("device-id-123");
      expect(mockSetDeviceToken).toHaveBeenCalledWith("refreshed-token");
      expect(result).toEqual({ data: "success after retry" });
    });

    it("does not retry on 403 forbidden", async () => {
      mockGetDeviceToken.mockResolvedValue("valid-token");
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: "Forbidden" }),
      });

      await expect(apiFetch("/test")).rejects.toThrow("Request failed (403)");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockRegisterDevice).not.toHaveBeenCalled();
    });

    it("throws error if retry also fails", async () => {
      mockGetDeviceToken.mockResolvedValue("expired-token");
      mockGetOrCreateDeviceId.mockResolvedValue("device-id-123");
      mockRegisterDevice.mockResolvedValue({
        device_id: "device-id-123",
        device_token: "refreshed-token",
      });

      // Both calls return 401
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "Unauthorized" }),
      });

      await expect(apiFetch("/test")).rejects.toThrow("Request failed (401)");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("apiFetch - concurrent registration", () => {
    it("shares same registration promise for concurrent calls", async () => {
      mockGetDeviceToken.mockResolvedValue(null);
      mockGetOrCreateDeviceId.mockResolvedValue("device-id-123");

      let registerCallCount = 0;
      mockRegisterDevice.mockImplementation(async () => {
        registerCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          device_id: "device-id-123",
          device_token: "new-token",
        };
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: "success" }),
      });

      // Make 3 concurrent calls
      await Promise.all([
        apiFetch("/test1"),
        apiFetch("/test2"),
        apiFetch("/test3"),
      ]);

      // Should only register once despite 3 concurrent calls
      expect(registerCallCount).toBe(1);
      expect(mockSetDeviceToken).toHaveBeenCalledTimes(1);
    });
  });

  describe("apiFetch - HTTP methods", () => {
    beforeEach(() => {
      mockGetDeviceToken.mockResolvedValue("test-token");
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: "success" }),
      });
    });

    it("sends GET request by default", async () => {
      await apiFetch("/test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "GET",
        }),
      );
    });

    it("sends POST request with body", async () => {
      await apiFetch("/test", {
        method: "POST",
        body: { name: "Test Product" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "Test Product" }),
        }),
      );
    });

    it("sends PATCH request", async () => {
      await apiFetch("/test", {
        method: "PATCH",
        body: { calories: 100 },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "PATCH",
        }),
      );
    });

    it("sends DELETE request", async () => {
      await apiFetch("/test", { method: "DELETE" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });
  });

  describe("apiFetch - request headers", () => {
    beforeEach(() => {
      mockGetDeviceToken.mockResolvedValue("test-token");
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: "success" }),
      });
    });

    it("sets correct headers", async () => {
      await apiFetch("/test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
          },
        }),
      );
    });

    it("includes Authorization header with Bearer token", async () => {
      mockGetDeviceToken.mockResolvedValue("my-special-token");
      await apiFetch("/test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer my-special-token",
          }),
        }),
      );
    });
  });

  describe("apiFetch - response handling", () => {
    beforeEach(() => {
      mockGetDeviceToken.mockResolvedValue("test-token");
    });

    it("returns parsed JSON on success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "123", name: "Test" }),
      });

      const result = await apiFetch<{ id: string; name: string }>("/test");

      expect(result).toEqual({ id: "123", name: "Test" });
    });

    it("returns undefined for 204 No Content", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
      });

      const result = await apiFetch("/test");

      expect(result).toBeUndefined();
    });

    it("throws ApiError on non-OK response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ error: "Not found" }),
      });

      await expect(apiFetch("/test")).rejects.toThrow(ApiError);
    });

    it("includes error details in ApiError", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({ error: "Invalid input", field: "name" }),
      });

      try {
        await apiFetch("/test");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        if (error instanceof ApiError) {
          expect(error.status).toBe(400);
          expect(error.details).toEqual({
            error: "Invalid input",
            field: "name",
          });
        }
      }
    });

    it("handles empty error response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "",
      });

      try {
        await apiFetch("/test");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        if (error instanceof ApiError) {
          expect(error.status).toBe(500);
          expect(error.details).toBeUndefined();
        }
      }
    });

    it("handles non-JSON error response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      try {
        await apiFetch("/test");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        if (error instanceof ApiError) {
          expect(error.status).toBe(500);
          expect(error.details).toBe("Internal Server Error");
        }
      }
    });
  });

  describe("apiFetch - edge cases", () => {
    beforeEach(() => {
      mockGetDeviceToken.mockResolvedValue("test-token");
    });

    it("handles request without body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: "success" }),
      });

      await apiFetch("/test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: undefined,
        }),
      );
    });

    it("serializes complex body objects", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: "success" }),
      });

      const complexBody = {
        name: "Product",
        nested: { calories: 100, nutrients: [1, 2, 3] },
        array: ["a", "b"],
      };

      await apiFetch("/test", { method: "POST", body: complexBody });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(complexBody),
        }),
      );
    });

    it("handles fetch network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(apiFetch("/test")).rejects.toThrow("Network error");
    });

    it("handles JSON parsing error in error response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => {
          throw new Error("Failed to read response");
        },
      });

      try {
        await apiFetch("/test");
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        if (error instanceof ApiError) {
          expect(error.status).toBe(500);
          expect(error.details).toBeUndefined();
        }
      }
    });
  });

  describe("apiFetch - integration scenarios", () => {
    it("handles first-time registration flow", async () => {
      mockGetDeviceToken.mockResolvedValue(null);
      mockGetOrCreateDeviceId.mockResolvedValue("new-device-id");
      mockRegisterDevice.mockResolvedValue({
        device_id: "new-device-id",
        device_token: "fresh-token",
      });
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ products: [] }),
      });

      const result = await apiFetch("/products");

      expect(mockClearDeviceToken).toHaveBeenCalled();
      expect(mockRegisterDevice).toHaveBeenCalledWith("new-device-id");
      expect(mockSetDeviceToken).toHaveBeenCalledWith("fresh-token");
      expect(result).toEqual({ products: [] });
    });

    it("handles token expiration and refresh", async () => {
      mockGetDeviceToken.mockResolvedValue("expired-token");
      mockGetOrCreateDeviceId.mockResolvedValue("existing-device-id");
      mockRegisterDevice.mockResolvedValue({
        device_id: "existing-device-id",
        device_token: "new-fresh-token",
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: "success with new token" }),
        });

      const result = await apiFetch("/protected-resource");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockClearDeviceToken).toHaveBeenCalled();
      expect(mockSetDeviceToken).toHaveBeenCalledWith("new-fresh-token");
      expect(result).toEqual({ data: "success with new token" });
    });
  });
});
