/**
 * Modal 컴포넌트
 *
 * 유리 효과 배경 + 다크모드 지원 모달
 */

import { ReactNode, useEffect } from "react";
import { Button } from "./Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal overflow-y-auto">
      {/* Backdrop — 유리 효과 */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className={`relative bg-surface-card rounded-modal shadow-modal border border-line ${sizeClasses[size]} w-full max-h-[90vh] flex flex-col`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-card-x py-card-y border-b border-line">
            <h3 className="text-heading-md text-content-primary">{title}</h3>
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

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-card-x py-card-y">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-center gap-element-gap px-card-x py-card-y border-t border-line bg-surface-raised rounded-b-modal">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ModalFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "primary" | "success" | "danger";
  loading?: boolean;
  disabled?: boolean;
}

export function ModalFooter({
  onCancel,
  onConfirm,
  confirmText = "확인",
  cancelText = "취소",
  confirmVariant = "primary",
  loading = false,
  disabled = false,
}: ModalFooterProps) {
  return (
    <>
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
