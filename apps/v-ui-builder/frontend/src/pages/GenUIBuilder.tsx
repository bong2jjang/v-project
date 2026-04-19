/**
 * GenUIBuilder — Generative UI(`project_type='genui'`) 프로젝트 전용 쉘.
 *
 * - 메인: DashboardCanvas (react-grid-layout 위젯 보드)
 * - 우측 도킹: ChatPane (scope="dashboard") — Sandpack Builder 와 공용, 모드만 분기.
 *   기본 열림, 드래그 리사이즈.
 * - Sandpack Builder 와 달리 스냅샷 개념이 없으므로 SnapshotsPanel / 좌측 토글은 없음.
 *
 * `useParams.projectId` 가 sandpack 프로젝트라면 백엔드가 404 를 반환하여
 * DashboardCanvas 쪽에서 에러 상태로 노출된다 (ProjectService.get_owned 가
 * expected_type='genui' 로 가드).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { MessageSquare } from "lucide-react";

import { DashboardCanvas } from "../components/builder/dashboard/DashboardCanvas";
import { ChatPane } from "../components/builder/ChatPane";

const MIN_CHAT_WIDTH = 280;
const MAX_CHAT_WIDTH = 800;
const DEFAULT_CHAT_WIDTH = 420;
const BUILDER_ROUTE_FLAG = "genui-builder";

export default function GenUIBuilder() {
  const { projectId } = useParams<{ projectId: string }>();

  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);

  const dragStateRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  const handleChatDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragStateRef.current = { startX: e.clientX, startWidth: chatWidth };

      const onMove = (ev: MouseEvent) => {
        if (!dragStateRef.current) return;
        const { startX, startWidth } = dragStateRef.current;
        const dx = ev.clientX - startX;
        const next = startWidth - dx;
        setChatWidth(Math.max(MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, next)));
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
    [chatWidth],
  );

  useEffect(() => {
    document.body.setAttribute("data-route", BUILDER_ROUTE_FLAG);
    return () => document.body.removeAttribute("data-route");
  }, []);

  if (!projectId || projectId === "new") {
    return (
      <div className="h-full bg-surface-page text-content-secondary flex items-center justify-center text-sm">
        Generative UI 목록에서 프로젝트를 선택하거나 새로 만드세요.
      </div>
    );
  }

  return (
    <div className="h-full bg-surface-page flex overflow-hidden relative">
      <div
        className={`flex-1 min-w-0 h-full overflow-hidden ${chatOpen ? "max-md:hidden" : ""}`}
      >
        <DashboardCanvas projectId={projectId} />
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
              scope="dashboard"
              projectId={projectId}
              onClose={() => setChatOpen(false)}
            />
          </div>
        </>
      )}

      {!chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          title="채팅 열기"
          className="absolute top-2 right-3 z-20 inline-flex items-center gap-1.5 rounded-button bg-brand-600 hover:bg-brand-700 text-content-inverse text-[11px] px-2.5 py-1 shadow-card"
        >
          <MessageSquare size={12} />
          채팅 열기
        </button>
      )}
    </div>
  );
}
