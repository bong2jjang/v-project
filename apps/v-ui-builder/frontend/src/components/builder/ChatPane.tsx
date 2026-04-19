/**
 * ChatPane — VS Code 하단 "터미널" 패널을 우측 도킹 형태로 재현.
 *
 * 상단 헤더(CHAT 타이틀 + 중지/닫기 버튼), 가운데 메시지 리스트(자체 스크롤),
 * 하단 입력창(자체 높이)로 구성. 외부 스크롤을 만들지 않는다.
 * 스트리밍 중에는 store.streamingBuffer 를 임시 assistant 버블로 렌더한다.
 *
 * 컨텍스트 첨부 (Gemini @멘션 UX 참고):
 *  - 입력창 상단에 첨부된 스냅샷 칩 목록을 렌더.
 *  - 좌측 하단 📎 버튼 → 팝오버로 스냅샷 목록에서 멀티 선택.
 *  - 전송 시 context_snapshot_ids 로 함께 전달하고 칩을 비움.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronUp, Paperclip, Square, X } from "lucide-react";

import { useBuilderStore } from "../../store/builder";
import { useChatStream } from "../../hooks/useChatStream";
import { uiBuilderApi, type SnapshotListItem } from "../../lib/api/ui-builder";
import { MarkdownMessage } from "./MarkdownMessage";

interface ChatPaneProps {
  projectId: string;
  onClose?: () => void;
}

const snapshotsKey = (projectId: string) =>
  ["ui-builder", "snapshots", projectId] as const;

export function ChatPane({ projectId, onClose }: ChatPaneProps) {
  const messages = useBuilderStore((s) => s.messages);
  const streamingBuffer = useBuilderStore((s) => s.streamingBuffer);
  const isStreaming = useBuilderStore((s) => s.isStreaming);

  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [contextIds, setContextIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pickerWrapRef = useRef<HTMLDivElement>(null);

  const { data: snapshots } = useQuery({
    queryKey: snapshotsKey(projectId),
    queryFn: () => uiBuilderApi.listSnapshots(projectId),
  });

  const { send, abort } = useChatStream({
    projectId,
    onError: (msg) => setError(msg),
  });

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, streamingBuffer]);

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

  // 삭제된 스냅샷이 칩에 남지 않도록 살아있는 목록과 교집합만 유지.
  useEffect(() => {
    if (!snapshots || contextIds.length === 0) return;
    const alive = new Set(snapshots.map((s) => s.id));
    const next = contextIds.filter((id) => alive.has(id));
    if (next.length !== contextIds.length) setContextIds(next);
  }, [snapshots, contextIds]);

  const snapshotById = new Map<string, SnapshotListItem>(
    (snapshots ?? []).map((s) => [s.id, s]),
  );
  const attachedChips = contextIds
    .map((id) => snapshotById.get(id))
    .filter((s): s is SnapshotListItem => Boolean(s));

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
    const ids = contextIds;
    setPrompt("");
    setContextIds([]);
    setPickerOpen(false);
    setError(null);
    await send(value, ids.length > 0 ? { contextSnapshotIds: ids } : undefined);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface-card text-content-primary">
      {/* Panel header */}
      <div className="flex items-stretch justify-between h-9 bg-[var(--color-surface-chrome)] border-b border-[var(--color-surface-chrome-border)]">
        <div className="flex items-center">
          <div className="relative h-full inline-flex items-center px-3 text-[11px] uppercase tracking-wider text-content-primary font-medium">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-brand-600" />
            Chat
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
            <span className="text-brand-500">$</span> UI 생성 요청을 입력하세요.
            <div className="mt-1 text-content-tertiary/80">
              예시: "로그인 폼 만들어줘", "대시보드 카드 3개 배치"
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} />
        ))}

        {isStreaming && (
          <MessageBubble
            role="assistant"
            content={streamingBuffer || "…"}
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
        {attachedChips.length > 0 && (
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
          placeholder={
            attachedChips.length > 0
              ? "첨부된 스냅샷을 참고하여 요청을 작성하세요…"
              : "프롬프트 입력 (Enter 전송 · Shift+Enter 줄바꿈)"
          }
          rows={3}
          disabled={isStreaming}
          className="w-full resize-none rounded-input border border-line-heavy bg-surface-page text-content-primary placeholder:text-content-tertiary px-2 py-1.5 text-[12.5px] font-mono focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/40 disabled:opacity-60 transition-colors"
        />

        <div className="flex items-center justify-between mt-1.5 gap-2">
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
  role: "user" | "assistant" | "system";
  content: string;
  streaming?: boolean;
}

function MessageBubble({ role, content, streaming }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10px] uppercase tracking-wider font-mono text-content-tertiary">
        {isUser ? (
          <span className="text-brand-500">user ›</span>
        ) : (
          <span className="text-status-success">assistant ›</span>
        )}
      </div>
      {isUser ? (
        <div className="whitespace-pre-wrap break-words rounded-button px-2 py-1.5 bg-brand-600 text-content-inverse">
          {content}
          {streaming && <span className="animate-pulse">▍</span>}
        </div>
      ) : (
        <div className="rounded-button bg-surface-raised text-content-primary border border-line px-2 py-1.5">
          <MarkdownMessage content={content} streaming={streaming} />
          {streaming && <span className="animate-pulse text-brand-500">▍</span>}
        </div>
      )}
    </div>
  );
}
