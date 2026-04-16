/**
 * PWA standalone 모드 전용 pull-to-refresh 훅.
 *
 * 일반 브라우저에서는 비활성화 → 네이티브 새로고침과 충돌 없음.
 * scrollRef가 가리키는 요소의 터치 이벤트를 감지하여,
 * scrollTop ≤ 0 에서 아래로 당기면 페이지를 새로고침합니다.
 *
 * 사용법:
 *   const mainRef = useRef<HTMLElement>(null);
 *   const ptr = usePullToRefresh(mainRef);
 *   // ptr.isPWA, ptr.pullDistance, ptr.isPulling, ptr.isRefreshing
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

const START_DEAD = 20; // 이 거리까지는 일반 스크롤로 취급 (px)
const THRESHOLD = 80; // 새로고침 트리거 최소 시각 거리 (px)
const MAX_PULL = 140; // 최대 시각적 거리 (px)
const DAMPING = 0.3; // 터치 거리 → 시각 거리 비율 (낮을수록 둔감)

export function usePullToRefresh(scrollRef: RefObject<HTMLElement | null>) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isPWA = useMemo(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true),
    [],
  );

  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const pullDistRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!isPWA) return;
    const el = scrollRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      startYRef.current = el.scrollTop <= 0 ? e.touches[0].clientY : 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (refreshingRef.current || startYRef.current === 0) return;

      // 스크롤이 내려간 상태 → 풀 추적 중단
      if (el.scrollTop > 0) {
        if (pullingRef.current) {
          pullingRef.current = false;
          pullDistRef.current = 0;
          setIsPulling(false);
          setPullDistance(0);
        }
        startYRef.current = 0;
        return;
      }

      const diff = e.touches[0].clientY - startYRef.current;

      if (diff > START_DEAD) {
        e.preventDefault(); // 네이티브 바운스 방지
        if (!pullingRef.current) {
          pullingRef.current = true;
          setIsPulling(true);
        }
        // 데드존 이후부터 시각 거리 계산
        const dist = Math.min((diff - START_DEAD) * DAMPING, MAX_PULL);
        pullDistRef.current = dist;
        setPullDistance(dist);
      } else if (pullingRef.current) {
        pullingRef.current = false;
        pullDistRef.current = 0;
        setIsPulling(false);
        setPullDistance(0);
      }
    };

    const onTouchEnd = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      startYRef.current = 0;

      // 먼저 isPulling 해제 → CSS transition 활성화
      setIsPulling(false);

      // 다음 프레임: 최종 위치로 애니메이션
      requestAnimationFrame(() => {
        if (pullDistRef.current >= THRESHOLD) {
          refreshingRef.current = true;
          setIsRefreshing(true);
          setPullDistance(THRESHOLD);
          setTimeout(() => window.location.reload(), 500);
        } else {
          setPullDistance(0);
          pullDistRef.current = 0;
        }
      });
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [isPWA, scrollRef]);

  return { pullDistance, isPulling, isRefreshing, isPWA, threshold: THRESHOLD };
}
