/**
 * useSidebar Hook
 *
 * Sidebar 상태 관리 및 반응형 브레이크포인트 감지
 *
 * 2단계 반응형 전략:
 * - Desktop (>= 1024px): 항상 아이콘만 표시 (Compact)
 * - Tablet/Mobile (< 1024px): 기본 숨김, 햄버거 메뉴로 오버레이
 */

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  ReactNode,
} from "react";

type Breakpoint = "desktop" | "tablet" | "mobile";
type SidebarState = "collapsed" | "hidden";

interface UseSidebarReturn {
  // 실제 표시 상태 (브레이크포인트 고려)
  actualState: SidebarState;

  // 모바일 오버레이 상태
  isMobileOpen: boolean;

  // 현재 브레이크포인트
  breakpoint: Breakpoint;

  // Overflow detection (desktop)
  isOverflowing: boolean;
  setIsOverflowing: (v: boolean) => void;

  // Actions
  setMobileOpen: (open: boolean) => void;
  closeMobile: () => void;
}

// Context for Sidebar state
const SidebarContext = createContext<UseSidebarReturn | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const sidebar = useSidebarInternal();

  return (
    <SidebarContext.Provider value={sidebar}>
      {children}
    </SidebarContext.Provider>
  );
}

// Rename the original hook
function useSidebarInternal(): UseSidebarReturn {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() => {
    const width = window.innerWidth;
    if (width >= 1024) return "desktop";
    if (width >= 768) return "tablet";
    return "mobile";
  });

  const [actualState, setActualState] = useState<SidebarState>("collapsed");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      let newBreakpoint: Breakpoint;

      if (width >= 1024) {
        newBreakpoint = "desktop";
        setActualState("collapsed"); // 항상 아이콘만
      } else if (width >= 768) {
        newBreakpoint = "tablet";
        setActualState("hidden");
      } else {
        newBreakpoint = "mobile";
        setActualState("hidden");
      }

      setBreakpoint(newBreakpoint);
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const closeMobile = useCallback(() => {
    setIsMobileOpen(false);
  }, []);

  return {
    actualState,
    isMobileOpen,
    isOverflowing,
    breakpoint,
    setIsOverflowing,
    setMobileOpen: setIsMobileOpen,
    closeMobile,
  };
}

// Hook to use Sidebar context
export function useSidebar(): UseSidebarReturn {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}
