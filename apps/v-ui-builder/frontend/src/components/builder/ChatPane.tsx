/**
 * ChatPane — Sandpack/GenUI 공용 채팅 패널 (VS Code 하단 "터미널" 패널을 우측 도킹으로 재현).
 *
 * scope 로 동작 모드를 분기:
 *  - "project"   : Sandpack Builder. `useChatStream` + `useBuilderStore`. 스냅샷 컨텍스트 첨부,
 *                  UiCallCard pin-drag, artifact/파일 스트리밍.
 *  - "dashboard" : Generative UI. `useDashboardChat` + `useDashboardStore`.
 *                  선택된 위젯 포커스 칩, pendingChatPrompt 자동 전송, op 요약.
 *
 * 셸(헤더 / 메시지 리스트 / 입력)과 메시지 버블 · 날짜 그룹핑 · 마크다운 렌더 · 타임스탬프는
 * 두 모드가 공유하여 UX 개선이 동시에 반영되도록 한다.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ChevronUp, Paperclip, Pin, Square, X } from "lucide-react";

import { useBuilderStore } from "../../store/builder";
import { useDashboardStore } from "../../store/dashboard";
import { useChatStream } from "../../hooks/useChatStream";
import { useDashboardChat } from "../../hooks/useDashboardChat";
import {
  uiBuilderApi,
  type Message,
  type SnapshotListItem,
  type UiCallRecord,
} from "../../lib/api/ui-builder";
import {
  dashboardsApi,
  PIN_DRAG_MIME,
  type PinDragPayload,
} from "../../lib/api/dashboards";
import { MarkdownMessage } from "./MarkdownMessage";
import { GenUiRenderer } from "./gen-ui/GenUiRenderer";
import { UiActionScopeProvider } from "./gen-ui/UiActionScope";

export type ChatScope = "project" | "dashboard";

interface ChatPaneProps {
  scope: ChatScope;
  projectId: string;
  onClose?: () => void;
}

const snapshotsKey = (projectId: string) =>
  ["ui-builder", "snapshots", projectId] as const;

const dashboardMessagesKey = (projectId: string) =>
  ["ui-builder", "dashboard-messages", projectId] as const;

export function ChatPane({ scope, projectId, onClose }: ChatPaneProps) {
  const isDashboard = scope === "dashboard";

  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [contextIds, setContextIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pickerWrapRef = useRef<HTMLDivElement>(null);
  // 전송 중 onError 가 호출되었는지 감지해 질문/컨텍스트를 되돌리기 위한 플래그.
  const errorOccurredRef = useRef(false);
  const handleStreamError = (msg: string) => {
    errorOccurredRef.current = true;
    setError(msg);
  };

  // ── Project scope sources (builder store / snapshots / /api/chat) ─────────
  const projectMessages = useBuilderStore((s) => s.messages);
  const streamingBuffer = useBuilderStore((s) => s.streamingBuffer);
  const streamingUiCalls = useBuilderStore((s) => s.streamingUiCalls);
  const uiCallsByMessageId = useBuilderStore((s) => s.uiCallsByMessageId);
  const projectIsStreaming = useBuilderStore((s) => s.isStreaming);

  const { data: snapshots } = useQuery({
    queryKey: snapshotsKey(projectId),
    queryFn: () => uiBuilderApi.listSnapshots(projectId),
    enabled: !isDashboard,
  });

  const projectChat = useChatStream({
    projectId,
    onError: handleStreamError,
  });

  // ── Dashboard scope sources (dashboard store / messages query / /dashboard/chat)
  const selectedWidgetIds = useDashboardStore((s) => s.selectedWidgetIds);
  const clearSelection = useDashboardStore((s) => s.clearSelection);
  const widgets = useDashboardStore((s) => s.dashboard?.widgets ?? []);
  const pendingChatPrompt = useDashboardStore((s) => s.pendingChatPrompt);
  const setPendingChatPrompt = useDashboardStore(
    (s) => s.setPendingChatPrompt,
  );

  const { data: dashboardMessages = [] } = useQuery({
    queryKey: dashboardMessagesKey(projectId),
    queryFn: () => dashboardsApi.listDashboardMessages(projectId),
    enabled: isDashboard,
  });

  const dashboardChat = useDashboardChat({
    projectId,
    onError: handleStreamError,
  });

  // ── Adapter: 공용 지표로 정규화 ───────────────────────────────────────────
  const messages = isDashboard ? dashboardMessages : projectMessages;
  const isStreaming = isDashboard
    ? dashboardChat.isStreaming
    : projectIsStreaming;
  const streamingContent = isDashboard
    ? (dashboardChat.streaming?.content ?? "")
    : streamingBuffer;
  const streamingOpCount = isDashboard
    ? (dashboardChat.streaming?.opCount ?? 0)
    : 0;
  const streamingOpErrors = isDashboard
    ? (dashboardChat.streaming?.opErrors ?? [])
    : [];
  const abort = isDashboard ? dashboardChat.abort : projectChat.abort;

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, streamingContent, streamingOpCount]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleClickAway = (e: MouseEvent) => {
      if (!pickerWrapRef.current) return;
      if (!pickerWrapRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [pickerOpen]);

  useEffect(() => {
    if (isDashboard) return;
    if (!snapshots || contextIds.length === 0) return;
    const alive = new Set(snapshots.map((s) => s.id));
    const next = contextIds.filter((id) => alive.has(id));
    if (next.length !== contextIds.length) setContextIds(next);
  }, [isDashboard, snapshots, contextIds]);

  useEffect(() => {
    if (!isDashboard) return;
    if (!pendingChatPrompt || isStreaming) return;
    const text = pendingChatPrompt;
    setPendingChatPrompt(null);
    setError(null);
    void dashboardChat.send(text, { selectedWidgetIds });
  }, [
    isDashboard,
    pendingChatPrompt,
    isStreaming,
    dashboardChat,
    selectedWidgetIds,
    setPendingChatPrompt,
  ]);

  const snapshotById = new Map<string, SnapshotListItem>(
    (snapshots ?? []).map((s) => [s.id, s]),
  );
  const attachedChips = contextIds
    .map((id) => snapshotById.get(id))
    .filter((s): s is SnapshotListItem => Boolean(s));
  const selectedWidgets = widgets.filter((w) =>
    selectedWidgetIds.includes(w.id),
  );

  const toggleContext = (id: string) => {
    setContextIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const removeContext = (id: string) => {
    setContextIds((prev) => prev.filter((x) => x !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isStreaming) return;
    const value = prompt;
    setPrompt("");
    setError(null);
    errorOccurredRef.current = false;
    if (isDashboard) {
      await dashboardChat.send(value, { selectedWidgetIds });
      if (errorOccurredRef.current) {
        setPrompt((curr) => (curr ? curr : value));
      }
    } else {
      const ids = contextIds;
      setContextIds([]);
      setPickerOpen(false);
      await projectChat.send(
        value,
        ids.length > 0 ? { contextSnapshotIds: ids } : undefined,
      );
      if (errorOccurredRef.current) {
        setPrompt((curr) => (curr ? curr : value));
        if (ids.length > 0) {
          setContextIds((curr) => (curr.length > 0 ? curr : ids));
        }
      }
    }
  };

  const title = isDashboard ? "Dashboard Chat" : "Chat";
  const emptyHead = isDashboard
    ? "대시보드 조작을 자연어로 요청하세요."
    : "UI 생성 요청을 입력하세요.";
  const emptyExamples = isDashboard
    ? '예시: "애플 주가 차트 추가", "현재 위젯 2열로 재배치"'
    : '예시: "로그인 폼 만들어줘", "대시보드 카드 3개 배치"';
  const inputPlaceholder = isDashboard
    ? selectedWidgets.length > 0
      ? "선택한 위젯을 어떻게 바꿀까요? (Enter 전송 · Shift+Enter 줄바꿈)"
      : "대시보드에 무엇을 추가할까요? (Enter 전송 · Shift+Enter 줄바꿈)"
    : attachedChips.length > 0
      ? "첨부된 스냅샷을 참고하여 요청을 작성하세요…"
      : "프롬프트 입력 (Enter 전송 · Shift+Enter 줄바꿈)";

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface-card text-content-primary">
      {/* Panel header */}
      <div className="flex items-stretch justify-between h-9 bg-[var(--color-surface-chrome)] border-b border-[var(--color-surface-chrome-border)]">
        <div className="flex items-center">
          <div className="relative h-full inline-flex items-center px-3 text-[11px] uppercase tracking-wider text-content-primary font-medium">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-brand-600" />
            {title}
          </div>
        </div>
        <div className="flex items-center pr-1">
          {isStreaming && (
            <button
              type="button"
              onClick={abort}
              title="생성 중지"
              className="inline-flex items-center gap-1 text-[11px] text-status-danger hover:text-content-primary hover:bg-surface-overlay px-2 py-1 rounded-button transition-colors"
            >
              <Square size={11} />
              중지
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="채팅 닫기"
              title="채팅 닫기"
              className="p-1 text-content-secondary hover:text-content-primary hover:bg-surface-overlay rounded-button transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages (self-scroll) */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 space-y-2 text-[12.5px] leading-relaxed"
      >
        {messages.length === 0 && !isStreaming && (
          <div className="text-[11px] text-content-tertiary font-mono">
            <span className="text-brand-500">$</span> {emptyHead}
            <div className="mt-1 text-content-tertiary/80">{emptyExamples}</div>
          </div>
        )}

        <MessageGroups
          scope={scope}
          messages={messages}
          uiCallsByMessageId={uiCallsByMessageId}
        />

        {isStreaming && (
          <MessageBubble
            scope={scope}
            role="assistant"
            content={streamingContent || "…"}
            uiCalls={isDashboard ? [] : streamingUiCalls}
            streamingOpCount={streamingOpCount}
            streamingOpErrors={streamingOpErrors}
            streaming
          />
        )}

        {error && (
          <div className="text-[11px] text-status-danger bg-status-danger-light border border-status-danger-border rounded-button px-2 py-1.5 font-mono">
            {error}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-line p-2 bg-surface-card"
      >
        {isDashboard && selectedWidgets.length > 0 && (
          <div className="mb-1.5 flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="text-content-tertiary">포커스:</span>
            {selectedWidgets.map((w) => (
              <span
                key={w.id}
                className="inline-flex items-center gap-1 rounded-button bg-brand-500/10 text-brand-500 px-1.5 py-0.5 font-mono"
              >
                {w.tool}
                <span className="text-content-tertiary">
                  {w.id.slice(0, 6)}
                </span>
              </span>
            ))}
            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto inline-flex items-center gap-1 text-content-tertiary hover:text-content-primary"
              title="선택 해제"
            >
              <X size={11} /> 해제
            </button>
          </div>
        )}

        {!isDashboard && attachedChips.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {attachedChips.map((snap) => (
              <ContextChip
                key={snap.id}
                snap={snap}
                onRemove={() => removeContext(snap.id)}
              />
            ))}
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          placeholder={inputPlaceholder}
          rows={3}
          disabled={isStreaming}
          className="w-full resize-none rounded-input border border-line-heavy bg-surface-page text-content-primary placeholder:text-content-tertiary px-2 py-1.5 text-[12.5px] font-mono focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 disabled:opacity-60 transition-colors"
        />

        <div className="flex items-center justify-between mt-1.5 gap-2">
          {!isDashboard ? (
            <div className="relative" ref={pickerWrapRef}>
              <button
                type="button"
                onClick={() => setPickerOpen((v) => !v)}
                disabled={isStreaming}
                title="스냅샷을 컨텍스트로 첨부"
                aria-label="컨텍스트 첨부"
                className={`inline-flex items-center gap-1 rounded-button px-2 py-1 text-[11px] transition-colors disabled:opacity-40 ${
                  pickerOpen || contextIds.length > 0
                    ? "bg-brand-500/15 text-brand-500 hover:bg-brand-500/25"
                    : "text-content-secondary hover:text-content-primary hover:bg-surface-overlay"
                }`}
              >
                <Paperclip size={12} />
                컨텍스트
                {contextIds.length > 0 && (
                  <span className="ml-0.5 rounded-full bg-brand-600 text-content-inverse text-[9.5px] leading-none px-1.5 py-0.5">
                    {contextIds.length}
                  </span>
                )}
                <ChevronUp
                  size={12}
                  className={`transition-transform ${
                    pickerOpen ? "" : "rotate-180"
                  }`}
                />
              </button>

              {pickerOpen && (
                <ContextPicker
                  snapshots={snapshots ?? []}
                  selectedIds={contextIds}
                  onToggle={toggleContext}
                  onClear={() => setContextIds([])}
                />
              )}
            </div>
          ) : (
            <span />
          )}

          <button
            type="submit"
            disabled={!prompt.trim() || isStreaming}
            className="rounded-button bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1 text-[11px] font-medium text-content-inverse transition-colors"
          >
            {isStreaming ? "생성 중…" : "전송"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface ContextChipProps {
  snap: SnapshotListItem;
  onRemove: () => void;
}

function ContextChip({ snap, onRemove }: ContextChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-brand-500/40 bg-brand-500/10 text-content-primary pl-2 pr-1 py-0.5 text-[10.5px] max-w-[220px]"
      title={`${snap.slug} · ${snap.title}`}
    >
      <span className="font-mono text-[9.5px] text-brand-500 shrink-0">
        {snap.slug}
      </span>
      <span className="truncate">{snap.title}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="첨부 제거"
        className="rounded-full p-0.5 text-content-tertiary hover:text-content-primary hover:bg-surface-overlay"
      >
        <X size={10} />
      </button>
    </span>
  );
}

interface ContextPickerProps {
  snapshots: SnapshotListItem[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

function ContextPicker({
  snapshots,
  selectedIds,
  onToggle,
  onClear,
}: ContextPickerProps) {
  const selected = new Set(selectedIds);

  return (
    <div className="absolute bottom-full left-0 mb-1 w-72 max-h-64 overflow-hidden rounded-button border border-line-heavy bg-surface-card shadow-lg z-20 flex flex-col">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-line text-[10.5px] uppercase tracking-wider text-content-tertiary">
        <span>스냅샷 첨부</span>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10.5px] normal-case tracking-normal text-content-secondary hover:text-status-danger"
          >
            모두 해제
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto py-1">
        {snapshots.length === 0 && (
          <div className="px-2 py-2 text-[11px] text-content-tertiary">
            아직 생성된 스냅샷이 없습니다.
          </div>
        )}
        {snapshots.map((snap) => {
          const isOn = selected.has(snap.id);
          const created = new Date(snap.created_at);
          return (
            <button
              key={snap.id}
              type="button"
              onClick={() => onToggle(snap.id)}
              className={`w-full flex items-start gap-2 px-2 py-1.5 text-left transition-colors ${
                isOn ? "bg-brand-500/10" : "hover:bg-surface-overlay"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border ${
                  isOn
                    ? "bg-brand-600 border-brand-600 text-content-inverse"
                    : "border-line-heavy text-transparent"
                }`}
                aria-hidden
              >
                <svg
                  viewBox="0 0 10 10"
                  className="h-2.5 w-2.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M1.5 5.5 4 8l4.5-6" strokeLinecap="round" />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[9.5px] text-content-tertiary shrink-0">
                    {snap.slug}
                  </span>
                  <span className="truncate text-[11.5px] text-content-primary">
                    {snap.title}
                  </span>
                </span>
                <span className="block text-[9.5px] text-content-tertiary">
                  {created.toLocaleDateString()}{" "}
                  {created.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  scope: ChatScope;
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
  timestamp?: string;
  uiCalls?: UiCallRecord[];
  /** 영속 메시지 id. 스트리밍 중(임시 버블)엔 undefined. */
  messageId?: string;
  /** 대시보드 스트리밍 중 op 진행 요약. */
  streamingOpCount?: number;
  streamingOpErrors?: string[];
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDateLabel(key: string): string {
  if (key === "unknown") return "날짜 미상";
  const [y, m, d] = key.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const today = startOfDay(new Date());
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / 86_400_000,
  );
  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  const weekday = target.toLocaleDateString("ko-KR", { weekday: "short" });
  if (y === today.getFullYear()) return `${m}월 ${d}일 (${weekday})`;
  return `${y}년 ${m}월 ${d}일 (${weekday})`;
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);

  const hm = d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    if (diffMin < 1) return "방금 전";
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHour < 24) return `${diffHour}시간 전`;
    return `오늘 ${hm}`;
  }

  const yesterday = startOfDay(new Date(now.getTime() - 86_400_000));
  const targetDay = startOfDay(d);
  if (targetDay.getTime() === yesterday.getTime()) return `어제 ${hm}`;

  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  if (y === now.getFullYear()) return `${mm}-${dd} ${hm}`;
  return `${y}-${mm}-${dd} ${hm}`;
}

interface MessageGroup {
  key: string;
  label: string;
  messages: Message[];
}

function groupMessagesByDate(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const m of messages) {
    const key = getDateKey(m.created_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.messages.push(m);
    } else {
      groups.push({ key, label: getDateLabel(key), messages: [m] });
    }
  }
  return groups;
}

interface MessageGroupsProps {
  scope: ChatScope;
  messages: Message[];
  uiCallsByMessageId: Record<string, UiCallRecord[]>;
}

function MessageGroups({
  scope,
  messages,
  uiCallsByMessageId,
}: MessageGroupsProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groups = groupMessagesByDate(messages);

  const toggle = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.key);
        return (
          <div key={g.key} className="space-y-2">
            <button
              type="button"
              onClick={() => toggle(g.key)}
              aria-expanded={!isCollapsed}
              className="group/divider flex w-full items-center gap-2 py-1 text-[10px] uppercase tracking-wider font-mono text-content-tertiary hover:text-content-secondary transition-colors"
            >
              <span className="h-px flex-1 bg-line" />
              <span className="flex items-center gap-1 px-1">
                {isCollapsed ? (
                  <ChevronRight size={10} className="opacity-70" />
                ) : (
                  <ChevronDown size={10} className="opacity-70" />
                )}
                <span>{g.label}</span>
                <span className="normal-case tracking-normal text-content-tertiary/70">
                  ({g.messages.length})
                </span>
              </span>
              <span className="h-px flex-1 bg-line" />
            </button>
            {!isCollapsed &&
              g.messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  scope={scope}
                  role={m.role}
                  content={m.content}
                  timestamp={m.created_at}
                  uiCalls={uiCallsByMessageId[m.id] ?? m.ui_calls}
                  messageId={m.id}
                />
              ))}
          </div>
        );
      })}
    </>
  );
}

function MessageBubble({
  scope,
  role,
  content,
  streaming,
  timestamp,
  uiCalls,
  messageId,
  streamingOpCount = 0,
  streamingOpErrors = [],
}: MessageBubbleProps) {
  const isUser = role === "user";
  const isDashboard = scope === "dashboard";
  const [collapsed, setCollapsed] = useState(false);
  const canCollapse = !streaming;
  const isCollapsed = canCollapse && collapsed;
  const timeLabel = timestamp ? formatMessageTime(timestamp) : "";

  const calls = uiCalls ?? [];
  const okCount = calls.filter((c) => c.status === "ok").length;
  const errorCalls = calls.filter((c) => c.status === "error");

  // 대시보드 모드는 조작이 캔버스에 직접 반영되므로 개별 카드 대신 op 요약만 노출.
  const showUiCards = !isDashboard && !isUser && calls.length > 0;
  const showDashboardOps =
    isDashboard && !isUser && (okCount > 0 || errorCalls.length > 0);
  const showStreamingDashboardOps =
    isDashboard &&
    !isUser &&
    streaming &&
    (streamingOpCount > 0 || streamingOpErrors.length > 0);

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => canCollapse && setCollapsed((v) => !v)}
        disabled={!canCollapse}
        aria-expanded={!isCollapsed}
        className="flex items-center gap-1 self-start text-[10px] uppercase tracking-wider font-mono text-content-tertiary hover:text-content-secondary disabled:hover:text-content-tertiary disabled:cursor-default transition-colors"
      >
        {canCollapse &&
          (isCollapsed ? (
            <ChevronRight size={10} className="opacity-70" />
          ) : (
            <ChevronDown size={10} className="opacity-70" />
          ))}
        {isUser ? (
          <span className="text-brand-500">user ›</span>
        ) : (
          <span className="text-status-success">assistant ›</span>
        )}
        {timeLabel && (
          <span className="normal-case tracking-normal text-content-tertiary/70">
            {timeLabel}
          </span>
        )}
      </button>
      {!isCollapsed &&
        (isUser ? (
          <div className="whitespace-pre-wrap break-words rounded-button px-2 py-1.5 bg-brand-600 text-content-inverse">
            {content}
            {streaming && <span className="animate-pulse">▍</span>}
          </div>
        ) : (
          <div className="rounded-button bg-surface-raised text-content-primary border border-line px-2 py-1.5">
            <MarkdownMessage content={content} streaming={streaming} />
            {streaming && <span className="animate-pulse text-brand-500">▍</span>}
          </div>
        ))}

      {!isCollapsed && showUiCards && (
        <div className="mt-1 flex flex-col gap-1">
          {calls.map((call) => (
            <UiCallCard key={call.call_id} call={call} messageId={messageId} />
          ))}
        </div>
      )}

      {!isCollapsed && showDashboardOps && (
        <div className="mt-1 space-y-0.5">
          {okCount > 0 && (
            <div className="text-[10.5px] text-content-tertiary font-mono">
              {okCount} 개 조작 적용됨
            </div>
          )}
          {errorCalls.map((c) => (
            <div
              key={c.call_id}
              className="text-[10.5px] text-status-danger font-mono"
            >
              {c.tool}: {c.error ?? "op error"}
            </div>
          ))}
        </div>
      )}

      {!isCollapsed && showStreamingDashboardOps && (
        <div className="mt-1 space-y-0.5">
          {streamingOpCount > 0 && (
            <div className="text-[10.5px] text-content-tertiary font-mono">
              {streamingOpCount} 개 조작 적용됨
            </div>
          )}
          {streamingOpErrors.map((e, i) => (
            <div
              key={i}
              className="text-[10.5px] text-status-danger font-mono"
            >
              {e}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface UiCallCardProps {
  call: UiCallRecord;
  messageId?: string;
}

function UiCallCard({ call, messageId }: UiCallCardProps) {
  const statusStyle =
    call.status === "error"
      ? "border-status-danger-border bg-status-danger-light text-status-danger"
      : call.status === "loading"
        ? "border-line-heavy bg-surface-page text-content-tertiary"
        : "border-brand-500/40 bg-brand-500/5 text-content-primary";

  const canPin =
    call.status === "ok" &&
    Boolean(messageId) &&
    Boolean(call.component) &&
    Boolean(call.props);

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>) => {
    if (!canPin || !call.component || !call.props) return;
    const payload: PinDragPayload = {
      call_id: call.call_id,
      tool: call.tool,
      component: call.component,
      props: call.props,
      source_message_id: messageId ?? null,
    };
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(PIN_DRAG_MIME, JSON.stringify(payload));
  };

  return (
    <div
      className={`rounded-button border px-2 py-1.5 text-[11px] font-mono ${statusStyle}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate">
          <span className="text-content-tertiary">tool ›</span>{" "}
          <span className="text-content-primary">{call.tool}</span>
          {call.component && (
            <span className="text-content-tertiary">
              {" "}
              · <span className="text-content-secondary">{call.component}</span>
            </span>
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {canPin && (
            <button
              type="button"
              draggable
              onDragStart={handleDragStart}
              title="대시보드로 드래그하여 고정"
              aria-label="대시보드로 드래그하여 고정"
              className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center p-0.5 rounded-button text-content-tertiary hover:text-brand-500 hover:bg-surface-overlay transition-colors"
            >
              <Pin size={12} />
            </button>
          )}
          <span className="text-[9.5px] uppercase tracking-wider text-content-tertiary">
            {call.status}
          </span>
        </div>
      </div>
      {call.status === "error" && call.error && (
        <div className="mt-1 whitespace-pre-wrap break-words text-status-danger">
          {call.error}
        </div>
      )}
      {call.status === "ok" && call.component && call.props && (
        <div className="mt-2">
          {messageId ? (
            <UiActionScopeProvider value={{ kind: "message", messageId }}>
              <GenUiRenderer call={call} />
            </UiActionScopeProvider>
          ) : (
            <GenUiRenderer call={call} />
          )}
        </div>
      )}
    </div>
  );
}
