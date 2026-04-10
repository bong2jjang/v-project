/**
 * Divider 컴포넌트
 *
 * 구분선
 */

interface DividerProps {
  label?: string;
  className?: string;
}

export function Divider({ label, className = "" }: DividerProps) {
  if (label) {
    return (
      <div className={`relative ${className}`}>
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-line" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-surface-card px-3 text-body-sm text-content-secondary">
            {label}
          </span>
        </div>
      </div>
    );
  }

  return <hr className={`border-t border-line ${className}`} />;
}
