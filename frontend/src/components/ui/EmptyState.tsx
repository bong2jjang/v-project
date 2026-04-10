/**
 * EmptyState 컴포넌트
 *
 * 데이터가 없을 때 표시하는 빈 상태
 */

import { ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon && (
        <div className="mx-auto h-12 w-12 text-content-tertiary">{icon}</div>
      )}
      <h3 className="mt-2 text-heading-sm text-content-primary">{title}</h3>
      {description && (
        <p className="mt-1 text-body-base text-content-secondary">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          <Button variant="primary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
