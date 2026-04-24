import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, Layers, X } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspace";
import type { WorkspaceSummary } from "../../lib/api/workspaces";

const CONFIRM_SECONDS = 5;

export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [pending, setPending] = useState<WorkspaceSummary | null>(null);
  const [countdown, setCountdown] = useState(CONFIRM_SECONDS);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { currentWorkspace, myWorkspaces, switchWorkspace } = useWorkspaceStore();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!pending) return;
    if (countdown <= 0) {
      void executeSwitch(pending.id);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, countdown]);

  const executeSwitch = async (wsId: string) => {
    setPending(null);
    setSwitching(true);
    try {
      await switchWorkspace(wsId);
    } catch (e) {
      setSwitching(false);
      return;
    }
    // 페이지 전체를 재마운트해서 모든 데이터 훅이 새 WS 기준으로 재조회되도록 강제.
    window.location.assign("/kanban");
  };

  const handleSelect = (ws: WorkspaceSummary) => {
    setOpen(false);
    if (ws.id === currentWorkspace?.id) return;
    setPending(ws);
    setCountdown(CONFIRM_SECONDS);
  };

  const handleCancel = () => {
    setPending(null);
    setCountdown(CONFIRM_SECONDS);
  };

  const handleConfirmNow = () => {
    if (pending) void executeSwitch(pending.id);
  };

  return (
    <div className="flex items-center gap-2">
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={switching || pending !== null}
          className="flex items-center gap-2 px-3 py-1.5 rounded-button text-body-sm font-medium text-content-primary hover:bg-surface-raised transition-colors border border-line bg-surface-card disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Layers className="w-4 h-4 text-brand-600 flex-shrink-0" />
          <span className="truncate max-w-[160px]">
            {switching
              ? "전환 중..."
              : currentWorkspace?.name ?? "워크스페이스 없음"}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-content-tertiary flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-surface-card border border-line rounded-card shadow-lg z-50 py-1">
            <p className="px-3 py-1.5 text-caption text-content-tertiary font-medium uppercase tracking-wider">
              워크스페이스 전환
            </p>

            {myWorkspaces.length === 0 ? (
              <p className="px-3 py-2 text-body-sm text-content-secondary">
                접근 가능한 워크스페이스가 없습니다.
              </p>
            ) : (
              myWorkspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => handleSelect(ws)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-body-sm hover:bg-surface-raised transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-medium truncate ${
                        ws.id === currentWorkspace?.id
                          ? "text-brand-600"
                          : "text-content-primary"
                      }`}
                    >
                      {ws.name}
                    </p>
                    {ws.description && (
                      <p className="text-caption text-content-tertiary truncate">
                        {ws.description}
                      </p>
                    )}
                  </div>
                  {ws.id === currentWorkspace?.id && (
                    <Check className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  )}
                </button>
              ))
            )}

            <div className="border-t border-line mt-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate("/workspaces");
                }}
                className="w-full px-3 py-2 text-body-sm text-content-secondary hover:bg-surface-raised transition-colors text-left"
              >
                모든 워크스페이스 보기
              </button>
            </div>
          </div>
        )}
      </div>

      {pending && (
        <div
          role="alert"
          className="flex items-center gap-2 px-3 py-1.5 rounded-button text-body-sm bg-amber-50 border border-amber-300 text-amber-900"
        >
          <span className="truncate max-w-[200px]">
            <strong className="font-semibold">{pending.name}</strong> 로 전환합니다
            <span className="ml-1 tabular-nums">({countdown}초)</span>
          </span>
          <button
            type="button"
            onClick={handleConfirmNow}
            className="px-2 py-0.5 rounded text-caption font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          >
            지금
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-caption font-medium bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition-colors"
          >
            <X className="w-3 h-3" />
            취소
          </button>
        </div>
      )}
    </div>
  );
}
