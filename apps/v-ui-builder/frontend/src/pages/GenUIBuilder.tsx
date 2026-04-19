/**
 * GenUIBuilder — Generative UI(`project_type='genui'`) 프로젝트 전용 쉘.
 *
 * 4-pane 레이아웃:
 * - 좌측 (240px, 접을 수 있음): WidgetPalette — 카탈로그 기반 수동 위젯 추가
 * - 중앙 (flex-1): DashboardCanvas — react-grid-layout 위젯 보드
 * - 우측 Inspector (320px, `inspectedWidgetId` 있을 때만 렌더): 위젯 props 편집
 * - 최우측 ChatPane (기본 420px, 드래그 리사이즈): scope="dashboard"
 *
 * Sandpack Builder 와 달리 스냅샷 개념이 없어 SnapshotsPanel 은 없음.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { MessageSquare, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { DashboardCanvas } from "../components/builder/dashboard/DashboardCanvas";
import { Inspector } from "../components/builder/dashboard/inspector/Inspector";
import { WidgetPalette } from "../components/builder/dashboard/WidgetPalette";
import { ChatPane } from "../components/builder/ChatPane";
import { useDashboardStore } from "../store/dashboard";

const MIN_CHAT_WIDTH = 280;
const MAX_CHAT_WIDTH = 800;
const DEFAULT_CHAT_WIDTH = 420;
const BUILDER_ROUTE_FLAG = "genui-builder";

export default function GenUIBuilder() {
  const { projectId } = useParams<{ projectId: string }>();

  const [paletteOpen, setPaletteOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);

  const inspectedWidgetId = useDashboardStore((s) => s.inspectedWidgetId);

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
      {paletteOpen ? (
        <div className="relative h-full w-[240px] shrink-0 max-md:hidden">
          <WidgetPalette projectId={projectId} />
          <button
            type="button"
            onClick={() => setPaletteOpen(false)}
            title="팔레트 닫기"
            className="absolute top-1.5 right-2 inline-flex items-center justify-center w-6 h-6 rounded-button text-content-tertiary hover:text-content-primary hover:bg-surface-overlay z-10"
          >
            <PanelLeftClose size={13} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          title="팔레트 열기"
          className="absolute top-2 left-2 z-20 inline-flex items-center gap-1.5 rounded-button border border-line bg-surface-card hover:border-brand-500 text-content-secondary hover:text-brand-500 text-[11px] px-2 py-1 shadow-card max-md:hidden"
        >
          <PanelLeftOpen size={12} />
          팔레트
        </button>
      )}

      <div className="flex-1 min-w-0 h-full overflow-hidden">
        <DashboardCanvas projectId={projectId} />
      </div>

      {inspectedWidgetId && (
        <div className="max-md:hidden h-full shrink-0 flex">
          <Inspector projectId={projectId} />
        </div>
      )}

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
