import { buildUrl } from "./config";
import { supabase } from "@services/supabase";
import { getOrCreateDeviceId } from "@storage/device";

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, opts?: { status?: number; details?: unknown }) {
    super(message);
    this.name = "ApiError";
    this.status = opts?.status;
    this.details = opts?.details;
  }
}

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
};

/**
 * Get the Supabase access token from the current session.
 * Throws if no session exists (user is not authenticated).
 */
const getAccessToken = async (): Promise<string> => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new ApiError("No active session", { status: 401 });
  }
  return session.access_token;
};

/**
 * Refresh the Supabase session and return the new access token.
 * Returns null if refresh fails.
 */
const refreshAccessToken = async (): Promise<string | null> => {
  const {
    data: { session },
    error,
  } = await supabase.auth.refreshSession();
  if (error || !session?.access_token) {
    return null;
  }
  return session.access_token;
};

const parseErrorDetails = async (res: Response): Promise<unknown> => {
  const text = await res.text().catch(() => "");
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const apiFetch = async <T>(
  path: string,
  { method = "GET", body, query }: ApiFetchOptions = {},
): Promise<T> => {
  const [token, deviceId] = await Promise.all([
    getAccessToken(),
    getOrCreateDeviceId(),
  ]);
  const url = buildUrl(path, query);

  const doFetch = async (bearer: string) => {
    return await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
        "X-Device-Id": deviceId,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let res = await doFetch(token);

  // 401 = token expired → refresh session and retry once.
  // 403 = actively forbidden → do NOT auto-refresh (force user awareness).
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch(refreshed);
    }
  }

  if (!res.ok) {
    const details = await parseErrorDetails(res);
    throw new ApiError(`Request failed (${res.status})`, {
      status: res.status,
      details,
    });
  }

  // 204 no content
  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
};
