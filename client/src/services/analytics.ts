// Lightweight analytics stub — logs in __DEV__, no-op in production
// Ready to be swapped for a real analytics SDK later

type AnalyticsEvent =
  | "scanner_opened"
  | "permission_denied"
  | "barcode_scanned"
  | "lookup_succeeded"
  | "lookup_not_found"
  | "lookup_failed"
  | "user_continued_via_manual_fallback";

export const logEvent = (
  event: AnalyticsEvent,
  params?: Record<string, unknown>,
): void => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[Analytics] ${event}`, params ?? "");
  }
  // Real analytics SDK call goes here
};
