export const isDev = (): boolean =>
  !process.env.EXPO_PUBLIC_ENV || process.env.EXPO_PUBLIC_ENV === "local";

export const getApiBaseUrl = (): string => {
  // Expo convention: EXPO_PUBLIC_* is bundled at build time.
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const url = (
    fromEnv && fromEnv.trim().length ? fromEnv.trim() : "http://localhost:8000"
  ).replace(/\/$/, "");

  // Require HTTPS in non-development environments
  if (!isDev() && !url.startsWith("https://")) {
    throw new Error(
      "API URL must use HTTPS in production. Set EXPO_PUBLIC_API_URL to an https:// URL.",
    );
  }

  return url;
};

export const buildUrl = (
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
) => {
  const base = getApiBaseUrl();
  const url = new URL(
    path.startsWith("/") ? `${base}${path}` : `${base}/${path}`,
  );

  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) {
        continue;
      }
      url.searchParams.set(k, String(v));
    }
  }

  return url.toString();
};
