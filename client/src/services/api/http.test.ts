import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "./http";

// Use vi.hoisted so mock fns are available inside the hoisted vi.mock factory
const { mockGetSession, mockRefreshSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRefreshSession: vi.fn(),
}));

vi.mock("@services/supabase", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("http utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockReset();
    mockRefreshSession.mockReset();
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

  describe("apiFetch - Supabase token management", () => {
    it("uses session access token when available", async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: { access_token: "supabase-jwt-token", user: { id: "u1" } },
        },
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: "success" }),
      });

      const result = await apiFetch("/test");

      expect(mockGetSession).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer supabase-jwt-token",
          }),
        }),
      );
      expect(result).toEqual({ data: "success" });
    });

    it("throws when no session exists", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(apiFetch("/test")).rejects.toThrow("No active session");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("throws when getSession returns an error", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Session expired" },
      });

      await expect(apiFetch("/test")).rejects.toThrow("No active session");
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("apiFetch - 401 retry logic", () => {
    it("retries with refreshed token on 401 response", async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: { access_token: "expired-token", user: { id: "u1" } },
        },
        error: null,
      });
      mockRefreshSession.mockResolvedValue({
        data: {
          session: { access_token: "refreshed-token", user: { id: "u1" } },
        },
        error: null,
      });

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
      expect(mockRefreshSession).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer refreshed-token",
          }),
        }),
      );
      expect(result).toEqual({ data: "success after retry" });
    });

    it("does not retry on 403 forbidden", async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: { access_token: "valid-token", user: { id: "u1" } },
        },
        error: null,
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: "Forbidden" }),
      });

      await expect(apiFetch("/test")).rejects.toThrow("Request failed (403)");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockRefreshSession).not.toHaveBeenCalled();
    });

    it("throws error if refresh fails on 401", async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: { access_token: "expired-token", user: { id: "u1" } },
        },
        error: null,
      });
      mockRefreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Refresh failed" },
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "Unauthorized" }),
      });

      await expect(apiFetch("/test")).rejects.toThrow("Request failed (401)");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    });

    it("throws error if retry also fails with 401", async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: { access_token: "expired-token", user: { id: "u1" } },
        },
        error: null,
      });
      mockRefreshSession.mockResolvedValue({
        data: {
          session: { access_token: "still-bad-token", user: { id: "u1" } },
        },
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "Unauthorized" }),
      });

      await expect(apiFetch("/test")).rejects.toThrow("Request failed (401)");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("apiFetch - HTTP methods", () => {
    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        data: {
          session: { access_token: "test-token", user: { id: "u1" } },
        },
        error: null,
      });
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
      mockGetSession.mockResolvedValue({
        data: {
          session: { access_token: "test-token", user: { id: "u1" } },
        },
        error: null,
      });
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
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: "my-special-token",
            user: { id: "u1" },
          },
        },
        error: null,
      });
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
      mockGetSession.mockResolvedValue({
        data: {
          session: { access_token: "test-token", user: { id: "u1" } },
        },
        error: null,
      });
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
      mockGetSession.mockResolvedValue({
        data: {
          session: { access_token: "test-token", user: { id: "u1" } },
        },
        error: null,
      });
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
});
