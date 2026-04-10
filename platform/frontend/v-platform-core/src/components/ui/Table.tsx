/**
 * Table 컴포넌트
 *
 * 디자인 시스템 토큰 기반 테이블
 */

import { ReactNode, HTMLAttributes } from "react";

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode;
}

export function Table({ children, className = "", ...props }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table
        className={`min-w-full divide-y divide-line ${className}`}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

export function TableHeader({
  children,
  className = "",
  ...props
}: TableHeaderProps) {
  return (
    <thead className={`bg-surface-raised ${className}`} {...props}>
      {children}
    </thead>
  );
}

interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {
  children: ReactNode;
}

export function TableBody({
  children,
  className = "",
  ...props
}: TableBodyProps) {
  return (
    <tbody
      className={`bg-surface-card divide-y divide-line ${className}`}
      {...props}
    >
      {children}
    </tbody>
  );
}

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode;
  hoverable?: boolean;
}

export function TableRow({
  children,
  hoverable = true,
  className = "",
  ...props
}: TableRowProps) {
  const hoverClass = hoverable
    ? "hover:bg-surface-raised transition-colors duration-fast"
    : "";
  return (
    <tr className={`${hoverClass} ${className}`} {...props}>
      {children}
    </tr>
  );
}

interface TableHeadProps extends HTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
}

export function TableHead({
  children,
  className = "",
  ...props
}: TableHeadProps) {
  return (
    <th
      className={`px-card-x py-3 text-left text-caption text-content-secondary uppercase tracking-wider ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

interface TableCellProps extends HTMLAttributes<HTMLTableCellElement> {
  children: ReactNode;
}

export function TableCell({
  children,
  className = "",
  ...props
}: TableCellProps) {
  return (
    <td
      className={`px-card-x py-card-y whitespace-nowrap text-body-base text-content-primary ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}
