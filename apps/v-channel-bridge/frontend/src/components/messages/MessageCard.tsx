/**
 * MessageCard 컴포넌트
 *
 * 개별 메시지 카드 — 플랫폼 아이콘, 발신자명, 상대시간, 접기/펼치기, 복사
 */

import { useState, useCallback, useEffect } from "react";
import { Badge } from "../ui/Badge";
import type { Message } from "../../lib/api/messages";

// ── 채널명 표시 (이름 우선, ID 폴백 시 truncate + tooltip) ──────────────────
function ChannelLabel({
  name,
  id,
}: {
  name: string | null | undefined;
  id: string;
}) {
  const display = name || id;
  const isIdLike =
    !name || name === id || name.includes("@thread.") || name.includes(":");
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });

  const maxLen = 28;
  const needsTruncate = isIdLike && display.length > maxLen;
  const shown = needsTruncate
    ? `${display.slice(0, 12)}…${display.slice(-8)}`
    : display;

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (!isIdLike) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ visible: true, x: rect.left, y: rect.bottom + 4 });
  };

  return (
    <>
      <span
        className="truncate max-w-[160px] inline-block align-bottom cursor-default"
        title={!isIdLike && name ? id : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setTooltip((p) => ({ ...p, visible: false }))}
      >
        {shown}
      </span>
      {tooltip.visible && isIdLike && (
        <div
          className="fixed z-[9999] px-3 py-1.5 text-xs font-mono bg-gray-900 text-white rounded-md shadow-xl break-all max-w-[min(480px,90vw)]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {id}
        </div>
      )}
    </>
  );
}

export interface MessageCardProps {
  message: Message;
}

// ── 플랫폼 아이콘 ──────────────────────────────────────────────────────────
function PlatformBadge({ platform }: { platform?: string }) {
  const p = platform?.toLowerCase();
  if (p === "slack") {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded text-white text-[10px] font-bold flex-shrink-0"
        style={{ backgroundColor: "#4A154B" }}
        title="Slack"
      >
        S
      </span>
    );
  }
  if (p === "teams" || p === "teams") {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded text-white text-[10px] font-bold flex-shrink-0"
        style={{ backgroundColor: "#5059C9" }}
        title="Teams"
      >
        T
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-400 text-white text-[10px] font-bold flex-shrink-0"
      title={platform || "Unknown"}
    >
      ?
    </span>
  );
}

// ── UTC 파싱 헬퍼 ─────────────────────────────────────────────────────────
/** 백엔드 ISO 문자열이 timezone 접미사 없이 올 경우 UTC로 간주 */
function parseUTC(timestamp: string): Date {
  // 이미 Z 또는 +/- offset이 있으면 그대로 파싱
  if (/[Zz]$/.test(timestamp) || /[+-]\d{2}:\d{2}$/.test(timestamp)) {
    return new Date(timestamp);
  }
  // timezone 정보 없는 naive ISO → UTC로 간주
  return new Date(timestamp + "Z");
}

