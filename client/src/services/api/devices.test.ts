import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerDevice } from "./devices";

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("./config", () => ({
  buildUrl: vi.fn((path: string) => `http://localhost:8000${path}`),
}));

describe("devices API wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends POST with device_id and returns parsed response", async () => {
    const mockResponse = {
      device_id: "device-123",
      device_token: "token-abc",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await registerDevice("device-123");

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/v1/devices/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: "device-123" }),
      },
    );
    expect(result).toEqual(mockResponse);
  });

  it("throws error when request fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Server error",
    });

    await expect(registerDevice("device-123")).rejects.toThrow(
      "Device register failed (500): Server error",
    );
  });

  it("handles error when response text fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => {
        throw new Error("Failed to read text");
      },
    });

    await expect(registerDevice("device-123")).rejects.toThrow(
      "Device register failed (500): Internal Server Error",
    );
  });
});
