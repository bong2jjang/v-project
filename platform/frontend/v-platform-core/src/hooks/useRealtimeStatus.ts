/**
 * useRealtimeStatus — Platform default (no-op)
 *
 * Apps override this by placing their own useRealtimeStatus.ts
 * in the app's hooks directory, which is resolved first via the
 * app-side shim re-export.
 *
 * This file is the fallback when no app override exists.
 */
export function useRealtimeStatus() {
  return {
    isConnected: false,
    bridgeRunning: false,
    providerStatuses: {} as Record<string, unknown>,
  };
}
