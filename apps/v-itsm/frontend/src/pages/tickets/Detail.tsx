/**
 * v-itsm 티켓 상세 + Loop FSM 진행 페이지.
 *
 * 좌: 티켓 정보(읽기 전용), 우: Loop 상태·허용 액션 버튼 + 전이 모달.
 * 하단: 전이 이력 타임라인.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronRight,
  CircleDot,
  Clock,
  History,
  Pencil,
  RotateCcw,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Drawer,
  DrawerFooter,
  Skeleton,
} from "../../components/ui";
import { MarkdownView } from "../../components/ui/MarkdownView";
import { RichEditor } from "../../components/ui/RichEditor";
import LoopProgress, {
  STAGE_META,
  ACTION_ICON,
  formatDurationShort,
} from "../../components/tickets/LoopProgress";
import TransitionEditDrawer from "../../components/tickets/TransitionEditDrawer";
import TransitionRevisionsDialog from "../../components/tickets/TransitionRevisionsDialog";
import * as ticketApi from "../../lib/api/tickets";
import * as transitionApi from "../../lib/api/transitions";
import * as customerApi from "../../lib/api/customers";
import * as productApi from "../../lib/api/products";
import * as contractApi from "../../lib/api/contracts";
import type {
  AllowedActions,
  Contract,
  Customer,
  LoopAction,
  LoopStage,
  LoopTransitionDetail,
  Priority,
  Product,
  Ticket,
} from "../../lib/api/itsmTypes";
import {
  CHANNEL_SOURCE_LABELS,
  LOOP_ACTION_LABELS,
  LOOP_STAGE_LABELS,
  PRIORITY_LABELS,
  SERVICE_TYPE_LABELS,
} from "../../lib/api/itsmTypes";

type BadgeVariant =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "default"
  | "error"
  | "secondary";

const STAGE_BADGE: Record<LoopStage, BadgeVariant> = {
  intake: "info",
  analyze: "secondary",
  execute: "warning",
  verify: "info",
  answer: "success",
  closed: "default",
};

const PRIORITY_BADGE: Record<Priority, BadgeVariant> = {
  critical: "error",
  high: "danger",
  normal: "info",
  low: "secondary",
};

const ACTION_VARIANT: Record<
  LoopAction,
  "primary" | "secondary" | "success" | "danger" | "warning" | "ghost"
> = {
  advance: "primary",
  reject: "danger",
  on_hold: "warning",
  resume: "success",
  rollback: "secondary",
  reopen: "warning",
  note: "secondary",
};

const ACTION_TONE: Record<
  LoopAction,
  { dot: string; chip: string; border: string }
> = {
  advance: {
    dot: "bg-brand-500",
    chip: "bg-brand-50 text-brand-700 border-brand-200",
    border: "border-brand-300",
  },
  reject: {
    dot: "bg-danger-500",
    chip: "bg-danger-50 text-danger-700 border-danger-200",
    border: "border-danger-300",
  },
  on_hold: {
    dot: "bg-warning-500",
    chip: "bg-warning-50 text-warning-700 border-warning-200",
    border: "border-warning-300",
  },
  resume: {
    dot: "bg-success-500",
    chip: "bg-success-50 text-success-700 border-success-200",
    border: "border-success-300",
  },
  rollback: {
    dot: "bg-warning-500",
    chip: "bg-warning-50 text-warning-700 border-warning-200",
    border: "border-warning-300",
  },
  reopen: {
    dot: "bg-warning-500",
    chip: "bg-warning-50 text-warning-700 border-warning-200",
    border: "border-warning-300",
  },
  note: {
    dot: "bg-content-tertiary",
    chip: "bg-surface-secondary text-content-secondary border-line",
    border: "border-line",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR");
  } catch {
    return iso;
  }
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [actions, setActions] = useState<AllowedActions | null>(null);
  const [transitions, setTransitions] = useState<LoopTransitionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);

  const [drawerAction, setDrawerAction] = useState<LoopAction | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingTransition, setEditingTransition] =
    useState<LoopTransitionDetail | null>(null);
  const [revisionsTransition, setRevisionsTransition] =
    useState<LoopTransitionDetail | null>(null);
  const [actingTransitionId, setActingTransitionId] = useState<string | null>(
    null,
  );

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [t, a, txs] = await Promise.all([
        ticketApi.getTicket(id),
        ticketApi.getAllowedActions(id),
        ticketApi.listTransitions(id, {
          include_deleted: true,
          with_latest_revision: true,
        }),
      ]);
      setTicket(t);
      setActions(a);
      setTransitions(txs);

      const lookups: Array<Promise<void>> = [];
      if (t.customer_id) {
        lookups.push(
          customerApi
            .getCustomer(t.customer_id)
            .then((c) => setCustomer(c))
            .catch(() => setCustomer(null)),
        );
      } else {
        setCustomer(null);
      }
      if (t.product_id) {
        lookups.push(
          productApi
            .getProduct(t.product_id)
            .then((p) => setProduct(p))
            .catch(() => setProduct(null)),
        );
      } else {
        setProduct(null);
      }
      if (t.contract_id) {
        lookups.push(
          contractApi
            .getContract(t.contract_id)
            .then((ct) => setContract(ct))
            .catch(() => setContract(null)),
        );
      } else {
        setContract(null);
      }
      await Promise.all(lookups);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`티켓 조회 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSubmitAction() {
    if (!id || !drawerAction) return;
    setSubmitting(true);
    setError(null);
    try {
      await ticketApi.transitionTicket(id, {
        action: drawerAction,
        note: note.trim() || null,
      });
      setSuccess(`'${LOOP_ACTION_LABELS[drawerAction]}' 처리 완료`);
      setDrawerAction(null);
      setNote("");
      await loadAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`전이 실패: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  function mergeTransition(updated: LoopTransitionDetail) {
    setTransitions((prev) =>
      prev.map((tx) => (tx.id === updated.id ? updated : tx)),
    );
  }

  async function handleDeleteTransition(tx: LoopTransitionDetail) {
    if (!id) return;
    const reason = window.prompt(
      `이 전이를 삭제 처리 하시겠습니까?\n(soft-delete — 리비전 이력은 보존됩니다)\n\n삭제 사유를 입력하세요 (선택):`,
      "",
    );
    if (reason === null) return;
    setActingTransitionId(tx.id);
    setError(null);
    try {
      const updated = await transitionApi.deleteTransition(id, tx.id, {
        reason: reason.trim() || null,
      });
      mergeTransition(updated);
      setSuccess("전이가 삭제 처리되었습니다.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`삭제 실패: ${msg}`);
    } finally {
      setActingTransitionId(null);
    }
  }

  async function handleRestoreTransition(tx: LoopTransitionDetail) {
    if (!id) return;
    const reason = window.prompt(
      `이 전이를 복원하시겠습니까?\n\n복원 사유를 입력하세요 (선택):`,
      "",
    );
    if (reason === null) return;
    setActingTransitionId(tx.id);
    setError(null);
    try {
      const updated = await transitionApi.restoreTransition(id, tx.id, {
        reason: reason.trim() || null,
      });
      mergeTransition(updated);
      setSuccess("전이가 복원되었습니다.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`복원 실패: ${msg}`);
    } finally {
      setActingTransitionId(null);
    }
  }

  const sortedTransitions = useMemo(
    () =>
      [...transitions].sort(
        (a, b) =>
          new Date(b.transitioned_at).getTime() -
          new Date(a.transitioned_at).getTime(),
      ),
    [transitions],
  );

  const transitionsWithGap = useMemo(() => {
    return sortedTransitions.map((tx, idx) => {
      const next = sortedTransitions[idx + 1];
      const gapMs = next
        ? new Date(tx.transitioned_at).getTime() -
          new Date(next.transitioned_at).getTime()
        : null;
      return { tx, gapMs };
    });
  }, [sortedTransitions]);

  return (
    <>
      <ContentHeader
        title={ticket ? `티켓 ${ticket.ticket_no}` : "티켓 상세"}
        description={ticket?.title}
        actions={
          <Button variant="secondary" onClick={() => navigate("/tickets")}>
            목록
          </Button>
        }
      />

      <div className="max-w-content mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-4">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert variant="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
        ) : !ticket ? (
          <Alert variant="error">티켓을 찾을 수 없습니다.</Alert>
        ) : (
          <>
            <LoopProgress
              currentStage={ticket.current_stage}
              transitions={transitions}
              openedAt={ticket.opened_at}
              closedAt={ticket.closed_at}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Card>
                  <CardBody>
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold">기본 정보</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="티켓번호">
                        <span className="font-mono">{ticket.ticket_no}</span>
                      </Field>
                      <Field label="현재 단계">
                        <Badge variant={STAGE_BADGE[ticket.current_stage]}>
                          {LOOP_STAGE_LABELS[ticket.current_stage]}
                        </Badge>
                      </Field>
                      <Field label="우선순위">
                        <Badge variant={PRIORITY_BADGE[ticket.priority]}>
                          {PRIORITY_LABELS[ticket.priority]}
                        </Badge>
                      </Field>
                      <Field label="접수 채널">
                        {CHANNEL_SOURCE_LABELS[ticket.source_channel]}
                        {ticket.source_ref ? ` · ${ticket.source_ref}` : ""}
                      </Field>
                      <Field label="카테고리">
                        {[ticket.category_l1, ticket.category_l2]
                          .filter(Boolean)
                          .join(" / ") || "-"}
                      </Field>
                      <Field label="재오픈 횟수">
                        {ticket.reopened_count}
                      </Field>
                      <Field label="접수일시">
                        {formatDate(ticket.opened_at)}
                      </Field>
                      <Field label="종료일시">
                        {formatDate(ticket.closed_at)}
                      </Field>
                    </div>

                    <div className="mt-4 space-y-1">
                      <div className="text-xs text-muted-foreground">설명</div>
                      <MarkdownView value={ticket.description} />
                    </div>
                  </CardBody>
                </Card>

                <div className="mt-4">
                  <Card>
                    <CardBody>
                      <div className="mb-3">
                        <h3 className="text-lg font-semibold">
                          서비스 / 고객 정보
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="서비스 구분">
                          {SERVICE_TYPE_LABELS[ticket.service_type]}
                        </Field>
                        <Field label="고객사">
                          {customer
                            ? `${customer.code} · ${customer.name}`
                            : ticket.customer_id || "-"}
                        </Field>
                        <Field label="제품">
                          {product
                            ? `${product.code} · ${product.name}`
                            : ticket.product_id || "-"}
                        </Field>
                        <Field label="계약">
                          {contract
                            ? `${contract.contract_no} · ${contract.name}`
                            : ticket.contract_id || "-"}
                        </Field>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>

              <div>
                <Card>
                  <CardBody>
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold">Loop 액션</h3>
                      <p className="text-sm text-muted-foreground">
                        현재 단계에서 허용된 전이를 선택하세요.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {actions && actions.allowed.length > 0 ? (
                        actions.allowed.map((a) => (
                          <Button
                            key={a}
                            variant={ACTION_VARIANT[a]}
                            onClick={() => {
                              setDrawerAction(a);
                              setNote("");
                            }}
                            className="w-full justify-center"
                          >
                            {LOOP_ACTION_LABELS[a]}
                          </Button>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          허용된 액션이 없습니다.
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              </div>
            </div>

            <Card>
              <CardBody>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-content-tertiary" />
                      전이 이력
                    </h3>
                    <p className="text-xs text-content-tertiary mt-0.5">
                      최신 전이가 상단에 표시됩니다 · 총{" "}
                      {sortedTransitions.length}건
                    </p>
                  </div>
                </div>
                {sortedTransitions.length === 0 ? (
                  <div className="text-sm text-content-tertiary py-8 text-center">
                    아직 전이 이력이 없습니다.
                  </div>
                ) : (
                  <ol className="relative space-y-3">
                    {transitionsWithGap.map(({ tx, gapMs }, idx) => {
                      const tone = ACTION_TONE[tx.action];
                      const ActionIcon = ACTION_ICON[tx.action] ?? CircleDot;
                      const fromMeta = tx.from_stage
                        ? STAGE_META[tx.from_stage]
                        : null;
                      const toMeta = STAGE_META[tx.to_stage];
                      const FromIcon = fromMeta?.icon;
                      const ToIcon = toMeta.icon;
                      const isLatest = idx === 0;

                      const isDeleted = tx.deleted_at !== null;
                      const isActing = actingTransitionId === tx.id;
                      return (
                        <li key={tx.id} className="relative">
                          <div
                            className={`rounded-lg border bg-surface-primary p-3 sm:p-4 transition-shadow hover:shadow-sm ${
                              isDeleted
                                ? "border-line opacity-60"
                                : isLatest
                                  ? `${tone.border} ring-1 ring-offset-0`
                                  : "border-line"
                            }`}
                          >
                            <div className="flex flex-wrap items-start gap-3">
                              <div
                                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${tone.dot} text-white shadow-sm`}
                              >
                                <ActionIcon className="h-4 w-4" />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tone.chip}`}
                                  >
                                    {LOOP_ACTION_LABELS[tx.action]}
                                  </span>
                                  {isLatest && !isDeleted && (
                                    <span className="inline-flex items-center rounded-full bg-brand-50 border border-brand-200 text-brand-700 px-2 py-0.5 text-[10px] font-medium">
                                      최신
                                    </span>
                                  )}
                                  {isDeleted && (
                                    <Badge variant="danger">삭제됨</Badge>
                                  )}
                                  {tx.edit_count > 0 && (
                                    <Badge variant="warning">
                                      편집됨 {tx.edit_count}회
                                    </Badge>
                                  )}
                                  <span className="text-xs text-content-tertiary tabular-nums ml-auto">
                                    {formatDate(tx.transitioned_at)}
                                  </span>
                                </div>

                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                                  {fromMeta && FromIcon ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-surface-secondary px-1.5 py-0.5 text-content-primary">
                                      <FromIcon className="h-3.5 w-3.5 text-content-tertiary" />
                                      {fromMeta.label}
                                    </span>
                                  ) : (
                                    <span className="text-content-tertiary">
                                      —
                                    </span>
                                  )}
                                  <ArrowRight className="h-3.5 w-3.5 text-content-tertiary" />
                                  <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 text-brand-700 px-1.5 py-0.5 font-medium">
                                    <ToIcon className="h-3.5 w-3.5" />
                                    {toMeta.label}
                                  </span>
                                  <span className="text-[11px] text-content-tertiary">
                                    · {toMeta.role}
                                  </span>
                                </div>

                                {tx.note && (
                                  <div className="mt-2 rounded-md bg-surface-secondary px-3 py-2">
                                    <MarkdownView value={tx.note} />
                                  </div>
                                )}

                                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-content-tertiary">
                                  {tx.actor_id !== null && (
                                    <span className="inline-flex items-center gap-1">
                                      <UserIcon className="h-3 w-3" />
                                      actor #{tx.actor_id}
                                    </span>
                                  )}
                                  {gapMs !== null && gapMs > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      직전 전이 후{" "}
                                      {formatDurationShort(gapMs)}
                                    </span>
                                  )}
                                  {tx.artifacts &&
                                    Object.keys(tx.artifacts).length > 0 && (
                                      <span className="inline-flex items-center gap-1">
                                        <ChevronRight className="h-3 w-3" />
                                        artifacts{" "}
                                        {Object.keys(tx.artifacts).length}건
                                      </span>
                                    )}
                                </div>

                                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setRevisionsTransition(tx)}
                                  >
                                    <History className="h-3.5 w-3.5 mr-1" />
                                    히스토리
                                  </Button>
                                  {tx.can_edit && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => setEditingTransition(tx)}
                                      disabled={isActing}
                                    >
                                      <Pencil className="h-3.5 w-3.5 mr-1" />
                                      편집
                                    </Button>
                                  )}
                                  {tx.can_delete && (
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() =>
                                        void handleDeleteTransition(tx)
                                      }
                                      loading={isActing}
                                      disabled={isActing}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                                      삭제
                                    </Button>
                                  )}
                                  {tx.can_restore && (
                                    <Button
                                      size="sm"
                                      variant="success"
                                      onClick={() =>
                                        void handleRestoreTransition(tx)
                                      }
                                      loading={isActing}
                                      disabled={isActing}
                                    >
                                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                      복원
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>

      <Drawer
        isOpen={!!drawerAction}
        onClose={() => {
          if (submitting) return;
          setDrawerAction(null);
          setNote("");
        }}
        title={drawerAction ? LOOP_ACTION_LABELS[drawerAction] : "전이"}
        size="lg"
        footer={
          <DrawerFooter
            onCancel={() => {
              setDrawerAction(null);
              setNote("");
            }}
            onConfirm={() => void handleSubmitAction()}
            loading={submitting}
            confirmVariant={drawerAction === "reject" ? "danger" : "primary"}
            confirmText={
              drawerAction ? LOOP_ACTION_LABELS[drawerAction] : "확인"
            }
          />
        }
      >
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {drawerAction === "note"
              ? "현재 단계에서 진행한 처리 내용을 Markdown 으로 기록하세요. 전이 이력에 누적 표시됩니다."
              : "전이 사유/메모를 남기면 이력에 기록됩니다."}
          </div>
          <RichEditor
            label={drawerAction === "note" ? "처리 내용" : "메모"}
            value={note}
            onChange={setNote}
            placeholder={
              drawerAction === "note"
                ? "처리 내용을 입력하세요 (Markdown 지원)"
                : "선택 사항"
            }
            minHeight={260}
          />
        </div>
      </Drawer>

      <TransitionEditDrawer
        isOpen={editingTransition !== null}
        ticketId={id ?? ""}
        transition={editingTransition}
        onClose={() => setEditingTransition(null)}
        onSaved={(updated) => {
          mergeTransition(updated);
          setSuccess(`전이 편집이 저장되었습니다 (리비전 #${updated.edit_count + 1})`);
        }}
      />

      <TransitionRevisionsDialog
        isOpen={revisionsTransition !== null}
        ticketId={id ?? ""}
        transition={revisionsTransition}
        onClose={() => setRevisionsTransition(null)}
        onReverted={(updated) => {
          mergeTransition(updated);
          setRevisionsTransition(updated);
          setSuccess("전이가 선택한 리비전으로 되돌려졌습니다.");
        }}
      />
    </>
  );
}
