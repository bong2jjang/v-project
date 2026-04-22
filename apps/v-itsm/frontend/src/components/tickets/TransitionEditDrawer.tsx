/**
 * Loop 전이 편집 Drawer.
 *
 * 기존 전이의 note/artifacts 를 수정하고 편집 사유(reason)를 남긴다.
 * 서버는 편집 결과를 `itsm_loop_transition_revision` 에 자동 스냅샷한다.
 */

import { useEffect, useMemo, useState } from "react";
import { Alert, Drawer, DrawerFooter, Textarea } from "../../components/ui";
import { RichEditor } from "../../components/ui/RichEditor";
import * as transitionApi from "../../lib/api/transitions";
import {
  LOOP_ACTION_LABELS,
  type LoopTransitionDetail,
} from "../../lib/api/itsmTypes";

interface TransitionEditDrawerProps {
  isOpen: boolean;
  ticketId: string;
  transition: LoopTransitionDetail | null;
  onClose: () => void;
  onSaved: (updated: LoopTransitionDetail) => void;
}

export default function TransitionEditDrawer({
  isOpen,
  ticketId,
  transition,
  onClose,
  onSaved,
}: TransitionEditDrawerProps) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && transition) {
      setNote(transition.note ?? "");
      setReason("");
      setError(null);
    }
  }, [isOpen, transition]);

  const title = useMemo(() => {
    if (!transition) return "전이 편집";
    return `전이 편집 · ${LOOP_ACTION_LABELS[transition.action]}`;
  }, [transition]);

  async function handleSubmit() {
    if (!transition) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await transitionApi.editTransition(
        ticketId,
        transition.id,
        {
          note: note.trim() || null,
          reason: reason.trim() || null,
        },
      );
      onSaved(updated);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`편집 실패: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={() => {
        if (submitting) return;
        onClose();
      }}
      title={title}
      size="lg"
      footer={
        <DrawerFooter
          onCancel={onClose}
          onConfirm={() => void handleSubmit()}
          loading={submitting}
          confirmText="저장"
        />
      }
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {transition && (
          <div className="rounded-md border border-line bg-surface-secondary px-3 py-2 text-xs text-content-tertiary">
            리비전 #{transition.edit_count + 1} 로 기록됩니다 · 편집 횟수{" "}
            {transition.edit_count}회
          </div>
        )}

        <RichEditor
          label="처리 내용 / 메모"
          value={note}
          onChange={setNote}
          placeholder="전이 시 남긴 처리 내용을 수정하세요 (Markdown 지원)"
          minHeight={220}
        />

        <Textarea
          label="편집 사유"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="편집한 이유를 간단히 남겨주세요 (선택)"
          rows={3}
          helperText="리비전 히스토리에 함께 기록됩니다."
        />
      </div>
    </Drawer>
  );
}
