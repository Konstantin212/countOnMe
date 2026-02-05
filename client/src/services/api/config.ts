export const getApiBaseUrl = (): string => {
  // Expo convention: EXPO_PUBLIC_* is bundled at build time.
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  return (fromEnv && fromEnv.trim().length ? fromEnv.trim() : 'http://localhost:8000').replace(
    /\/$/,
    '',
  );
};

export const buildUrl = (path: string, query?: Record<string, string | number | boolean | undefined>) => {
  const base = getApiBaseUrl();
  const url = new URL(path.startsWith('/') ? `${base}${path}` : `${base}/${path}`);

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

