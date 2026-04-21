/**
 * useTheme Hook & ThemeContext
 *
 * 테마 관리: 다크모드 + 브랜드 색상 프리셋
 * - 로그인 사용자: DB에 저장 (PUT /api/users/me)
 * - 비로그인: localStorage 폴백
 * - 시스템 설정 감지 (prefers-color-scheme)
 * - <html> 클래스 토글
 * - React Context로 전역 상태 관리
 */

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  ReactNode,
  createElement,
} from "react";
import { useAuthStore } from "../stores/auth";
import { usePlatformConfig } from "../providers/PlatformProvider";

/** 앱별 localStorage 키 생성 (동일 브라우저에서 앱별 테마 분리) */
function themeKey(appName?: string) { return appName ? `${appName}:theme` : "theme"; }
function presetKey(appName?: string) { return appName ? `${appName}:colorPreset` : "colorPreset"; }
function contentWidthKey(appName?: string) { return appName ? `${appName}:contentWidth` : "contentWidth"; }
function pullToRefreshKey(appName?: string) { return appName ? `${appName}:pullToRefresh` : "pullToRefresh"; }
function wideViewToggleKey(appName?: string) { return appName ? `${appName}:showWideViewToggle` : "showWideViewToggle"; }

type Theme = "light" | "dark" | "system";
export type ColorPreset = "blue" | "indigo" | "rose";
export type ContentWidth = "default" | "wide";

