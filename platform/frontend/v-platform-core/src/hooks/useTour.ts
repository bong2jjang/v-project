/**
 * useTour — Platform default (no-op)
 *
 * Apps can override by providing their own useTour implementation
 * via the app's hooks directory. The platform components (HelpButton,
 * UserMenu, KeyboardShortcuts) call this hook, which is a no-op
 * unless the app provides a real tour implementation.
 */
export function useTour() {
  return {
    startMainTour: () => {},
    startPageTour: (_page: string) => {},
    resetAllTours: () => {},
    isRunning: false,
  };
}
