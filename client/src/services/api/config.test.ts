import { beforeEach, describe, expect, it } from "vitest";

import { buildUrl, getApiBaseUrl, isDev } from "./config";

describe("config utilities", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isDev", () => {
    it("returns true when EXPO_PUBLIC_ENV is not set", () => {
      delete process.env.EXPO_PUBLIC_ENV;
      expect(isDev()).toBe(true);
    });

    it('returns true when EXPO_PUBLIC_ENV is "local"', () => {
      process.env.EXPO_PUBLIC_ENV = "local";
      expect(isDev()).toBe(true);
    });

    it('returns false when EXPO_PUBLIC_ENV is not "local"', () => {
      process.env.EXPO_PUBLIC_ENV = "production";
      expect(isDev()).toBe(false);
    });
  });

  describe("getApiBaseUrl", () => {
    it("returns default URL when EXPO_PUBLIC_API_URL is not set", () => {
      delete process.env.EXPO_PUBLIC_API_URL;
      delete process.env.EXPO_PUBLIC_ENV;
      expect(getApiBaseUrl()).toBe("http://localhost:8000");
    });

    it("returns URL from env variable when set", () => {
      process.env.EXPO_PUBLIC_API_URL = "https://api.example.com";
      expect(getApiBaseUrl()).toBe("https://api.example.com");
    });

    it("strips trailing slashes from URL", () => {
      process.env.EXPO_PUBLIC_API_URL = "https://api.example.com/";
      expect(getApiBaseUrl()).toBe("https://api.example.com");
    });

    it("throws error when non-https URL is used in production", () => {
      process.env.EXPO_PUBLIC_ENV = "production";
      process.env.EXPO_PUBLIC_API_URL = "http://api.example.com";
      expect(() => getApiBaseUrl()).toThrow(
        "API URL must use HTTPS in production. Set EXPO_PUBLIC_API_URL to an https:// URL.",
      );
    });

    it("allows http URL in development", () => {
      delete process.env.EXPO_PUBLIC_ENV;
      process.env.EXPO_PUBLIC_API_URL = "http://localhost:8000";
      expect(getApiBaseUrl()).toBe("http://localhost:8000");
    });
  });

  describe("buildUrl", () => {
    beforeEach(() => {
      delete process.env.EXPO_PUBLIC_ENV;
      process.env.EXPO_PUBLIC_API_URL = "http://localhost:8000";
    });

    it("builds URL with leading slash path", () => {
      expect(buildUrl("/v1/products")).toBe(
        "http://localhost:8000/v1/products",
      );
    });

    it("builds URL with path without leading slash", () => {
      expect(buildUrl("v1/products")).toBe("http://localhost:8000/v1/products");
    });

    it("builds URL with query parameters", () => {
      const url = buildUrl("/v1/products", { search: "chicken", limit: 10 });
      expect(url).toBe(
        "http://localhost:8000/v1/products?search=chicken&limit=10",
      );
    });

    it("skips undefined query parameters", () => {
      const url = buildUrl("/v1/products", {
        search: "chicken",
        limit: undefined,
      });
      expect(url).toBe("http://localhost:8000/v1/products?search=chicken");
    });

    it("converts boolean and number query parameters to strings", () => {
      const url = buildUrl("/v1/products", { active: true, page: 2 });
      expect(url).toBe("http://localhost:8000/v1/products?active=true&page=2");
    });
  });
});
