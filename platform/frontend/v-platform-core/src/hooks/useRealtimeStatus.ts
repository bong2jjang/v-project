/**
 * useRealtimeStatus stub — app should provide actual implementation.
 */
export function useRealtimeStatus() {
  return {
    isConnected: false,
    bridgeRunning: false,
    providerStatuses: {} as Record<string, unknown>,
  };
}
