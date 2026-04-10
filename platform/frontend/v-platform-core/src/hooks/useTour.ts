/**
 * useTour stub — app should provide actual implementation.
 * Platform provides a no-op fallback.
 */
export function useTour() {
  return {
    startMainTour: () => {},
    startPageTour: (_page: string) => {},
    isRunning: false,
  };
}
