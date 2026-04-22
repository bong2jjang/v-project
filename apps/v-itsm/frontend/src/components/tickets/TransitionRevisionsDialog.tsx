/**
 * Loop 전이 리비전 이력 Dialog.
 *
 * 서버의 `itsm_loop_transition_revision` 스냅샷 체인을 시간순으로 보여주고,
 * 특정 리비전으로 되돌리기(revert) 를 실행한다. revert 역시 새 리비전으로 기록된다.
 */

import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Modal,
  ModalFooter,
  Skeleton,
} from "../../components/ui";
import { MarkdownView } from "../../components/ui/MarkdownView";
import * as transitionApi from "../../lib/api/transitions";
import {
  LOOP_TRANSITION_REVISION_OPERATION_LABELS,
  type LoopTransitionDetail,
  type LoopTransitionRevision,
  type LoopTransitionRevisionOperation,
} from "../../lib/api/itsmTypes";

interface TransitionRevisionsDialogProps {
  isOpen: boolean;
  ticketId: string;
  transition: LoopTransitionDetail | null;
  onClose: () => void;
  onReverted: (updated: LoopTransitionDetail) => void;
}

type BadgeVariant =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "default"
  | "error"
  | "secondary";

const OPERATION_BADGE: Record<LoopTransitionRevisionOperation, BadgeVariant> = {
  create: "info",
  edit: "warning",
  delete: "danger",
  restore: "success",
  revert: "secondary",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

function operationLabel(op: string): string {
  return (
    LOOP_TRANSITION_REVISION_OPERATION_LABELS[
      op as LoopTransitionRevisionOperation
    ] ?? op
  );
}

function operationVariant(op: string): BadgeVariant {
  return OPERATION_BADGE[op as LoopTransitionRevisionOperation] ?? "default";
}

export default function TransitionRevisionsDialog({
  isOpen,
  ticketId,
  transition,
  onClose,
  onReverted,
}: TransitionRevisionsDialogProps) {
  const [revisions, setRevisions] = useState<LoopTransitionRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reverting, setReverting] = useState<number | null>(null);

  const loadRevisions = useCallback(async () => {
    if (!transition) return;
    setLoading(true);
    setError(null);
    try {
      const list = await transitionApi.listRevisions(ticketId, transition.id);
      setRevisions(
        [...list].sort((a, b) => b.revision_no - a.revision_no),
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`리비전 로드 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [ticketId, transition]);

  useEffect(() => {
    if (isOpen && transition) {
      void loadRevisions();
    }
    if (!isOpen) {
      setRevisions([]);
      setError(null);
      setReverting(null);
    }
  }, [isOpen, transition, loadRevisions]);

  async function handleRevert(rev: LoopTransitionRevision) {
    if (!transition) return;
    const confirmed = window.confirm(
      `리비전 #${rev.revision_no} 로 되돌리시겠습니까?\n현재 내용은 새 리비전으로 스냅샷되고, #${rev.revision_no} 의 note/artifacts 가 적용됩니다.`,
    );
    if (!confirmed) return;

    setReverting(rev.revision_no);
    setError(null);
    try {
      const updated = await transitionApi.revertToRevision(
        ticketId,
        transition.id,
        rev.revision_no,
        { reason: `revert to #${rev.revision_no}` },
      );
      onReverted(updated);
      await loadRevisions();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`되돌리기 실패: ${msg}`);
    } finally {
      setReverting(null);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        transition
          ? `전이 리비전 이력 · ${revisions.length}건`
          : "전이 리비전 이력"
      }
      size="lg"
      footer={<ModalFooter onCancel={onClose} onConfirm={onClose} confirmText="닫기" />}
    >
      <div className="space-y-3">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : revisions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-content-tertiary">
            <History className="h-8 w-8" />
            <div className="text-sm">아직 기록된 리비전이 없습니다.</div>
          </div>
        ) : (
          <ol className="space-y-2">
            {revisions.map((rev) => {
              const isLatest = transition?.head_revision_id === rev.id;
              const canRevert =
                transition !== null &&
                transition.deleted_at === null &&
                !isLatest &&
                rev.operation !== "delete";
              return (
                <li
                  key={rev.id}
                  className={`rounded-md border px-3 py-2 ${
                    isLatest
                      ? "border-brand-300 bg-brand-50/40"
                      : "border-line bg-surface-primary"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-content-secondary">
                      #{rev.revision_no}
                    </span>
                    <Badge variant={operationVariant(rev.operation)}>
                      {operationLabel(rev.operation)}
                    </Badge>
                    {isLatest && (
                      <Badge variant="info">현재</Badge>
                    )}
                    <span className="ml-auto text-xs text-content-tertiary tabular-nums">
                      {formatDate(rev.created_at)}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-content-tertiary">
                    {rev.actor_id !== null && <span>actor #{rev.actor_id}</span>}
                    {rev.reason && (
                      <span className="italic">사유: {rev.reason}</span>
                    )}
                  </div>

                  {rev.snapshot_note && (
                    <div className="mt-2 rounded-md bg-surface-secondary px-3 py-2">
                      <MarkdownView value={rev.snapshot_note} />
                    </div>
                  )}

                  {rev.snapshot_artifacts &&
                    Object.keys(rev.snapshot_artifacts).length > 0 && (
                      <div className="mt-2 text-[11px] text-content-tertiary">
                        artifacts {Object.keys(rev.snapshot_artifacts).length}건
                      </div>
                    )}

                  {canRevert && (
                    <div className="mt-2 flex justify-end">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleRevert(rev)}
                        loading={reverting === rev.revision_no}
                        disabled={reverting !== null}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />이 리비전으로 되돌리기
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Modal>
  );
}
