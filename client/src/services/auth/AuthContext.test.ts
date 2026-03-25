import { describe, expect, it } from "vitest";
import { extractTokensFromUrl } from "./AuthContext";

describe("extractTokensFromUrl", () => {
  it("extracts access_token and refresh_token from hash fragment", () => {
    const url =
      "countonme://auth/callback#access_token=abc123&refresh_token=def456&type=magiclink";
    const result = extractTokensFromUrl(url);
    expect(result).toEqual({
      accessToken: "abc123",
      refreshToken: "def456",
    });
  });

  it("returns null when URL has no hash fragment", () => {
    const url = "countonme://auth/callback?code=123";
    const result = extractTokensFromUrl(url);
    expect(result).toBeNull();
  });

  it("returns null when access_token is missing", () => {
    const url = "countonme://auth/callback#refresh_token=def456";
    const result = extractTokensFromUrl(url);
    expect(result).toBeNull();
  });

  it("returns null when refresh_token is missing", () => {
    const url = "countonme://auth/callback#access_token=abc123";
    const result = extractTokensFromUrl(url);
    expect(result).toBeNull();
  });

  it("returns null for empty hash fragment", () => {
    const url = "countonme://auth/callback#";
    const result = extractTokensFromUrl(url);
    expect(result).toBeNull();
  });

  it("handles tokens with special characters", () => {
    const url =
      "countonme://auth/callback#access_token=eyJhbGciOi.test.token&refresh_token=refresh-with-dashes&type=magiclink";
    const result = extractTokensFromUrl(url);
    expect(result).toEqual({
      accessToken: "eyJhbGciOi.test.token",
      refreshToken: "refresh-with-dashes",
    });
  });

  it("handles exp:// scheme URLs (Expo Go)", () => {
    const url =
      "exp://192.168.1.1:8081/--/auth/callback#access_token=abc&refresh_token=def";
    const result = extractTokensFromUrl(url);
    expect(result).toEqual({
      accessToken: "abc",
      refreshToken: "def",
    });
  });
});
