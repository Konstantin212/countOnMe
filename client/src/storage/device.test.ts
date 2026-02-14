import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOrCreateDeviceId,
  getDeviceToken,
  setDeviceToken,
  clearDeviceToken,
} from "./device";

// Mock AsyncStorage with an in-memory store
const storageStore = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => {
  return {
    default: {
      getItem: vi.fn(async (key: string) => storageStore.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        storageStore.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        storageStore.delete(key);
      }),
      clear: vi.fn(async () => {
        storageStore.clear();
      }),
    },
  };
});

// Mock uuid to generate predictable IDs for testing
vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid-12345"),
}));

describe("device storage", () => {
  beforeEach(() => {
    storageStore.clear();
    vi.clearAllMocks();
  });

  describe("getOrCreateDeviceId", () => {
    it("creates new UUID when device ID does not exist", async () => {
      const deviceId = await getOrCreateDeviceId();
      expect(deviceId).toBe("test-uuid-12345");
    });

    it("stores the created device ID in AsyncStorage", async () => {
      await getOrCreateDeviceId();
      const stored = storageStore.get("device:id");
      expect(stored).toBe("test-uuid-12345");
    });

    it("returns existing device ID on second call", async () => {
      const firstId = await getOrCreateDeviceId();
      const secondId = await getOrCreateDeviceId();
      expect(firstId).toBe(secondId);
      expect(firstId).toBe("test-uuid-12345");
    });

    it("does not generate new UUID when device ID exists", async () => {
      // Pre-populate storage with an existing device ID
      storageStore.set("device:id", "existing-device-id");

      const deviceId = await getOrCreateDeviceId();
      expect(deviceId).toBe("existing-device-id");
      expect(deviceId).not.toBe("test-uuid-12345");
    });

    it("calls uuid.v4 only once when creating new ID", async () => {
      const { v4 } = await import("uuid");
      await getOrCreateDeviceId();
      expect(v4).toHaveBeenCalledTimes(1);
    });

    it("does not call uuid.v4 when ID already exists", async () => {
      const { v4 } = await import("uuid");
      storageStore.set("device:id", "existing-device-id");

      await getOrCreateDeviceId();
      expect(v4).not.toHaveBeenCalled();
    });
  });

  describe("getDeviceToken", () => {
    it("returns null when no token is stored", async () => {
      const token = await getDeviceToken();
      expect(token).toBeNull();
    });

    it("returns stored token when it exists", async () => {
      storageStore.set("device:token", "my-device-token-abc123");
      const token = await getDeviceToken();
      expect(token).toBe("my-device-token-abc123");
    });

    it("returns different tokens after storage is updated", async () => {
      storageStore.set("device:token", "token-v1");
      const token1 = await getDeviceToken();
      expect(token1).toBe("token-v1");

      storageStore.set("device:token", "token-v2");
      const token2 = await getDeviceToken();
      expect(token2).toBe("token-v2");
    });
  });

  describe("setDeviceToken", () => {
    it("stores device token in AsyncStorage", async () => {
      await setDeviceToken("new-token-xyz");
      const stored = storageStore.get("device:token");
      expect(stored).toBe("new-token-xyz");
    });

    it("overwrites existing token", async () => {
      storageStore.set("device:token", "old-token");
      await setDeviceToken("new-token");

      const stored = storageStore.get("device:token");
      expect(stored).toBe("new-token");
      expect(stored).not.toBe("old-token");
    });

    it("allows empty string as token", async () => {
      await setDeviceToken("");
      const stored = storageStore.get("device:token");
      expect(stored).toBe("");
    });

    it("stores multiple different tokens sequentially", async () => {
      await setDeviceToken("token-1");
      expect(storageStore.get("device:token")).toBe("token-1");

      await setDeviceToken("token-2");
      expect(storageStore.get("device:token")).toBe("token-2");

      await setDeviceToken("token-3");
      expect(storageStore.get("device:token")).toBe("token-3");
    });
  });

  describe("clearDeviceToken", () => {
    it("removes device token from AsyncStorage", async () => {
      storageStore.set("device:token", "token-to-clear");
      await clearDeviceToken();

      const stored = storageStore.get("device:token");
      expect(stored).toBeUndefined();
    });

    it("does nothing when no token exists", async () => {
      await clearDeviceToken();
      const stored = storageStore.get("device:token");
      expect(stored).toBeUndefined();
    });

    it("only removes token, not device ID", async () => {
      storageStore.set("device:id", "my-device-id");
      storageStore.set("device:token", "my-token");

      await clearDeviceToken();

      expect(storageStore.get("device:token")).toBeUndefined();
      expect(storageStore.get("device:id")).toBe("my-device-id");
    });

    it("allows re-setting token after clear", async () => {
      await setDeviceToken("original-token");
      await clearDeviceToken();
      await setDeviceToken("new-token");

      const stored = storageStore.get("device:token");
      expect(stored).toBe("new-token");
    });
  });

  describe("integration workflow", () => {
    it("full device registration flow", async () => {
      // Step 1: Create device ID
      const deviceId = await getOrCreateDeviceId();
      expect(deviceId).toBe("test-uuid-12345");

      // Step 2: Verify no token exists yet
      const initialToken = await getDeviceToken();
      expect(initialToken).toBeNull();

      // Step 3: Store token after registration
      await setDeviceToken("registered-token-abc");
      const storedToken = await getDeviceToken();
      expect(storedToken).toBe("registered-token-abc");

      // Step 4: Device ID should remain the same
      const deviceIdAfter = await getOrCreateDeviceId();
      expect(deviceIdAfter).toBe(deviceId);
    });

    it("token refresh flow", async () => {
      // Initial setup
      await setDeviceToken("expired-token");
      expect(await getDeviceToken()).toBe("expired-token");

      // Clear expired token
      await clearDeviceToken();
      expect(await getDeviceToken()).toBeNull();

      // Get new token
      await setDeviceToken("refreshed-token");
      expect(await getDeviceToken()).toBe("refreshed-token");
    });

    it("handles concurrent getOrCreateDeviceId calls", async () => {
      // Multiple concurrent calls should return the same ID
      const [id1, id2, id3] = await Promise.all([
        getOrCreateDeviceId(),
        getOrCreateDeviceId(),
        getOrCreateDeviceId(),
      ]);

      expect(id1).toBe("test-uuid-12345");
      expect(id2).toBe("test-uuid-12345");
      expect(id3).toBe("test-uuid-12345");
    });
  });

  describe("edge cases", () => {
    it("handles very long token strings", async () => {
      const longToken = "a".repeat(1000);
      await setDeviceToken(longToken);
      const retrieved = await getDeviceToken();
      expect(retrieved).toBe(longToken);
    });

    it("handles token with special characters", async () => {
      const specialToken = "token-with-special!@#$%^&*()_+-=[]{}|;:,.<>?";
      await setDeviceToken(specialToken);
      const retrieved = await getDeviceToken();
      expect(retrieved).toBe(specialToken);
    });

    it("preserves device ID across token operations", async () => {
      const deviceId = await getOrCreateDeviceId();

      await setDeviceToken("token-1");
      expect(await getOrCreateDeviceId()).toBe(deviceId);

      await clearDeviceToken();
      expect(await getOrCreateDeviceId()).toBe(deviceId);

      await setDeviceToken("token-2");
      expect(await getOrCreateDeviceId()).toBe(deviceId);
    });
  });
});