// ── 상대 시간 ──────────────────────────────────────────────────────────────
function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const diff = now - parseUTC(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "방금 전";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return parseUTC(timestamp).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

function formatExactTime(timestamp: string): string {
  return parseUTC(timestamp).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── 오류 상세 팝오버 (클릭 고정 + 복사) ──────────────────────────────────────
function ErrorPopover({
  label,
  labelColor,
  message,
}: {
  label: string;
  labelColor: string;
  message: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [message]);

  return (
    <div
      className="fixed z-[9999] px-3 py-2 text-xs bg-gray-900 text-white rounded-md shadow-xl max-w-[min(420px,90vw)] break-words leading-relaxed"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex-1 min-w-0">
          <span className={`font-semibold ${labelColor}`}>{label}</span>{" "}
          {message}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          title="오류 메시지 복사"
          className="flex-shrink-0 p-1 rounded hover:bg-gray-700 transition-colors"
        >
          {copied ? (
            <svg
              className="w-3.5 h-3.5 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : (
            <svg
              className="w-3.5 h-3.5 text-gray-400 hover:text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ── 상태 뱃지 ──────────────────────────────────────────────────────────────
function StatusBadge({
  status,
  errorMessage,
}: {
  status?: string;
  errorMessage?: string;
}) {
  const [popover, setPopover] = useState<{
    pinned: boolean;
    hover: boolean;
    x: number;
    y: number;
  }>({ pinned: false, hover: false, x: 0, y: 0 });

  const visible = popover.pinned || popover.hover;

  const updatePosition = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setPopover((p) => ({ ...p, x: rect.right, y: rect.bottom + 4 }));
  }, []);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      if (!errorMessage) return;
      updatePosition(e.currentTarget as HTMLElement);
      setPopover((p) => ({ ...p, hover: true }));
    },
    [errorMessage, updatePosition],
  );

  const handleMouseLeave = useCallback(() => {
    setPopover((p) => ({ ...p, hover: false }));
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!errorMessage) return;
      e.stopPropagation();
      updatePosition(e.currentTarget as HTMLElement);
      setPopover((p) => ({ ...p, pinned: !p.pinned }));
    },
    [errorMessage, updatePosition],
  );

  // 고정 팝오버 외부 클릭 시 닫기
  useEffect(() => {
    if (!popover.pinned) return;
    const handleOutside = () => setPopover((p) => ({ ...p, pinned: false }));
    document.addEventListener("click", handleOutside);
    return () => document.removeEventListener("click", handleOutside);
  }, [popover.pinned]);

  const renderPopover = (label: string, labelColor: string) =>
    visible &&
    errorMessage && (
      <div
        style={{
          position: "fixed",
          left: Math.min(popover.x, window.innerWidth - 440),
          top: popover.y,
          zIndex: 9999,
        }}
      >
        <ErrorPopover
          label={label}
          labelColor={labelColor}
          message={errorMessage}
        />
      </div>
    );

  switch (status) {
    case "sent":
      return <Badge variant="success">전송 완료</Badge>;
    case "partial_success":
      return (
        <>
          <span
            className="cursor-pointer"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          >
            <Badge variant="warning">부분 성공</Badge>
          </span>
          {renderPopover("상세:", "text-amber-300")}
        </>
      );
    case "failed":
      return (
        <>
          <span
            className="cursor-pointer"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
          >
            <Badge variant="danger">전송 실패</Badge>
          </span>
          {renderPopover("오류 상세:", "text-red-300")}
        </>
      );
    case "pending":
      return <Badge variant="warning">대기 중</Badge>;
    case "retrying":
      return <Badge variant="warning">재시도 중</Badge>;
    default:
      return null;
  }
}

// ── 사용자명 우선순위 ──────────────────────────────────────────────────────
function getDisplayName(source: Message["source"]): string {
  return (
    source.display_name || source.user_name || source.user || "Unknown User"
  );
}

function getInitials(name: string): string {
  if (!name || name === "Unknown User") return "?";
  const trimmed = name.replace(/^[UW][\dA-Z]{8,}$/, ""); // strip Slack user IDs
  if (!trimmed) return name.slice(0, 1).toUpperCase();
  const parts = trimmed.trim().split(/\s+/);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

// ── 복사 버튼 ─────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="메시지 복사"
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-content-tertiary hover:text-content-secondary hover:bg-surface-raised"
    >
      {copied ? (
        <svg
          className="w-3.5 h-3.5 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ) : (
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────
const TEXT_TRUNCATE_LENGTH = 200;

export function MessageCard({ message }: MessageCardProps) {
  const [expanded, setExpanded] = useState(false);

  const displayName = getDisplayName(message.source);
  const initials = getInitials(displayName);
  const isLong = message.text.length > TEXT_TRUNCATE_LENGTH;
  const shownText =
    isLong && !expanded
      ? message.text.slice(0, TEXT_TRUNCATE_LENGTH) + "…"
      : message.text;

  // 플랫폼 = protocol 필드 우선
  const sourcePlatform = message.protocol || message.source.account;
  const destPlatform = message.destination.account;

  return (
    <div className="group border border-line rounded-card p-4 hover:bg-surface-raised transition-colors duration-normal">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* 아바타 */}
          <div className="flex-shrink-0 w-9 h-9 bg-brand-600 text-content-inverse rounded-full flex items-center justify-center font-semibold text-body-sm">
            {initials}
          </div>

          <div>
            {/* 이름 + 시간 */}
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-content-primary text-body-base">
                {displayName}
              </span>
              <time
                dateTime={message.timestamp}
                title={formatExactTime(message.timestamp)}
                className="text-body-xs text-content-tertiary cursor-default"
              >
                {formatRelativeTime(message.timestamp)}
              </time>
            </div>
          </div>
        </div>

        {/* 우측: 상태 뱃지 + 첨부 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {message.has_attachment && message.attachment_count > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-base border border-line text-body-xs text-content-secondary">
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                />
              </svg>
              {message.attachment_count}
            </span>
          )}
          <StatusBadge
            status={message.status}
            errorMessage={message.error_message}
          />
        </div>
      </div>

      {/* ── 메시지 본문 ── */}
      <div className="mb-3 relative">
        <div className="absolute top-0 right-0">
          <CopyButton text={message.text} />
        </div>
        <p className="text-content-primary text-body-base whitespace-pre-wrap pr-7 leading-relaxed">
          {shownText}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-body-xs text-brand-500 hover:text-brand-600 font-medium"
          >
            {expanded ? "접기" : "더 보기"}
          </button>
        )}
      </div>

      {/* ── 첨부파일 상세 ── */}
      {message.has_attachment &&
        message.attachment_details &&
        message.attachment_details.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {message.attachment_details.map((att, idx) => {
              const isImage = att.type?.startsWith("image/");
              return (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-base border border-line text-body-xs text-content-secondary"
                  title={
                    att.size
                      ? `${att.name} (${(att.size / 1024).toFixed(1)}KB)`
                      : att.name
                  }
                >
                  {isImage ? (
                    <svg
                      className="w-3 h-3 text-blue-500 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-3 h-3 text-content-tertiary flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      />
                    </svg>
                  )}
                  <span className="truncate max-w-[180px]">
                    {att.name || "unknown"}
                  </span>
                </span>
              );
            })}
          </div>
        )}

      {/* ── Footer: 발신→수신 흐름 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 text-body-xs pt-3 border-t border-line">
        {/* Route 흐름 */}
        <div className="flex items-center gap-1.5 text-content-secondary min-w-0">
          <PlatformBadge platform={sourcePlatform} />
          <ChannelLabel
            name={message.source.channel_name}
            id={message.source.channel}
          />
          <svg
            className="w-3.5 h-3.5 text-content-tertiary flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
          <PlatformBadge platform={destPlatform} />
          <ChannelLabel
            name={message.destination.channel_name}
            id={message.destination.channel}
          />
        </div>

        {/* 재시도 횟수 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {message.retry_count !== undefined && message.retry_count > 0 && (
            <span className="text-orange-500 dark:text-orange-400 font-medium">
              재시도 {message.retry_count}회
            </span>
          )}
          {message.delivered_at && (
            <span className="text-content-tertiary">
              전달:{" "}
              <time
                dateTime={message.delivered_at}
                title={formatExactTime(message.delivered_at)}
              >
                {formatRelativeTime(message.delivered_at)}
              </time>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
