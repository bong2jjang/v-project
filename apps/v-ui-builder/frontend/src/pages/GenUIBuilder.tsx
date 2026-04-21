/**
 * GenUIBuilder — Generative UI(`project_type='genui'`) 프로젝트 전용 쉘.
 *
 * 상단: BuilderToolbar(h-9) — 좌:팔레트 / 중:편집·프리뷰·뷰어 / 우:채팅
 * 좌측 (240px, 모바일은 오버레이 드로어): WidgetPalette
 * 중앙 (flex-1): DashboardCanvas — react-grid-layout 위젯 보드
 * 우측 (기본 420px, 드래그 리사이즈): 탭으로 ChatPane / Inspector 전환
 *   └ 위젯 선택 시 "속성" 탭으로 자동 전환 + 패널 자동 열기
 *
 * Sandpack Builder 와 달리 스냅샷 개념이 없어 SnapshotsPanel 은 없음.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  Eye,
  EyeOff,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
  Settings2,
  Undo2,
  X,
} from "lucide-react";

import { DashboardCanvas } from "../components/builder/dashboard/DashboardCanvas";
import { Inspector } from "../components/builder/dashboard/inspector/Inspector";
import { WidgetPalette } from "../components/builder/dashboard/WidgetPalette";
import { ChatPane } from "../components/builder/ChatPane";
import { BuilderToolbar } from "../components/builder/BuilderToolbar";
import {
  dashboardsApi,
  type DashboardDetail,
  type WidgetCreateRequest,
} from "../lib/api/dashboards";
import { useDashboardStore } from "../store/dashboard";

const MIN_CHAT_WIDTH = 280;
const MAX_CHAT_WIDTH = 800;
const DEFAULT_CHAT_WIDTH = 420;
const BUILDER_ROUTE_FLAG = "genui-builder";

type RightTab = "chat" | "inspector";

export default function GenUIBuilder() {
  const { projectId } = useParams<{ projectId: string }>();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [previewMode, setPreviewMode] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("chat");

  const inspectedWidgetId = useDashboardStore((s) => s.inspectedWidgetId);
  const setInspectedWidgetId = useDashboardStore(
    (s) => s.setInspectedWidgetId,
  );
  const undoStackLen = useDashboardStore((s) => s.undoStack.length);
  const popDeletedWidget = useDashboardStore((s) => s.popDeletedWidget);

  const queryClient = useQueryClient();
  const undoRestoreMutation = useMutation({
    mutationFn: (body: WidgetCreateRequest) =>
      projectId
        ? dashboardsApi.pinWidget(projectId, body)
        : Promise.reject(new Error("projectId 없음")),
    onSuccess: (widget) => {
      if (!projectId) return;
      queryClient.setQueryData<DashboardDetail>(
        ["ui-builder", "dashboard", projectId],
        (old) => (old ? { ...old, widgets: [...old.widgets, widget] } : old),
      );
    },
  });

  const handleToolbarUndo = useCallback(() => {
    const w = popDeletedWidget();
    if (!w) return;
    undoRestoreMutation.mutate({
      call_id: w.call_id,
      tool: w.tool,
      component: w.component,
      props: w.props,
      source_message_id: w.source_message_id ?? null,
      source_call_id: w.source_call_id ?? null,
      grid_x: w.grid_x,
      grid_y: w.grid_y,
      grid_w: w.grid_w,
      grid_h: w.grid_h,
    });
  }, [popDeletedWidget, undoRestoreMutation]);

  // 드래그 중에는 DOM width 만 직접 조작하고, mouseup 시점에 한 번만 setState 로
  // commit 한다. rAF 로 coalesce 하여 프레임당 최대 1회만 레이아웃을 갱신.
  const chatPaneRef = useRef<HTMLDivElement | null>(null);

  const handleChatDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = chatWidth;
      let currentWidth = startWidth;
      let rafId = 0;
      let pending = false;

      const flush = () => {
        pending = false;
        const pane = chatPaneRef.current;
        if (pane) pane.style.width = `${currentWidth}px`;
      };

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        const next = startWidth - dx;
        currentWidth = Math.max(
          MIN_CHAT_WIDTH,
          Math.min(MAX_CHAT_WIDTH, next),
        );
        if (!pending) {
          pending = true;
          rafId = requestAnimationFrame(flush);
        }
      };
      const onUp = () => {
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setChatWidth(currentWidth);
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

  useEffect(() => {
    if (previewMode) {
      setPaletteOpen(false);
      setInspectedWidgetId(null);
      setRightTab("chat");
    }
  }, [previewMode, setInspectedWidgetId]);

  useEffect(() => {
    if (!previewMode && inspectedWidgetId) {
      setRightTab("inspector");
      setChatOpen(true);
    }
  }, [inspectedWidgetId, previewMode]);

  if (!projectId || projectId === "new") {
    return (
      <div className="h-full bg-surface-page text-content-secondary flex items-center justify-center text-sm">
        Generative UI 목록에서 프로젝트를 선택하거나 새로 만드세요.
      </div>
    );
  }

  const toolbarLeft = !previewMode ? (
    <>
      <button
        type="button"
        onClick={() => setPaletteOpen((v) => !v)}
        title={paletteOpen ? "팔레트 닫기" : "팔레트 열기"}
        className={`inline-flex items-center gap-1 rounded-button px-2 py-1 text-[11px] transition-colors ${
          paletteOpen
            ? "bg-surface-overlay text-content-primary"
            : "text-content-secondary hover:text-content-primary hover:bg-surface-overlay"
        }`}
      >
        {paletteOpen ? <PanelLeftClose size={12} /> : <PanelLeftOpen size={12} />}
        팔레트
      </button>
      <span className="w-px h-4 bg-line mx-0.5" />
      <button
        type="button"
        onClick={handleToolbarUndo}
        disabled={undoStackLen === 0 || undoRestoreMutation.isPending}
        title={
          undoStackLen === 0
            ? "되돌릴 삭제 없음"
            : `삭제 취소 (Ctrl+Z) — ${undoStackLen}개 대기`
        }
        className="inline-flex items-center gap-1 rounded-button px-2 py-1 text-[11px] text-content-secondary hover:text-content-primary hover:bg-surface-overlay disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-content-secondary transition-colors"
      >
        <Undo2 size={12} />
        되돌리기
        {undoStackLen > 0 && (
          <span className="ml-0.5 inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-brand-500 text-white text-[9px] font-mono">
            {undoStackLen}
          </span>
        )}
      </button>
    </>
  ) : null;

  const toolbarCenter = (
    <div className="inline-flex items-center gap-0.5 rounded-button border border-line bg-surface-card px-0.5 py-0.5">
      <button
        type="button"
        onClick={() => setPreviewMode(false)}
        title="편집 모드"
        className={`inline-flex items-center gap-1 rounded-button px-2 py-0.5 text-[11px] transition-colors ${
          !previewMode
            ? "bg-brand-600 text-content-inverse"
            : "text-content-secondary hover:text-brand-500"
        }`}
      >
        <EyeOff size={12} />
        편집
      </button>
      <button
        type="button"
        onClick={() => setPreviewMode(true)}
        title="프리뷰 모드"
        className={`inline-flex items-center gap-1 rounded-button px-2 py-0.5 text-[11px] transition-colors ${
          previewMode
            ? "bg-brand-600 text-content-inverse"
            : "text-content-secondary hover:text-brand-500"
        }`}
      >
        <Eye size={12} />
        프리뷰
      </button>
      <span className="w-px h-4 bg-line mx-0.5" />
      <Link
        to={`/genui/${projectId}/view`}
        title="뷰어 페이지에서 열기"
        className="inline-flex items-center gap-1 rounded-button px-2 py-0.5 text-[11px] text-content-secondary hover:text-brand-500"
      >
        <ExternalLink size={12} />
        뷰어
      </Link>
    </div>
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
      <BuilderToolbar
        left={toolbarLeft}
        center={toolbarCenter}
        right={toolbarRight}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {paletteOpen && !previewMode ? (
          <>
            <button
              type="button"
              aria-label="팔레트 배경 닫기"
              onClick={() => setPaletteOpen(false)}
              className="md:hidden absolute inset-0 z-20 bg-black/40"
            />
            <div className="relative h-full w-[240px] shrink-0 bg-surface-chrome max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:w-[80%] max-md:max-w-[320px] max-md:shadow-card-elevated">
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
          </>
        ) : null}

        <div className="flex-1 min-w-0 h-full overflow-hidden">
          <DashboardCanvas
            projectId={projectId}
            mode={previewMode ? "preview" : "edit"}
          />
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
              ref={chatPaneRef}
              className="h-full shrink-0 overflow-hidden border-l border-line bg-surface-canvas flex flex-col max-md:!w-full max-md:absolute max-md:inset-0 max-md:z-40 max-md:border-l-0"
              style={{ width: chatWidth }}
            >
              {!previewMode && (
                <div className="h-9 shrink-0 border-b border-line bg-surface-chrome flex items-stretch">
                  <button
                    type="button"
                    onClick={() => setRightTab("chat")}
                    className={`inline-flex items-center gap-1.5 px-3 text-[11.5px] border-b-2 transition-colors ${
                      rightTab === "chat"
                        ? "border-brand-600 text-content-primary"
                        : "border-transparent text-content-secondary hover:text-content-primary"
                    }`}
                  >
                    <MessageSquare size={12} />
                    채팅
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightTab("inspector")}
                    title={
                      inspectedWidgetId
                        ? "선택한 위젯 속성"
                        : "캔버스에서 위젯을 선택하세요"
                    }
                    className={`inline-flex items-center gap-1.5 px-3 text-[11.5px] border-b-2 transition-colors ${
                      rightTab === "inspector"
                        ? "border-brand-600 text-content-primary"
                        : "border-transparent text-content-secondary hover:text-content-primary"
                    }`}
                  >
                    <Settings2 size={12} />
                    속성
                    {inspectedWidgetId && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-500" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatOpen(false)}
                    aria-label="우측 패널 닫기"
                    title="우측 패널 닫기"
                    className="ml-auto self-center mr-1 inline-flex items-center justify-center w-6 h-6 rounded-button text-content-tertiary hover:text-content-primary hover:bg-surface-overlay"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              <div className="flex-1 min-h-0 flex flex-col">
                {previewMode || rightTab === "chat" ? (
                  <ChatPane
                    scope="dashboard"
                    projectId={projectId}
                    onClose={previewMode ? () => setChatOpen(false) : undefined}
                    hideHeader={!previewMode}
                  />
                ) : (
                  <Inspector projectId={projectId} />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
