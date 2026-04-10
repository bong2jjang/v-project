/**
 * Pagination 컴포넌트
 *
 * 페이지네이션 UI
 */

export interface PaginationProps {
  current: number;
  total: number;
  onChange: (page: number) => void;
  totalItems?: number;
  perPage?: number;
}

function NavButton({
  onClick,
  disabled,
  direction,
}: {
  onClick: () => void;
  disabled: boolean;
  direction: "prev" | "next";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "prev" ? "이전 페이지" : "다음 페이지"}
      className="p-1.5 rounded-button text-content-secondary hover:bg-surface-raised hover:text-content-primary transition-colors duration-normal disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={direction === "prev" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
        />
      </svg>
    </button>
  );
}

export function Pagination({
  current,
  total,
  onChange,
  totalItems,
  perPage,
}: PaginationProps) {
  const canGoPrevious = current > 1;
  const canGoNext = current < total;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("...");
      for (
        let i = Math.max(2, current - 1);
        i <= Math.min(total - 1, current + 1);
        i++
      )
        pages.push(i);
      if (current < total - 2) pages.push("...");
      pages.push(total);
    }

    return pages;
  };

  if (total <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      {totalItems && perPage && (
        <div className="text-body-sm text-content-secondary">
          전체 {totalItems}건 중 {(current - 1) * perPage + 1}~
          {Math.min(current * perPage, totalItems)}
        </div>
      )}

      <div className="flex items-center gap-2">
        <NavButton
          direction="prev"
          onClick={() => onChange(current - 1)}
          disabled={!canGoPrevious}
        />

        {getPageNumbers().map((page, index) =>
          typeof page === "number" ? (
            <button
              key={index}
              type="button"
              onClick={() => onChange(page)}
              className={`px-3 py-1 rounded-button text-body-base font-medium transition-colors duration-normal ${
                page === current
                  ? "bg-brand-600 text-content-inverse"
                  : "bg-surface-card text-content-secondary hover:bg-surface-raised border border-line"
              }`}
            >
              {page}
            </button>
          ) : (
            <span key={index} className="px-2 text-content-tertiary">
              {page}
            </span>
          ),
        )}

        <NavButton
          direction="next"
          onClick={() => onChange(current + 1)}
          disabled={!canGoNext}
        />
      </div>
    </div>
  );
}
