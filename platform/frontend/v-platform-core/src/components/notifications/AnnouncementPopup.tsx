/**
 * AnnouncementPopup — 공지사항 팝업
 *
 * 로그인 후 미읽은 announcement/both 타입 알림을 모달로 표시.
 * "다시 보지 않기" → 읽음 처리 (mark_read)
 * "확인" → 닫기 (다음 로그인/새로고침 시 다시 표시)
 */

import { useEffect, useState, useCallback } from "react";
import {
  Megaphone,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
} from "lucide-react";
import {
  listAnnouncements,
  markRead,
} from "../../api/persistentNotifications";
import type { PersistentNotification } from "../../api/persistentNotifications";
import { SimpleMarkdown } from "../ui/SimpleMarkdown";

/** 상단 액센트 바 색상 */
const SEVERITY_BAR: Record<string, string> = {
  critical: "bg-red-500",
  error: "bg-red-400",
  warning: "bg-amber-400",
  info: "bg-blue-500",
  success: "bg-emerald-500",
};

/** 뱃지 스타일 */
const SEVERITY_BADGE: Record<string, string> = {
  critical:
    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  error:
    "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  success:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "긴급",
  error: "오류",
  warning: "경고",
  info: "공지",
  success: "안내",
};

export function AnnouncementPopup() {
  const [announcements, setAnnouncements] = useState<
    PersistentNotification[]
  >([]);
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

  const barColor = SEVERITY_BAR[current.severity] || SEVERITY_BAR.info;
  const badgeStyle =
    SEVERITY_BADGE[current.severity] || SEVERITY_BADGE.info;
  const severityLabel =
    SEVERITY_LABELS[current.severity] || SEVERITY_LABELS.info;
  const hasMultiple = announcements.length > 1;

  return (
    <div className="fixed inset-0 z-modal overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Popup */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="relative bg-surface-card rounded-2xl shadow-2xl border border-line max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Severity accent bar */}
          <div className={`h-1 ${barColor}`} />

          {/* Header */}
          <div className="flex items-center gap-3 px-6 pt-5 pb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30">
              <Megaphone className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-content-primary leading-tight">
                공지사항
              </h3>
              {hasMultiple && (
                <p className="text-xs text-content-tertiary mt-0.5">
                  {currentIndex + 1} / {announcements.length}건
                </p>
              )}
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-md ${badgeStyle}`}
            >
              {severityLabel}
            </span>
            <button
              onClick={handleClose}
              className="p-1 -mr-1 rounded-lg text-content-tertiary hover:text-content-secondary hover:bg-surface-raised transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Divider */}
          <div className="mx-6 border-t border-line" />

          {/* Content */}
          <div className="px-6 py-5 max-h-[50vh] overflow-y-auto">
            <h4 className="text-lg font-bold text-content-primary leading-snug mb-3">
              {current.title}
            </h4>

            <div className="text-sm text-content-secondary leading-relaxed">
              <SimpleMarkdown content={current.message} />
            </div>

            {/* Meta row */}
            {(current.link || current.created_at) && (
              <div className="mt-4 pt-3 border-t border-line/50 flex items-center justify-between gap-3">
                {current.created_at && (
                  <span className="text-xs text-content-tertiary">
                    {new Date(current.created_at).toLocaleString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
                {current.link && (
                  <a
                    href={current.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors shrink-0"
                  >
                    자세히 보기
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Carousel navigation */}
          {hasMultiple && (
            <div className="flex items-center justify-center gap-3 px-6 pb-3">
              <button
                onClick={() =>
                  setCurrentIndex(Math.max(0, currentIndex - 1))
                }
                disabled={currentIndex === 0}
                className="p-1.5 rounded-lg hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-content-secondary" />
              </button>
              <div className="flex items-center gap-1.5">
                {announcements.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className={`rounded-full transition-all ${
                      i === currentIndex
                        ? "w-5 h-2 bg-brand-600 dark:bg-brand-400"
                        : "w-2 h-2 bg-content-tertiary/25 hover:bg-content-tertiary/40"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() =>
                  setCurrentIndex(
                    Math.min(announcements.length - 1, currentIndex + 1),
                  )
                }
                disabled={currentIndex === announcements.length - 1}
                className="p-1.5 rounded-lg hover:bg-surface-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-content-secondary" />
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 py-4 border-t border-line bg-surface-raised/50">
            <button
              onClick={handleDismiss}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-content-secondary border border-line rounded-lg hover:bg-surface-base transition-colors"
            >
              다시 보지 않기
            </button>
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
