/**
 * AnnouncementPopup — 공지사항 팝업
 *
 * 로그인 후 미읽은 announcement/both 타입 알림을 모달로 표시.
 * "다시 보지 않기" → 읽음 처리 (mark_read)
 * "다음에 보기" → 닫기 (다음 로그인/새로고침 시 다시 표시)
 */

import { useEffect, useState, useCallback } from "react";
import { Megaphone, ChevronLeft, ChevronRight } from "lucide-react";
import { listAnnouncements, markRead } from "../../api/persistentNotifications";
import type { PersistentNotification } from "../../api/persistentNotifications";
import { SimpleMarkdown } from "../ui/SimpleMarkdown";

const SEVERITY_STYLES: Record<string, string> = {
  critical:
    "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
  error:
    "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300",
  warning:
    "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300",
  info: "border-blue-400 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
  success:
    "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "긴급",
  error: "오류",
  warning: "경고",
  info: "공지",
  success: "안내",
};

export function AnnouncementPopup() {
  const [announcements, setAnnouncements] = useState<PersistentNotification[]>(
    [],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const data = await listAnnouncements();
      if (data.length > 0) {
        setAnnouncements(data);
        setCurrentIndex(0);
        setVisible(true);
      }
    } catch {
      // 로그인 전이거나 API 오류 시 무시
    }
  }, []);

  useEffect(() => {
    // 초기 로드 시 1초 후 공지사항 확인 (로그인 처리 대기)
    const timer = setTimeout(fetchAnnouncements, 1000);
    return () => clearTimeout(timer);
  }, [fetchAnnouncements]);

  const current = announcements[currentIndex];

  const handleDismiss = async () => {
    if (!current) return;
    await markRead(current.id);
    const remaining = announcements.filter((_, i) => i !== currentIndex);
    if (remaining.length === 0) {
      setVisible(false);
      setAnnouncements([]);
    } else {
      setAnnouncements(remaining);
      setCurrentIndex(Math.min(currentIndex, remaining.length - 1));
    }
  };

  const handleClose = () => {
    setVisible(false);
  };

  if (!visible || !current) return null;

  const severityStyle =
    SEVERITY_STYLES[current.severity] || SEVERITY_STYLES.info;
  const severityLabel =
    SEVERITY_LABELS[current.severity] || SEVERITY_LABELS.info;
  const hasMultiple = announcements.length > 1;

  return (
    <div className="fixed inset-0 z-modal overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Popup */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="relative bg-surface-card rounded-modal shadow-modal border border-line max-w-lg w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-5 py-4 border-b border-line">
            <Megaphone className="w-5 h-5 text-brand-600" />
            <h3 className="text-heading-md text-content-primary flex-1">
              공지사항
            </h3>
            {hasMultiple && (
              <span className="text-xs text-content-tertiary">
                {currentIndex + 1} / {announcements.length}
              </span>
            )}
          </div>

          {/* Body */}
          <div className="px-5 py-5">
            {/* Severity badge */}
            <div
              className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border mb-3 ${severityStyle}`}
            >
              {severityLabel}
            </div>

            <h4 className="text-lg font-semibold text-content-primary mb-2">
              {current.title}
            </h4>

            <div className="text-sm text-content-secondary leading-relaxed">
              <SimpleMarkdown content={current.message} />
            </div>

            {current.link && (
              <a
                href={current.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center mt-3 text-sm text-brand-600 hover:text-brand-700 underline"
              >
                자세히 보기
              </a>
            )}

            {current.created_at && (
              <p className="text-xs text-content-tertiary mt-3">
                {new Date(current.created_at).toLocaleString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>

          {/* Navigation (다수일 때) */}
          {hasMultiple && (
            <div className="flex items-center justify-center gap-2 px-5 pb-2">
              <button
                onClick={() =>
                  setCurrentIndex(Math.max(0, currentIndex - 1))
                }
                disabled={currentIndex === 0}
                className="p-1 rounded hover:bg-surface-raised disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-content-secondary" />
              </button>
              {announcements.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex
                      ? "bg-brand-600"
                      : "bg-content-tertiary/30 hover:bg-content-tertiary/50"
                  }`}
                />
              ))}
              <button
                onClick={() =>
                  setCurrentIndex(
                    Math.min(announcements.length - 1, currentIndex + 1),
                  )
                }
                disabled={currentIndex === announcements.length - 1}
                className="p-1 rounded hover:bg-surface-raised disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-content-secondary" />
              </button>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-line bg-surface-raised rounded-b-modal">
            <button
              onClick={handleDismiss}
              className="text-sm text-content-tertiary hover:text-content-secondary transition-colors"
            >
              다시 보지 않기
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-button hover:bg-brand-700 transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
