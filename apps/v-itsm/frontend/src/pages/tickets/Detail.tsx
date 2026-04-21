/**
 * v-itsm 티켓 상세 + Loop FSM 진행 페이지.
 *
 * 좌: 티켓 정보(읽기 전용), 우: Loop 상태·허용 액션 버튼 + 전이 모달.
 * 하단: 전이 이력 타임라인.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ContentHeader } from "../../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Modal,
  ModalFooter,
  Skeleton,
  Textarea,
} from "../../components/ui";
import * as ticketApi from "../../lib/api/tickets";
import * as customerApi from "../../lib/api/customers";
import * as productApi from "../../lib/api/products";
import * as contractApi from "../../lib/api/contracts";
import type {
  AllowedActions,
  Contract,
  Customer,
  LoopAction,
  LoopStage,
  LoopTransition,
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
  const [transitions, setTransitions] = useState<LoopTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);

  const [modalAction, setModalAction] = useState<LoopAction | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [t, a, txs] = await Promise.all([
        ticketApi.getTicket(id),
        ticketApi.getAllowedActions(id),
        ticketApi.listTransitions(id),
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
    if (!id || !modalAction) return;
    setSubmitting(true);
    setError(null);
    try {
      await ticketApi.transitionTicket(id, {
        action: modalAction,
        note: note.trim() || null,
      });
      setSuccess(`'${LOOP_ACTION_LABELS[modalAction]}' 처리 완료`);
      setModalAction(null);
      setNote("");
      await loadAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`전이 실패: ${msg}`);
    } finally {
      setSubmitting(false);
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
                      <div className="text-sm whitespace-pre-wrap">
                        {ticket.description || "-"}
                      </div>
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
                              setModalAction(a);
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
                <div className="mb-3">
                  <h3 className="text-lg font-semibold">전이 이력</h3>
                </div>
                {sortedTransitions.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    아직 전이 이력이 없습니다.
                  </div>
                ) : (
                  <ol className="relative border-l border-line ml-2 space-y-4">
                    {sortedTransitions.map((tx) => (
                      <li key={tx.id} className="ml-4">
                        <div className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-brand-500" />
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">
                            {LOOP_ACTION_LABELS[tx.action]}
                          </Badge>
                          <span className="text-sm">
                            {tx.from_stage
                              ? LOOP_STAGE_LABELS[tx.from_stage]
                              : "—"}{" "}
                            → {LOOP_STAGE_LABELS[tx.to_stage]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(tx.transitioned_at)}
                          </span>
                        </div>
                        {tx.note && (
                          <div className="text-sm mt-1 whitespace-pre-wrap">
                            {tx.note}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>
          </>
        )}
      </div>

      <Modal
        open={!!modalAction}
        onClose={() => setModalAction(null)}
        title={modalAction ? LOOP_ACTION_LABELS[modalAction] : "전이"}
      >
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            전이 사유/메모를 남기면 이력에 기록됩니다.
          </div>
          <Textarea
            label="메모"
            rows={4}
            placeholder="선택 사항"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setModalAction(null)}>
            취소
          </Button>
          <Button
            variant="primary"
            loading={submitting}
            onClick={() => void handleSubmitAction()}
          >
            확인
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
