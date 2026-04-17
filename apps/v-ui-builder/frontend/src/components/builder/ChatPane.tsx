/**
 * ChatPane — 대화 버블 리스트 + 프롬프트 입력.
 *
 * 스트리밍 중에는 store.streamingBuffer 를 임시 assistant 버블로 렌더한다.
 */

import { useEffect, useRef, useState } from "react";

import { useBuilderStore } from "../../store/builder";
import { useChatStream } from "../../hooks/useChatStream";

interface ChatPaneProps {
  projectId: string;
}

export function ChatPane({ projectId }: ChatPaneProps) {
  const messages = useBuilderStore((s) => s.messages);
  const streamingBuffer = useBuilderStore((s) => s.streamingBuffer);
  const isStreaming = useBuilderStore((s) => s.isStreaming);

  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isStreaming) return;
    const value = prompt;
    setPrompt("");
    setError(null);
    await send(value);
  };

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold">Chat</h2>
        {isStreaming && (
          <button
            type="button"
            onClick={abort}
            className="text-xs text-red-500 hover:underline"
          >
            중지
          </button>
        )}
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 text-sm"
      >
        {messages.length === 0 && !isStreaming && (
          <div className="text-xs text-gray-400">
            UI 생성 요청을 입력하세요. 예: "로그인 폼을 만들어줘"
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
          <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950 rounded p-2">
            {error}
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t p-3 flex flex-col gap-2"
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          placeholder="만들고 싶은 UI 를 설명하세요 (Enter 전송, Shift+Enter 줄바꿈)"
          rows={3}
          disabled={isStreaming}
          className="w-full resize-none rounded border border-gray-300 dark:border-gray-700 bg-transparent p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!prompt.trim() || isStreaming}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isStreaming ? "생성 중…" : "전송"}
          </button>
        </div>
      </form>
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
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 whitespace-pre-wrap break-words ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        }`}
      >
        {content}
        {streaming && <span className="animate-pulse">▍</span>}
      </div>
    </div>
  );
}
