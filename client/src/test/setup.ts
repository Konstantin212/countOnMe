import { vi } from "vitest";

/**
 * Global test setup file for Vitest.
 * Mocks common React Native modules to enable testing in jsdom environment.
 */

// Mock AsyncStorage globally
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
    multiGet: vi.fn(() => Promise.resolve([])),
    multiSet: vi.fn(() => Promise.resolve()),
    multiRemove: vi.fn(() => Promise.resolve()),
    getAllKeys: vi.fn(() => Promise.resolve([])),
  },
}));

// Mock NetInfo
vi.mock("@react-native-community/netinfo", () => ({
  default: {
    addEventListener: vi.fn(() => vi.fn()),
    fetch: vi.fn(() => Promise.resolve({ isConnected: true })),
  },
}));
