/**
 * Builder — VS Code 스타일 쉘.
 *
 * - 메인: Canvas(Preview/Code 통합 탭 바 + 에디터/미리보기 콘텐츠)
 * - 우측 도킹: ChatPane (VS Code 터미널 패널 룩, 기본 열림, 드래그 리사이즈)
 * - 콘텐츠 영역은 외부 스크롤을 만들지 않고, 내부 컨트롤(Editor/Preview/메시지/입력)이 자체 스크롤만 가진다.
 *
 * URL 의 projectId 로 프로젝트 상세를 불러와 store 를 초기화. 이후 ChatPane 의 SSE 훅이 store 를 실시간 갱신한다.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { History, MessageSquare } from "lucide-react";

import { ChatPane } from "../components/builder/ChatPane";
import { CanvasPane } from "../components/builder/CanvasPane";
import { SnapshotsPanel } from "../components/builder/SnapshotsPanel";
import { BuilderToolbar } from "../components/builder/BuilderToolbar";
import { uiBuilderApi } from "../lib/api/ui-builder";
import { useBuilderStore } from "../store/builder";

const MIN_CHAT_WIDTH = 280;
const MAX_CHAT_WIDTH = 800;
const DEFAULT_CHAT_WIDTH = 420;
const MIN_SNAP_WIDTH = 220;
const MAX_SNAP_WIDTH = 500;
const DEFAULT_SNAP_WIDTH = 280;
const BUILDER_ROUTE_FLAG = "builder-editor";

export default function Builder() {
  const { projectId } = useParams<{ projectId: string }>();
  const setProject = useBuilderStore((s) => s.setProject);
  const setMessages = useBuilderStore((s) => s.setMessages);
  const setArtifacts = useBuilderStore((s) => s.setArtifacts);

  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [snapOpen, setSnapOpen] = useState(false);
  const [snapWidth, setSnapWidth] = useState(DEFAULT_SNAP_WIDTH);

  const dragStateRef = useRef<{
    startX: number;
    startWidth: number;
    apply: (next: number) => void;
    min: number;
    max: number;
    direction: "left" | "right";
  } | null>(null);

  const startDrag = useCallback(
    (
      e: React.MouseEvent,
      opts: {
        startWidth: number;
        apply: (next: number) => void;
        min: number;
        max: number;
        direction: "left" | "right";
      },
    ) => {
      e.preventDefault();
      dragStateRef.current = { startX: e.clientX, ...opts };

      const onMove = (ev: MouseEvent) => {
        if (!dragStateRef.current) return;
        const { startX, startWidth, apply, min, max, direction } =
          dragStateRef.current;
        const dx = ev.clientX - startX;
        const next = direction === "right" ? startWidth + dx : startWidth - dx;
        apply(Math.max(min, Math.min(max, next)));
      };
      const onUp = () => {
        dragStateRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [],
  );

  const handleChatDragStart = useCallback(
    (e: React.MouseEvent) =>
      startDrag(e, {
        startWidth: chatWidth,
        apply: setChatWidth,
        min: MIN_CHAT_WIDTH,
        max: MAX_CHAT_WIDTH,
        direction: "left",
      }),
    [chatWidth, startDrag],
  );

  const handleSnapDragStart = useCallback(
    (e: React.MouseEvent) =>
      startDrag(e, {
        startWidth: snapWidth,
        apply: setSnapWidth,
        min: MIN_SNAP_WIDTH,
        max: MAX_SNAP_WIDTH,
        direction: "right",
      }),
    [snapWidth, startDrag],
  );

  useEffect(() => {
    document.body.setAttribute("data-route", BUILDER_ROUTE_FLAG);
    return () => document.body.removeAttribute("data-route");
  }, []);

  useEffect(() => {
    if (!projectId || projectId === "new") return;
    let alive = true;

    setProject(null);
    setMessages([]);

    (async () => {
      try {
        const detail = await uiBuilderApi.getProject(projectId);
        if (!alive) return;
        setProject(detail);
        setMessages(detail.messages ?? []);
        setArtifacts(detail.artifacts ?? []);
      } catch (err) {
        console.error("[Builder] Failed to load project", err);
      }
    })();

    return () => {
      alive = false;
    };
  }, [projectId, setProject, setMessages, setArtifacts]);

  if (!projectId || projectId === "new") {
    return (
      <div className="h-full bg-surface-page text-content-secondary flex items-center justify-center text-sm">
        대시보드에서 프로젝트를 선택하거나 새로 만드세요.
      </div>
    );
  }

  const toolbarLeft = (
    <button
      type="button"
      onClick={() => setSnapOpen((v) => !v)}
      title={snapOpen ? "스냅샷 닫기" : "스냅샷 열기"}
      className={`inline-flex items-center gap-1 rounded-button px-2 py-1 text-[11px] transition-colors ${
        snapOpen
          ? "bg-surface-overlay text-content-primary"
          : "text-content-secondary hover:text-content-primary hover:bg-surface-overlay"
      }`}
    >
      <History size={12} />
      스냅샷
    </button>
  );

  const toolbarRight = (
    <button
      type="button"
      onClick={() => setChatOpen((v) => !v)}
      title={chatOpen ? "채팅 닫기" : "채팅 열기"}
      className={`inline-flex items-center gap-1 rounded-button px-2 py-1 text-[11px] transition-colors ${
        chatOpen
          ? "bg-surface-overlay text-content-primary"
          : "bg-brand-600 text-content-inverse hover:bg-brand-700"
      }`}
    >
      <MessageSquare size={12} />
      채팅
    </button>
  );

  return (
    <div className="h-full bg-surface-page flex flex-col overflow-hidden">
      <BuilderToolbar left={toolbarLeft} right={toolbarRight} />

      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {snapOpen && (
          <>
            <div
              className="h-full shrink-0 overflow-hidden border-r border-line max-md:absolute max-md:inset-0 max-md:z-30 max-md:!w-full max-md:border-r-0 max-md:bg-surface-page"
              style={{ width: snapWidth }}
            >
              <SnapshotsPanel
                projectId={projectId}
                onClose={() => setSnapOpen(false)}
              />
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              onMouseDown={handleSnapDragStart}
              className="hidden md:block w-[3px] shrink-0 cursor-col-resize bg-surface-page hover:bg-brand-600 transition-colors"
            />
          </>
        )}

        <div
          className={`flex-1 min-w-0 h-full overflow-hidden ${chatOpen ? "max-md:hidden" : ""}`}
        >
          <CanvasPane />
        </div>

        {chatOpen && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              onMouseDown={handleChatDragStart}
              className="hidden md:block w-[3px] shrink-0 cursor-col-resize bg-surface-page hover:bg-brand-600 transition-colors"
            />
            <div
              className="h-full shrink-0 overflow-hidden border-l border-line max-md:!w-full max-md:border-l-0"
              style={{ width: chatWidth }}
            >
              <ChatPane
                scope="project"
                projectId={projectId}
                onClose={() => setChatOpen(false)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
