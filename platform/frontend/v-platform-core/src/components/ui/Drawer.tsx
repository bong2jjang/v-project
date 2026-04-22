/**
 * Drawer 컴포넌트 — 우측/좌측 슬라이드 패널
 *
 * Modal 보다 넓은 작업 영역이 필요한 편집 흐름(상세 폼, 리치에디터 등)에 사용.
 * `hideBackdrop` 옵션으로 배경 스크림 없이 도킹 모드(페이지 공존)도 지원.
 */

import { ReactNode, useEffect, useRef } from "react";
import { Button } from "./Button";

export type DrawerSide = "right" | "left";
export type DrawerSize = "md" | "lg" | "xl" | "full";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: DrawerSide;
  size?: DrawerSize;
  closeOnBackdrop?: boolean;
  hideBackdrop?: boolean;
  ariaLabel?: string;
}

const sizeClasses: Record<DrawerSize, string> = {
  md: "w-full sm:w-[30rem]",
  lg: "w-full md:w-[50vw] lg:w-[48rem]",
  xl: "w-full lg:w-[75vw]",
  full: "w-full",
};

const sideTransforms: Record<DrawerSide, { hidden: string; shown: string; anchor: string }> = {
  right: {
    hidden: "translate-x-full",
    shown: "translate-x-0",
    anchor: "right-0",
  },
  left: {
    hidden: "-translate-x-full",
    shown: "translate-x-0",
    anchor: "left-0",
  },
};

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
  side = "right",
  size = "lg",
  closeOnBackdrop = true,
  hideBackdrop = false,
  ariaLabel,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (hideBackdrop) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen, hideBackdrop]);

  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const transform = sideTransforms[side];

  return (
    <div
      className={hideBackdrop ? "fixed inset-0 z-modal pointer-events-none" : "fixed inset-0 z-modal"}
      role="dialog"
      aria-modal={hideBackdrop ? undefined : true}
      aria-label={ariaLabel ?? title}
    >
      {!hideBackdrop && (
        <div
          className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-normal"
          onClick={closeOnBackdrop ? onClose : undefined}
        />
      )}

      <div
        ref={panelRef}
        tabIndex={-1}
        className={`absolute top-0 bottom-0 ${transform.anchor} ${sizeClasses[size]} max-w-full bg-surface-card border-l border-line shadow-modal flex flex-col transform transition-transform duration-normal ease-out ${transform.shown} pointer-events-auto`}
      >
        <div className="flex items-center justify-between px-card-x py-card-y border-b border-line">
          <h3 className="text-heading-md text-content-primary truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            title="닫기"
            className="p-1.5 rounded-button text-content-tertiary hover:text-content-primary hover:bg-surface-raised transition-colors duration-fast"
          >
            <span className="sr-only">닫기</span>
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-card-x py-card-y">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-element-gap px-card-x py-card-y border-t border-line bg-surface-raised">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface DrawerFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "primary" | "success" | "danger";
  loading?: boolean;
  disabled?: boolean;
  extra?: ReactNode;
}

export function DrawerFooter({
  onCancel,
  onConfirm,
  confirmText = "확인",
  cancelText = "취소",
  confirmVariant = "primary",
  loading = false,
  disabled = false,
  extra,
}: DrawerFooterProps) {
  return (
    <>
      {extra && <div className="mr-auto">{extra}</div>}
      <Button variant="secondary" onClick={onCancel} disabled={loading}>
        {cancelText}
      </Button>
      <Button
        variant={confirmVariant}
        onClick={onConfirm}
        loading={loading}
        disabled={disabled || loading}
      >
        {confirmText}
      </Button>
    </>
  );
}
