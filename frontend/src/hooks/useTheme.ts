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
  useRef,
  ReactNode,
  createElement,
} from "react";
import { updateMe } from "../lib/api/users";
import { useAuthStore } from "../store/auth";

type Theme = "light" | "dark" | "system";
export type ColorPreset = "blue" | "indigo" | "rose";

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

function applyColorPreset(preset: ColorPreset) {
  const root = document.documentElement;
  // 이전 프리셋 클래스 제거
  root.classList.remove("theme-indigo", "theme-rose");
  // blue는 기본값이라 클래스 불필요
  if (preset !== "blue") {
    root.classList.add(`theme-${preset}`);
  }
}

/** 초기 테마 값 결정: 사용자 DB 값 > localStorage > 기본값 */
function resolveInitialTheme(userTheme?: string | null): Theme {
  if (isValidTheme(userTheme)) return userTheme;
  const stored = localStorage.getItem("theme");
  if (isValidTheme(stored)) return stored;
  return "system";
}

function resolveInitialPreset(userPreset?: string | null): ColorPreset {
  if (isValidPreset(userPreset)) return userPreset;
  const stored = localStorage.getItem("colorPreset");
  if (isValidPreset(stored)) return stored;
  return "blue";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [theme, setThemeState] = useState<Theme>(() =>
    resolveInitialTheme(user?.theme),
  );

  const [colorPreset, setColorPresetState] = useState<ColorPreset>(() =>
    resolveInitialPreset(user?.color_preset),
  );

  const [isDark, setIsDark] = useState(
    () => getEffectiveTheme(theme) === "dark",
  );

  // 서버 저장 debounce용 타이머
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 서버에 테마 설정 저장 (debounce 300ms) */
  const saveToServer = useCallback(
    (updates: { theme?: string; color_preset?: string }) => {
      if (!isAuthenticated) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateMe(updates).catch((err) =>
          console.warn("[Theme] Failed to save to server:", err),
        );
      }, 300);
    },
    [isAuthenticated],
  );

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      localStorage.setItem("theme", newTheme);
      const effective = getEffectiveTheme(newTheme);
      applyTheme(effective);
      setIsDark(effective === "dark");
      saveToServer({ theme: newTheme });
    },
    [saveToServer],
  );

  const toggle = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);

  const setColorPreset = useCallback(
    (preset: ColorPreset) => {
      setColorPresetState(preset);
      localStorage.setItem("colorPreset", preset);
      applyColorPreset(preset);
      saveToServer({ color_preset: preset });
    },
    [saveToServer],
  );

  // 로그인/로그아웃 시 사용자 DB 값으로 동기화
  useEffect(() => {
    if (isAuthenticated && user) {
      const serverTheme = resolveInitialTheme(user.theme);
      const serverPreset = resolveInitialPreset(user.color_preset);

      setThemeState(serverTheme);
      localStorage.setItem("theme", serverTheme);
      const effective = getEffectiveTheme(serverTheme);
      applyTheme(effective);
      setIsDark(effective === "dark");

      setColorPresetState(serverPreset);
      localStorage.setItem("colorPreset", serverPreset);
      applyColorPreset(serverPreset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

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
  }, [theme, colorPreset]);

  // cleanup
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const value: ThemeContextValue = {
    theme,
    isDark,
    setTheme,
    toggle,
    colorPreset,
    setColorPreset,
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
