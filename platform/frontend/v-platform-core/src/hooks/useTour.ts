/**
 * useTour — TourContext 소비 훅
 *
 * 앱의 TourProvider가 TourContextProvider로 실제 구현을 주입하면
 * 플랫폼 컴포넌트(Help, HelpButton, Layout, UserMenu)가 동작합니다.
 * 주입되지 않으면 no-op 기본값이 사용됩니다.
 */
export { useTourContext as useTour } from "../contexts/TourContext";
