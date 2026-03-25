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

// Mock expo-secure-store
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(() => Promise.resolve(null)),
  setItemAsync: vi.fn(() => Promise.resolve()),
  deleteItemAsync: vi.fn(() => Promise.resolve()),
}));

// Mock expo-linking
vi.mock("expo-linking", () => ({
  createURL: vi.fn((path: string) => `countonme://${path}`),
  addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  getInitialURL: vi.fn(() => Promise.resolve(null)),
}));

// Mock expo-constants
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        apiUrl: "http://localhost:8000",
        supabaseUrl: "https://test.supabase.co",
        supabaseAnonKey: "test-anon-key",
      },
    },
  },
}));

// Mock @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => {
  const mockAuth = {
    getSession: vi.fn(() =>
      Promise.resolve({ data: { session: null }, error: null }),
    ),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    signInWithOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    verifyOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    refreshSession: vi.fn(() =>
      Promise.resolve({ data: { session: null }, error: null }),
    ),
    setSession: vi.fn(() =>
      Promise.resolve({ data: { session: null }, error: null }),
    ),
  };

  return {
    createClient: vi.fn(() => ({
      auth: mockAuth,
    })),
  };
});
