/**
 * GenUIViewer — Generative UI 대시보드 전용 뷰어 라우트(`/genui/:projectId/view`).
 *
 * - Palette/Inspector/Chat 전부 제외한 풀스크린 캔버스.
 * - `DashboardCanvas` 를 `mode="preview"` 로 렌더 → 드래그/리사이즈/액션 버튼 모두 비활성.
 * - 상단 헤더에 "편집 모드로", "목록" 링크만 둔다. 권한 키는 `ui_builder_genui` 재사용.
 */

import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";

import { DashboardCanvas } from "../components/builder/dashboard/DashboardCanvas";

const VIEWER_ROUTE_FLAG = "genui-viewer";

export default function GenUIViewer() {
  const { projectId } = useParams<{ projectId: string }>();

  useEffect(() => {
    document.body.setAttribute("data-route", VIEWER_ROUTE_FLAG);
    return () => document.body.removeAttribute("data-route");
  }, []);

  if (!projectId || projectId === "new") {
    return (
      <div className="h-full bg-surface-page text-content-secondary flex items-center justify-center text-sm">
        Generative UI 목록에서 프로젝트를 선택하세요.
      </div>
    );
  }

  return (
    <div className="h-full bg-surface-page flex flex-col overflow-hidden">
      <div className="h-10 shrink-0 px-3 flex items-center justify-between border-b border-line bg-surface-chrome">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to="/genui"
            title="Generative UI 목록"
            className="inline-flex items-center gap-1 rounded-button text-content-secondary hover:text-brand-500 text-[11.5px] px-2 py-1"
          >
            <ArrowLeft size={13} />
            목록
          </Link>
          <span className="w-px h-4 bg-line" />
          <span className="text-[11.5px] font-semibold text-content-primary">
            Generative UI 프리뷰
          </span>
          <span className="text-[10.5px] font-mono text-content-tertiary truncate">
            {projectId}
          </span>
        </div>
        <Link
          to={`/genui/${projectId}`}
          title="편집 모드로 전환"
          className="inline-flex items-center gap-1.5 rounded-button bg-brand-600 hover:bg-brand-700 text-content-inverse text-[11px] px-2.5 py-1 shadow-card"
        >
          <Pencil size={12} />
          편집 모드로
        </Link>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <DashboardCanvas projectId={projectId} mode="preview" />
      </div>
    </div>
  );
}