export const COLOR_PRESETS: {
  id: ColorPreset;
  label: string;
  color: string;
}[] = [
  { id: "blue", label: "Blue", color: "#0078d4" },
  { id: "indigo", label: "Indigo", color: "#4f46e5" },
  { id: "rose", label: "Rose", color: "#e11d48" },
];

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  colorPreset: ColorPreset;
  setColorPreset: (preset: ColorPreset) => void;
  contentWidth: ContentWidth;
  setContentWidth: (width: ContentWidth) => void;
  pullToRefresh: boolean;
  setPullToRefresh: (enabled: boolean) => void;
  showWideViewToggle: boolean;
  setShowWideViewToggle: (visible: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isValidTheme(v: string | null | undefined): v is Theme {
  return v === "light" || v === "dark" || v === "system";
}

function isValidPreset(v: string | null | undefined): v is ColorPreset {
  return v === "blue" || v === "indigo" || v === "rose";
}

function getEffectiveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

function applyTheme(effective: "light" | "dark") {
  document.documentElement.classList.toggle("dark", effective === "dark");
}

function isValidContentWidth(v: string | null | undefined): v is ContentWidth {
  return v === "default" || v === "wide";
}

function applyContentWidth(width: ContentWidth) {
  document.documentElement.classList.toggle("layout-wide", width === "wide");
}

function resolveInitialContentWidth(appName?: string): ContentWidth {
  const stored = localStorage.getItem(contentWidthKey(appName));
  if (isValidContentWidth(stored)) return stored;
  return "default";
}

/** no-pull-refresh 전역 CSS를 1회 주입 (각 앱 index.css 복제 방지) */
function ensurePullToRefreshStyle() {
  if (typeof document === "undefined") return;
  const STYLE_ID = "platform-no-pull-refresh-style";
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent =
    "html.no-pull-refresh, html.no-pull-refresh body { overscroll-behavior-y: contain; }";
  document.head.appendChild(style);
}

function applyPullToRefresh(enabled: boolean) {
  // 끄면 당겨서 새로고침 및 overscroll chaining 억제 (모바일 스크롤 UX 개선)
  ensurePullToRefreshStyle();
  document.documentElement.classList.toggle("no-pull-refresh", !enabled);
}

function resolveInitialPullToRefresh(appName?: string): boolean {
  const stored = localStorage.getItem(pullToRefreshKey(appName));
  if (stored === "true") return true;
  if (stored === "false") return false;
  return true; // 기본값: 활성
}

function resolveInitialShowWideViewToggle(appName?: string): boolean {
  const stored = localStorage.getItem(wideViewToggleKey(appName));
  if (stored === "true") return true;
  if (stored === "false") return false;
  return true; // 기본값: 표시 (하위호환)
}

function applyColorPreset(preset: ColorPreset) {
  const root = document.documentElement;
  // 이전 프리셋 클래스 제거
  root.classList.remove("theme-indigo", "theme-rose");
  // blue는 기본값이라 클래스 불필요
  if (preset !== "blue") {
    root.classList.add(`theme-${preset}`);
  }
}

/** 초기 테마 값 결정: 앱별 localStorage > 사용자 DB 값 > 기본값 */
function resolveInitialTheme(userTheme?: string | null, appName?: string): Theme {
  // 앱별 localStorage 우선 (앱별 분리)
  const stored = localStorage.getItem(themeKey(appName));
  if (isValidTheme(stored)) return stored;
  // DB 값 fallback (최초 설정 전)
  if (isValidTheme(userTheme)) return userTheme;
  return "system";
}

function resolveInitialPreset(userPreset?: string | null, appName?: string): ColorPreset {
  const stored = localStorage.getItem(presetKey(appName));
  if (isValidPreset(stored)) return stored;
  if (isValidPreset(userPreset)) return userPreset;
  return "blue";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { appName } = usePlatformConfig();

  const [theme, setThemeState] = useState<Theme>(() =>
    resolveInitialTheme(user?.theme, appName),
  );

  const [colorPreset, setColorPresetState] = useState<ColorPreset>(() =>
    resolveInitialPreset(user?.color_preset, appName),
  );

  const [contentWidth, setContentWidthState] = useState<ContentWidth>(() =>
    resolveInitialContentWidth(appName),
  );

  const [pullToRefresh, setPullToRefreshState] = useState<boolean>(() =>
    resolveInitialPullToRefresh(appName),
  );

  const [showWideViewToggle, setShowWideViewToggleState] = useState<boolean>(
    () => resolveInitialShowWideViewToggle(appName),
  );

  const [isDark, setIsDark] = useState(
    () => getEffectiveTheme(theme) === "dark",
  );

  // 테마는 앱별 localStorage에만 저장 (DB 저장 안 함)
  // 이유: users.theme은 앱 구분이 없어서 앱별 분리 불가

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      localStorage.setItem(themeKey(appName), newTheme);
      const effective = getEffectiveTheme(newTheme);
      applyTheme(effective);
      setIsDark(effective === "dark");
    },
    [appName],
  );

  const toggle = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);

  const setColorPreset = useCallback(
    (preset: ColorPreset) => {
      setColorPresetState(preset);
      localStorage.setItem(presetKey(appName), preset);
      applyColorPreset(preset);
    },
    [appName],
  );

  const setContentWidth = useCallback(
    (width: ContentWidth) => {
      setContentWidthState(width);
      localStorage.setItem(contentWidthKey(appName), width);
      applyContentWidth(width);
    },
    [appName],
  );

  const setPullToRefresh = useCallback(
    (enabled: boolean) => {
      setPullToRefreshState(enabled);
      localStorage.setItem(pullToRefreshKey(appName), String(enabled));
      applyPullToRefresh(enabled);
    },
    [appName],
  );

  const setShowWideViewToggle = useCallback(
    (visible: boolean) => {
      setShowWideViewToggleState(visible);
      localStorage.setItem(wideViewToggleKey(appName), String(visible));
    },
    [appName],
  );

  // 로그인 시 앱별 localStorage에서 테마 적용 (DB 사용 안 함)
  useEffect(() => {
    if (isAuthenticated) {
      const currentTheme = resolveInitialTheme(null, appName);
      const currentPreset = resolveInitialPreset(null, appName);

      setThemeState(currentTheme);
      const effective = getEffectiveTheme(currentTheme);
      applyTheme(effective);
      setIsDark(effective === "dark");

      setColorPresetState(currentPreset);
      applyColorPreset(currentPreset);

      const currentWidth = resolveInitialContentWidth(appName);
      setContentWidthState(currentWidth);
      applyContentWidth(currentWidth);

      const currentPull = resolveInitialPullToRefresh(appName);
      setPullToRefreshState(currentPull);
      applyPullToRefresh(currentPull);

      setShowWideViewToggleState(resolveInitialShowWideViewToggle(appName));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, appName]);

  // 시스템 테마 변경 감지
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? "dark" : "light");
      setIsDark(e.matches);
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [theme]);

  // 초기 적용
  useEffect(() => {
    const effective = getEffectiveTheme(theme);
    applyTheme(effective);
    setIsDark(effective === "dark");
    applyColorPreset(colorPreset);
    applyContentWidth(contentWidth);
    applyPullToRefresh(pullToRefresh);
  }, [theme, colorPreset, contentWidth, pullToRefresh]);

  const value: ThemeContextValue = {
    theme,
    isDark,
    setTheme,
    toggle,
    colorPreset,
    setColorPreset,
    contentWidth,
    setContentWidth,
    pullToRefresh,
    setPullToRefresh,
    showWideViewToggle,
    setShowWideViewToggle,
  };

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
