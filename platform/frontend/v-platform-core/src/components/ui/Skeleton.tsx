/**
 * Skeleton UI Components
 *
 * 콘텐츠 로딩 중 표시되는 플레이스홀더 컴포넌트
 * animate-pulse + bg-surface-raised 기반 디자인 시스템 표준
 */

interface SkeletonProps {
  className?: string;
}

/** 기본 스켈레톤 블록 — className으로 크기/모양 지정 */
export function Skeleton({ className = "h-4 w-full" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-surface-raised rounded ${className}`}
      aria-hidden="true"
    />
  );
}

/** 원형 스켈레톤 (아바타, 아이콘 등) */
export function SkeletonCircle({ className = "w-8 h-8" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-surface-raised rounded-full flex-shrink-0 ${className}`}
      aria-hidden="true"
    />
  );
}

/** 텍스트 여러 줄 스켈레톤 */
export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["w-full", "w-5/6", "w-4/6", "w-3/4", "w-2/3"];
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 animate-pulse bg-surface-raised rounded ${widths[i % widths.length]}`}
        />
      ))}
    </div>
  );
}

/** 카드형 스켈레톤 (통계 카드, 정보 카드 등) */
export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`bg-surface-card border border-line rounded-lg p-5 animate-pulse space-y-3 ${className}`}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 bg-surface-raised rounded" />
        <div className="h-8 w-8 bg-surface-raised rounded-lg" />
      </div>
      <div className="h-6 w-20 bg-surface-raised rounded" />
      <div className="h-3 w-32 bg-surface-raised rounded" />
    </div>
  );
}

/** 테이블 행 스켈레톤 */
export function SkeletonTableRow({
  cols = 4,
  className = "",
}: {
  cols?: number;
  className?: string;
}) {
  const colWidths = ["w-28", "w-20", "w-16", "w-24", "w-12", "w-32", "w-20"];
  return (
    <tr className={`animate-pulse ${className}`} aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className={`h-4 bg-surface-raised rounded ${colWidths[i % colWidths.length]}`}
          />
        </td>
      ))}
    </tr>
  );
}

/** 메뉴 행 스켈레톤 (MenuManagement용) */
export function SkeletonMenuRow() {
  return (
    <div
      className="flex items-center gap-4 py-3 px-2 animate-pulse"
      aria-hidden="true"
    >
      <div className="w-4 h-4 bg-surface-raised rounded" />
      <div className="w-4 h-4 bg-surface-raised rounded" />
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="h-4 w-28 bg-surface-raised rounded" />
          <div className="h-5 w-12 bg-surface-raised rounded-full" />
        </div>
        <div className="flex gap-3">
          <div className="h-3 w-24 bg-surface-raised rounded" />
          <div className="h-3 w-20 bg-surface-raised rounded" />
        </div>
      </div>
      <div className="h-3 w-6 bg-surface-raised rounded" />
      <div className="h-5 w-9 bg-surface-raised rounded-full" />
      <div className="flex gap-1">
        <div className="h-7 w-7 bg-surface-raised rounded" />
        <div className="h-7 w-7 bg-surface-raised rounded" />
      </div>
    </div>
  );
}

/** Provider 카드 스켈레톤 */
export function SkeletonProviderCard() {
  return (
    <div
      className="bg-surface-card border border-line rounded-lg p-5 animate-pulse"
      aria-hidden="true"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-surface-raised rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-32 bg-surface-raised rounded" />
            <div className="h-5 w-14 bg-surface-raised rounded-full" />
          </div>
          <div className="h-3 w-48 bg-surface-raised rounded" />
          <div className="flex gap-2 mt-3">
            <div className="h-7 w-16 bg-surface-raised rounded" />
            <div className="h-7 w-16 bg-surface-raised rounded" />
          </div>
        </div>
        <div className="h-5 w-9 bg-surface-raised rounded-full" />
      </div>
    </div>
  );
}

/** OAuth 카드 스켈레톤 */
export function SkeletonOAuthCard() {
  return (
    <div
      className="bg-surface-card border border-line rounded-lg p-4 animate-pulse"
      aria-hidden="true"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-surface-raised rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-36 bg-surface-raised rounded" />
          <div className="h-3 w-24 bg-surface-raised rounded" />
        </div>
        <div className="h-8 w-20 bg-surface-raised rounded-lg" />
      </div>
    </div>
  );
}
