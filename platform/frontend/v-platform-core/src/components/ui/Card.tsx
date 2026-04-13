/**
 * Card 컴포넌트
 *
 * 디자인 시스템 토큰 기반 카드
 */

import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
}

export function Card({
  children,
  hover = false,
  className = "",
  ...props
}: CardProps) {
  const classes = hover
    ? `card-interactive ${className}`
    : `card-base ${className}`;

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function CardHeader({
  children,
  title,
  description,
  action,
  className = "",
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={`px-card-x py-card-y border-b border-line bg-surface-raised/50 ${className}`}
      {...props}
    >
      {(title || action) ? (
        <div className="flex items-center justify-between">
          <div>
            {title && <h3 className="text-heading-md text-content-primary">{title}</h3>}
            {description && (
              <p className="mt-1 text-body-sm text-content-secondary">{description}</p>
            )}
          </div>
          {action}
        </div>
      ) : (
        <>
          {children}
          {description && (
            <p className="mt-1 text-body-sm text-content-secondary">{description}</p>
          )}
        </>
      )}
    </div>
  );
}

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export function CardTitle({
  children,
  className = "",
  ...props
}: CardTitleProps) {
  return (
    <h3
      className={`text-heading-md text-content-primary ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardBody({
  children,
  className = "",
  ...props
}: CardBodyProps) {
  return (
    <div className={`px-card-x py-card-y ${className}`} {...props}>
      {children}
    </div>
  );
}

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function CardFooter({
  children,
  className = "",
  ...props
}: CardFooterProps) {
  return (
    <div
      className={`px-card-x py-card-y border-t border-line bg-surface-raised rounded-b-card ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
