/**
 * SnapshotsPanel — 프로젝트 내부 프리뷰 버전(스냅샷) 도킹 패널.
 *
 * - 리스트: 최신순으로 snap-NNNN / 타이틀 / 생성시각 표시.
 * - 클릭: 해당 스냅샷의 files 를 fileMap 에 로드 → Preview/Code 패널이 해당 버전으로 스위치.
 * - "확정" 버튼: POST /api/projects/{id}/current-snapshot 으로 프로젝트 최종 스냅샷 지정.
 * - 펼침: 행을 펼쳐 당시 사용자 요청과 어시스턴트 설명(코드 펜스 제거 요약)을 조회.
 * - 삭제: 휴지통 아이콘 → 확인 후 DELETE /api/snapshots/{id}. 확정 상태면 서버가 해제까지 처리.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
  RefreshCw,
  Star,
  StarOff,
  Trash2,
  X,
} from "lucide-react";

import {
  uiBuilderApi,
  type Project,
  type SnapshotListItem,
} from "../../lib/api/ui-builder";
import { useBuilderStore } from "../../store/builder";

interface SnapshotsPanelProps {
  projectId: string;
  onClose?: () => void;
}

const snapshotsKey = (projectId: string) =>
  ["ui-builder", "snapshots", projectId] as const;
const snapshotDetailKey = (snapshotId: string) =>
  ["ui-builder", "snapshot", snapshotId] as const;

export function SnapshotsPanel({ projectId, onClose }: SnapshotsPanelProps) {
  const queryClient = useQueryClient();
  const project = useBuilderStore((s) => s.project);
  const viewingSnapshotId = useBuilderStore((s) => s.viewingSnapshotId);
  const loadSnapshotFiles = useBuilderStore((s) => s.loadSnapshotFiles);
  const clearSnapshotView = useBuilderStore((s) => s.clearSnapshotView);
  const setProject = useBuilderStore((s) => s.setProject);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { data: snapshots, isLoading, refetch, isFetching } = useQuery({
    queryKey: snapshotsKey(projectId),
    queryFn: () => uiBuilderApi.listSnapshots(projectId),
  });

  const loadMutation = useMutation({
    mutationFn: (snapshotId: string) => uiBuilderApi.getSnapshot(snapshotId),
    onSuccess: (snap) => {
      loadSnapshotFiles(snap.id, snap.files);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: ({
      snapshotId,
    }: {
      snapshotId: string | null;
    }) => uiBuilderApi.confirmSnapshot(projectId, snapshotId),
    onSuccess: (res) => {
      if (!project) return;
      const nextId = res.current_snapshot_id;
      const nextSnapshot: Project["current_snapshot"] = nextId
        ? snapshots?.find((s) => s.id === nextId) ?? project.current_snapshot
        : null;
      setProject({
        ...project,
        current_snapshot_id: nextId,
        current_snapshot: nextSnapshot,
      });
      queryClient.invalidateQueries({
        queryKey: ["ui-builder", "project", projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["ui-builder", "projects"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (snapshotId: string) => uiBuilderApi.deleteSnapshot(snapshotId),
    onSuccess: (_res, snapshotId) => {
      setPendingDeleteId(null);
      if (expandedId === snapshotId) setExpandedId(null);
      if (viewingSnapshotId === snapshotId) clearSnapshotView();
      if (project && project.current_snapshot_id === snapshotId) {
        setProject({
          ...project,
          current_snapshot_id: null,
          current_snapshot: null,
        });
      }
      queryClient.invalidateQueries({ queryKey: snapshotsKey(projectId) });
      queryClient.invalidateQueries({
        queryKey: ["ui-builder", "project", projectId],
      });
      queryClient.invalidateQueries({ queryKey: ["ui-builder", "projects"] });
    },
    onError: () => setPendingDeleteId(null),
  });

  const currentId = project?.current_snapshot_id ?? null;

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <div className="h-full min-h-0 flex flex-col bg-surface-card text-content-primary">
      <div className="flex items-stretch justify-between h-9 bg-[var(--color-surface-chrome)] border-b border-[var(--color-surface-chrome-border)]">
        <div className="flex items-center">
          <div className="relative h-full inline-flex items-center px-3 text-[11px] uppercase tracking-wider text-content-primary font-medium gap-1.5">
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-brand-600" />
            <History size={12} />
            Snapshots
          </div>
        </div>
        <div className="flex items-center pr-1">
          <button
            type="button"
            onClick={() => refetch()}
            title="새로고침"
            className="p-1 text-content-secondary hover:text-content-primary hover:bg-surface-overlay rounded-button transition-colors"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="스냅샷 닫기"
              title="스냅샷 닫기"
              className="p-1 text-content-secondary hover:text-content-primary hover:bg-surface-overlay rounded-button transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {viewingSnapshotId && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] bg-brand-500/10 border-b border-brand-500/30 text-content-primary">
          <span>스냅샷 미리보기 중</span>
          <button
            type="button"
            onClick={clearSnapshotView}
            className="text-brand-500 hover:text-brand-600 underline underline-offset-2"
          >
            최신으로 돌아가기
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1.5 text-[12.5px]">
        {isLoading && (
          <div className="text-[11px] text-content-tertiary px-1">
            불러오는 중…
          </div>
        )}

        {!isLoading && (!snapshots || snapshots.length === 0) && (
          <div className="text-[11px] text-content-tertiary px-1">
            아직 생성된 스냅샷이 없습니다. 채팅으로 UI 를 요청하면 자동
            저장됩니다.
          </div>
        )}

        {snapshots?.map((snap) => (
          <SnapshotRow
            key={snap.id}
            snap={snap}
            isConfirmed={snap.id === currentId}
            isViewing={snap.id === viewingSnapshotId}
            isLoading={
              loadMutation.isPending && loadMutation.variables === snap.id
            }
            isConfirming={
              confirmMutation.isPending &&
              confirmMutation.variables?.snapshotId === snap.id
            }
            isExpanded={expandedId === snap.id}
            isPendingDelete={pendingDeleteId === snap.id}
            isDeleting={
              deleteMutation.isPending && deleteMutation.variables === snap.id
            }
            onLoad={() => loadMutation.mutate(snap.id)}
            onToggleConfirm={() =>
              confirmMutation.mutate({
                snapshotId: snap.id === currentId ? null : snap.id,
              })
            }
            onToggleExpand={() => toggleExpand(snap.id)}
            onRequestDelete={() => setPendingDeleteId(snap.id)}
            onCancelDelete={() => setPendingDeleteId(null)}
            onConfirmDelete={() => deleteMutation.mutate(snap.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface SnapshotRowProps {
  snap: SnapshotListItem;
  isConfirmed: boolean;
  isViewing: boolean;
  isLoading: boolean;
  isConfirming: boolean;
  isExpanded: boolean;
  isPendingDelete: boolean;
  isDeleting: boolean;
  onLoad: () => void;
  onToggleConfirm: () => void;
  onToggleExpand: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function SnapshotRow({
  snap,
  isConfirmed,
  isViewing,
  isLoading,
  isConfirming,
  isExpanded,
  isPendingDelete,
  isDeleting,
  onLoad,
  onToggleConfirm,
  onToggleExpand,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: SnapshotRowProps) {
  const created = new Date(snap.created_at);
  const timeLabel = `${created.toLocaleDateString()} ${created.toLocaleTimeString(
    [],
    { hour: "2-digit", minute: "2-digit" },
  )}`;

  return (
    <div
      className={`rounded-button border px-2 py-1.5 transition-all shadow-sm ${
        isViewing
          ? "border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/30 shadow"
          : isConfirmed
          ? "border-status-success-border bg-status-success-light dark:border-line-heavy dark:bg-surface-raised hover:border-status-success/60 hover:shadow"
          : "border-line-heavy bg-brand-50/60 dark:bg-surface-raised hover:border-brand-500/40 hover:bg-brand-50 dark:hover:bg-surface-raised hover:shadow"
      }`}
    >
      <div className="flex items-start gap-1">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={isExpanded ? "접기" : "펼치기"}
          title={isExpanded ? "접기" : "대화 보기"}
          className="mt-0.5 p-0.5 text-content-tertiary hover:text-content-primary rounded-button"
        >
          {isExpanded ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </button>

        <button
          type="button"
          onClick={onLoad}
          disabled={isLoading}
          className="flex-1 min-w-0 text-left disabled:opacity-60"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[10px] text-content-tertiary shrink-0">
              {snap.slug}
            </span>
            {isConfirmed && (
              <span
                title="확정된 스냅샷"
                className="inline-flex items-center gap-0.5 rounded-full bg-status-success text-content-inverse text-[10px] px-1.5 py-px font-medium shadow-sm"
              >
                <Check size={10} />
                확정
              </span>
            )}
            <span className="truncate text-content-primary text-[12.5px]">
              {snap.title}
            </span>
          </div>
          <div className="mt-0.5 text-[10px] text-content-tertiary">
            {timeLabel}
            {isLoading && " · 로딩 중…"}
          </div>
        </button>
      </div>

      {isExpanded && <SnapshotDetailView snapshotId={snap.id} />}

      <div className="mt-1.5 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={isPendingDelete ? onCancelDelete : onRequestDelete}
          disabled={isDeleting}
          title={isPendingDelete ? "삭제 취소" : "스냅샷 삭제"}
          aria-label={isPendingDelete ? "삭제 취소" : "스냅샷 삭제"}
          className={`inline-flex items-center justify-center rounded-button w-6 h-6 transition-colors disabled:opacity-60 ${
            isPendingDelete
              ? "bg-surface-card text-content-primary border border-line-heavy hover:border-content-secondary"
              : "text-content-tertiary border border-transparent hover:text-status-danger hover:bg-status-danger/10 hover:border-status-danger/30"
          }`}
        >
          {isPendingDelete ? <X size={13} /> : <Trash2 size={13} />}
        </button>

        <div className="flex items-center gap-1">
          {isPendingDelete && (
            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={isDeleting}
              title={isDeleting ? "삭제 중…" : "삭제 확정"}
              aria-label={isDeleting ? "삭제 중" : "삭제 확정"}
              className="inline-flex items-center justify-center rounded-button w-6 h-6 bg-status-danger text-content-inverse border border-status-danger shadow-sm hover:bg-status-danger/90 disabled:opacity-60"
            >
              {isDeleting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleConfirm}
            disabled={isConfirming || isDeleting}
            title={
              isConfirming
                ? "처리 중…"
                : isConfirmed
                ? "확정 해제"
                : "이 스냅샷 확정"
            }
            aria-label={isConfirmed ? "확정 해제" : "이 스냅샷 확정"}
            className={`inline-flex items-center justify-center rounded-button w-6 h-6 transition-colors disabled:opacity-60 ${
              isConfirmed
                ? "bg-surface-card text-status-success border border-status-success hover:bg-status-success/10"
                : "bg-brand-600 text-content-inverse border border-brand-700 shadow-sm hover:bg-brand-700"
            }`}
          >
            {isConfirming ? (
              <Loader2 size={13} className="animate-spin" />
            ) : isConfirmed ? (
              <StarOff size={13} />
            ) : (
              <Star size={13} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SnapshotDetailViewProps {
  snapshotId: string;
}

function SnapshotDetailView({ snapshotId }: SnapshotDetailViewProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: snapshotDetailKey(snapshotId),
    queryFn: () => uiBuilderApi.getSnapshot(snapshotId),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="mt-2 text-[10.5px] text-content-tertiary px-1">
        대화 불러오는 중…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mt-2 text-[10.5px] text-status-danger px-1">
        대화를 불러오지 못했습니다.
      </div>
    );
  }

  const explanation = stripFencedCode(data.assistant_message?.content ?? "");
  const fileCount = Object.keys(data.files ?? {}).length;

  return (
    <div className="mt-2 space-y-1.5 border-t border-line/60 pt-2">
      {data.user_prompt?.content && (
        <div>
          <div className="text-[9.5px] uppercase tracking-wider text-content-tertiary mb-0.5">
            사용자 요청
          </div>
          <div className="text-[11.5px] text-content-primary whitespace-pre-wrap break-words bg-surface-overlay/50 rounded-button px-2 py-1">
            {data.user_prompt.content}
          </div>
        </div>
      )}
      {explanation && (
        <div>
          <div className="text-[9.5px] uppercase tracking-wider text-content-tertiary mb-0.5">
            코드 설명
          </div>
          <div className="text-[11.5px] text-content-secondary whitespace-pre-wrap break-words">
            {explanation}
          </div>
        </div>
      )}
      {!data.user_prompt && !explanation && (
        <div className="text-[10.5px] text-content-tertiary">
          연결된 대화 기록이 없습니다.
        </div>
      )}
      <div className="text-[10px] text-content-tertiary">
        파일 {fileCount}개
      </div>
    </div>
  );
}

// 코드 펜스 블록을 제거해 어시스턴트의 설명 텍스트만 남긴다.
// ChatService 가 펜스로 감싸는 규칙을 지키는 것을 전제로 한다.
function stripFencedCode(raw: string): string {
  if (!raw) return "";
  const withoutFences = raw.replace(/```[\s\S]*?```/g, "").trim();
  return withoutFences.replace(/\n{3,}/g, "\n\n");
}
