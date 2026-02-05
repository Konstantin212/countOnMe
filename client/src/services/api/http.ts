import { buildUrl } from './config';
import { registerDevice } from './devices';
import { clearDeviceToken, getDeviceToken, getOrCreateDeviceId, setDeviceToken } from '@storage/device';

export class ApiError extends Error {
  status?: number;
  details?: unknown;

  constructor(message: string, opts?: { status?: number; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = opts?.status;
    this.details = opts?.details;
  }
}

type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
};

const ensureDeviceToken = async (): Promise<string> => {
  const existing = await getDeviceToken();
  if (existing) {
    return existing;
  }

  const deviceId = await getOrCreateDeviceId();
  const { device_token } = await registerDevice(deviceId);
  await setDeviceToken(device_token);
  return device_token;
};

const parseErrorDetails = async (res: Response): Promise<unknown> => {
  const text = await res.text().catch(() => '');
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
  { method = 'GET', body, query }: ApiFetchOptions = {},
): Promise<T> => {
  const token = await ensureDeviceToken();
  const url = buildUrl(path, query);

  const doFetch = async (bearer: string) => {
    return await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let res = await doFetch(token);

  // Token missing/expired → re-register and retry once.
  if (res.status === 401) {
    await clearDeviceToken();
    const refreshed = await ensureDeviceToken();
    res = await doFetch(refreshed);
  }

  if (!res.ok) {
    const details = await parseErrorDetails(res);
    throw new ApiError(`Request failed (${res.status})`, { status: res.status, details });
  }

  // 204 no content
  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
};

