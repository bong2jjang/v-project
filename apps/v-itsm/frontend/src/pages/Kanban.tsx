/**
 * v-itsm Loop 칸반 보드.
 *
 * 각 Loop Stage(intake → analyze → execute → verify → answer)별 컬럼.
 * 드래그로 인접 단계 advance / rollback 전이(FSM 허용 시).
 * 클릭은 상세 페이지로 이동(5px 이하 이동은 클릭으로 간주).
 * closed 단계는 별도 영역으로 분리 표시.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ApiClientError } from "@v-platform/core/api/client";
import { ContentHeader } from "../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Select,
  Skeleton,
} from "../components/ui";
import * as ticketApi from "../lib/api/tickets";
import * as customerApi from "../lib/api/customers";
import * as productApi from "../lib/api/products";
import { getKpiSummary } from "../lib/api/kpi";
import type {
  Customer,
  KpiSummary,
  LoopAction,
  LoopStage,
  Priority,
  Product,
  RequestServiceType,
  Ticket,
} from "../lib/api/itsmTypes";
import {
  LOOP_STAGE_LABELS,
  PRIORITY_LABELS,
  SERVICE_TYPE_LABELS,
} from "../lib/api/itsmTypes";

type BadgeVariant =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "default"
  | "error"
  | "secondary";

const ACTIVE_STAGES: LoopStage[] = [
  "intake",
  "analyze",
  "execute",
  "verify",
  "answer",
];

const PRIORITY_BADGE: Record<Priority, BadgeVariant> = {
  critical: "error",
  high: "danger",
  normal: "info",
  low: "secondary",
};

const STAGE_ACCENT: Record<LoopStage, string> = {
  intake: "border-l-4 border-l-blue-500",
  analyze: "border-l-4 border-l-purple-500",
  execute: "border-l-4 border-l-amber-500",
  verify: "border-l-4 border-l-cyan-500",
  answer: "border-l-4 border-l-emerald-500",
  closed: "border-l-4 border-l-neutral-400",
};

// 드래그 전이 규칙: (fromStage, toStage) → LoopAction (null = 불가)
function resolveDragAction(
  from: LoopStage,
  to: LoopStage,
): LoopAction | null {
  if (from === to) return null;
  // advance: 순방향 인접 단계
  const forward: Partial<Record<LoopStage, LoopStage>> = {
    intake: "analyze",
    analyze: "execute",
    execute: "verify",
    verify: "answer",
  };
  if (forward[from] === to) return "advance";
  // rollback: 역방향 인접 단계 (execute→analyze, verify→execute)
  const backward: Partial<Record<LoopStage, LoopStage>> = {
    execute: "analyze",
    verify: "execute",
  };
  if (backward[from] === to) return "rollback";
  return null;
}

const ACTION_LABEL: Record<LoopAction, string> = {
  advance: "진행",
  reject: "반려",
  on_hold: "보류",
  resume: "재개",
  rollback: "롤백",
  reopen: "재개",
  note: "메모",
};

const PRIORITY_OPTIONS = [
  { value: "", label: "전체 우선순위" },
  { value: "critical", label: PRIORITY_LABELS.critical },
  { value: "high", label: PRIORITY_LABELS.high },
  { value: "normal", label: PRIORITY_LABELS.normal },
  { value: "low", label: PRIORITY_LABELS.low },
];

const SERVICE_TYPE_OPTIONS = [
  { value: "", label: "전체 서비스" },
  { value: "internal", label: SERVICE_TYPE_LABELS.internal },
  { value: "on_premise", label: SERVICE_TYPE_LABELS.on_premise },
  { value: "saas", label: SERVICE_TYPE_LABELS.saas },
  { value: "partner", label: SERVICE_TYPE_LABELS.partner },
];

type KpiTone = "default" | "info" | "warning" | "danger";

const KPI_TONE: Record<KpiTone, string> = {
  default: "text-content-primary",
  info: "text-info-600",
  warning: "text-warning-600",
  danger: "text-danger-600",
};

function formatNumber(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n);
}

function formatMinutes(m: number | null): string {
  if (m === null || Number.isNaN(m)) return "-";
  if (m < 60) return `${Math.round(m)}분`;
  const hours = Math.floor(m / 60);
  const mins = Math.round(m % 60);
  if (hours < 24) return `${hours}시간 ${mins}분`;
  const days = Math.floor(hours / 24);
  return `${days}일 ${hours % 24}시간`;
}

function MiniKpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: KpiTone;
}) {
  return (
    <Card>
      <CardBody>
        <div className="text-xs text-content-tertiary">{label}</div>
        <div className={`mt-0.5 text-xl font-semibold ${KPI_TONE[tone]}`}>
          {value}
        </div>
      </CardBody>
    </Card>
  );
}

function DroppableColumn({
  stage,
  isInvalid,
  isDragging,
  children,
}: {
  stage: LoopStage;
  isInvalid: boolean;
  isDragging: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${stage}` });
  // 드롭 불가 컬럼: 드래그 내내 흐림 처리 → 호버 시 강한 붉은 링 + 배지로 명시
  const ring =
    isOver && isInvalid
      ? "ring-2 ring-status-danger"
      : isOver
        ? "ring-2 ring-brand-500"
        : "";
  const dim = isDragging && isInvalid && !isOver ? "opacity-60" : "";
  return (
    <div
      ref={setNodeRef}
      className={`relative bg-surface-muted rounded-md border border-line flex flex-col min-h-[300px] transition-all ${ring} ${dim}`}
    >
      {isOver && isInvalid && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none rounded-md bg-status-danger-light/70">
          <span className="px-3 py-1 rounded-md bg-status-danger text-white text-xs font-semibold shadow-md">
            이동 불가
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

function DraggableCard({
  ticket,
  stage,
  children,
  onClick,
}: {
  ticket: Ticket;
  stage: LoopStage;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `card:${ticket.id}`,
      data: { fromStage: stage },
    });
  // 드래그 중이면 원본은 자리만 유지(투명) — DragOverlay 가 상단에서 실제 카드를 렌더링
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`w-full text-left bg-surface rounded-md ${STAGE_ACCENT[stage]} p-3 shadow-sm hover:shadow-md transition-shadow select-none`}
    >
      {children}
    </div>
  );
}

function OverlayCard({
  ticket,
  customerCode,
  productCode,
}: {
  ticket: Ticket;
  customerCode: string | null;
  productCode: string | null;
}) {
  return (
    <div
      className={`bg-surface rounded-md ${STAGE_ACCENT[ticket.current_stage]} p-3 shadow-2xl ring-2 ring-brand-500 cursor-grabbing select-none`}
      style={{ transform: "rotate(-2deg)" }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-muted-foreground">
          {ticket.ticket_no}
        </span>
        <Badge variant={PRIORITY_BADGE[ticket.priority]}>
          {PRIORITY_LABELS[ticket.priority]}
        </Badge>
      </div>
      <div className="text-sm font-medium line-clamp-2 mb-2">
        {ticket.title}
      </div>
      <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
        <span>{SERVICE_TYPE_LABELS[ticket.service_type]}</span>
        {customerCode && (
          <>
            <span>·</span>
            <span>{customerCode}</span>
          </>
        )}
        {productCode && (
          <>
            <span>·</span>
            <span>{productCode}</span>
          </>
        )}
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const diffMs = Date.now() - then;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "방금";
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    const days = Math.floor(hrs / 24);
    return `${days}일 전`;
  } catch {
    return iso;
  }
}

export default function Kanban() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [customers, setCustomers] = useState<Map<string, Customer>>(new Map());
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<LoopStage | null>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  // 마지막 성공 전이 — Undo 버튼 렌더 용. 10초 후 자동 소멸.
  const [lastTransition, setLastTransition] = useState<{
    ticketId: string;
    ticketNo: string;
    from: LoopStage;
    to: LoopStage;
    action: LoopAction;
  } | null>(null);
  const [undoing, setUndoing] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [productFilter, setProductFilter] = useState<string>("");

  const [kpi, setKpi] = useState<KpiSummary | null>(null);

  // 클릭과 드래그 구분: 5px 이상 이동해야 드래그 시작
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // 언마운트 시 Undo 타이머 정리
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  function scheduleUndoExpiry() {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    undoTimerRef.current = setTimeout(() => {
      setLastTransition(null);
      undoTimerRef.current = null;
    }, 10_000);
  }

  function clearUndo() {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setLastTransition(null);
  }

  useEffect(() => {
    let cancelled = false;
    const fetchKpi = async () => {
      try {
        const data = await getKpiSummary();
        if (!cancelled) setKpi(data);
      } catch {
        // 미니 스트립은 선택적 정보 — 실패해도 칸반 본체 영향 없음
      }
    };
    void fetchKpi();
    const id = setInterval(() => void fetchKpi(), 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [cs, ps] = await Promise.all([
          customerApi.listCustomers({ page_size: 100 }),
          productApi.listProducts({ page_size: 100 }),
        ]);
        setCustomers(new Map(cs.items.map((c) => [c.id, c])));
        setProducts(new Map(ps.items.map((p) => [p.id, p])));
      } catch {
        // 참조 데이터 실패는 카드 렌더에 치명적이지 않음
      }
    })();
  }, []);

  async function loadTickets() {
    setLoading(true);
    setError(null);
    try {
      const res = await ticketApi.listTickets({
        page_size: 100,
        service_type: (serviceFilter || undefined) as
          | RequestServiceType
          | undefined,
        customer_id: customerFilter || undefined,
        product_id: productFilter || undefined,
      });
      const filtered = priorityFilter
        ? res.items.filter((t) => t.priority === priorityFilter)
        : res.items;
      setTickets(filtered);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`티켓 조회 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priorityFilter, serviceFilter, customerFilter, productFilter]);

  const grouped = useMemo(() => {
    const map = new Map<LoopStage, Ticket[]>();
    for (const s of [...ACTIVE_STAGES, "closed" as LoopStage]) {
      map.set(s, []);
    }
    for (const t of tickets) {
      map.get(t.current_stage)?.push(t);
    }
    for (const s of map.keys()) {
      map.get(s)?.sort((a, b) => {
        const order: Record<Priority, number> = {
          critical: 0,
          high: 1,
          normal: 2,
          low: 3,
        };
        const pa = order[a.priority] - order[b.priority];
        if (pa !== 0) return pa;
        return (
          new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime()
        );
      });
    }
    return map;
  }, [tickets]);

  const customerOptions = useMemo(
    () => [
      { value: "", label: "전체 고객사" },
      ...Array.from(customers.values()).map((c) => ({
        value: c.id,
        label: `${c.code} · ${c.name}`,
      })),
    ],
    [customers],
  );

  const productOptions = useMemo(
    () => [
      { value: "", label: "전체 제품" },
      ...Array.from(products.values()).map((p) => ({
        value: p.id,
        label: `${p.code} · ${p.name}`,
      })),
    ],
    [products],
  );

  const closedTickets = grouped.get("closed") ?? [];

  function handleDragStart(ev: DragStartEvent) {
    const from = (ev.active.data.current as
      | { fromStage?: LoopStage }
      | undefined)?.fromStage;
    setDraggingFrom(from ?? null);
    setActiveTicketId(String(ev.active.id).replace(/^card:/, ""));
    // 새 드래그 시작 시 이전 Undo 후보는 소멸 (UX 단순화)
    clearUndo();
  }

  function handleDragCancel() {
    setDraggingFrom(null);
    setActiveTicketId(null);
  }

  async function handleDragEnd(ev: DragEndEvent) {
    const fromStage = draggingFrom;
    setDraggingFrom(null);
    setActiveTicketId(null);
    const { active, over } = ev;
    if (!over) return;
    const ticketId = String(active.id).replace(/^card:/, "");
    const toStage = String(over.id).replace(/^col:/, "") as LoopStage;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return;
    const from = fromStage ?? ticket.current_stage;
    if (from === toStage) return;
    const action = resolveDragAction(from, toStage);
    if (!action) {
      setError(
        `허용되지 않는 전이입니다: ${ticket.ticket_no} · ${LOOP_STAGE_LABELS[from]} → ${LOOP_STAGE_LABELS[toStage]}`,
      );
      return;
    }
    // optimistic 업데이트
    const prev = tickets;
    setTickets((cur) =>
      cur.map((t) => (t.id === ticketId ? { ...t, current_stage: toStage } : t)),
    );
    try {
      await ticketApi.transitionTicket(ticketId, { action });
      setInfo(null);
      setLastTransition({
        ticketId,
        ticketNo: ticket.ticket_no,
        from,
        to: toStage,
        action,
      });
      scheduleUndoExpiry();
      // 서버 재계산 결과(SLA/정책)만 해당 티켓 기준으로 병합 — 전체 refetch 는 Skeleton 깜박임을 유발해 회피
      try {
        const refreshed = await ticketApi.getTicket(ticketId);
        setTickets((cur) =>
          cur.map((t) => (t.id === ticketId ? refreshed : t)),
        );
      } catch {
        // 단일 조회 실패는 치명적이지 않음 — optimistic 상태 유지
      }
    } catch (e: unknown) {
      // 실패 시 원복 + 사용자에게 상태 코드 포함 명시 오류 표시
      setTickets(prev);
      let status = "";
      let detail = "";
      if (e instanceof ApiClientError) {
        status = `[HTTP ${e.status}] `;
        detail = e.message;
      } else if (e instanceof Error) {
        detail = e.message;
      } else {
        detail = String(e);
      }
      setError(
        `전이 실패 ${status}· ${ticket.ticket_no} ${LOOP_STAGE_LABELS[from]} → ${LOOP_STAGE_LABELS[toStage]} (${ACTION_LABEL[action]}): ${detail}`,
      );
    }
  }

  async function handleUndo() {
    if (!lastTransition || undoing) return;
    const { ticketId, ticketNo, from, to, action } = lastTransition;
    // 역방향 전이 action 재계산: to → from 이 FSM 상 허용되는지 확인
    const reverseAction = resolveDragAction(to, from);
    if (!reverseAction) {
      setError(
        `되돌리기 불가 · ${ticketNo} ${LOOP_STAGE_LABELS[to]} → ${LOOP_STAGE_LABELS[from]} (${ACTION_LABEL[action]} 역방향 미허용)`,
      );
      clearUndo();
      return;
    }
    setUndoing(true);
    // optimistic revert
    const snapshot = tickets;
    setTickets((cur) =>
      cur.map((t) => (t.id === ticketId ? { ...t, current_stage: from } : t)),
    );
    try {
      await ticketApi.transitionTicket(ticketId, {
        action: reverseAction,
        note: "Kanban UI 되돌리기",
      });
      setInfo(
        `되돌리기 완료 · ${ticketNo} ${LOOP_STAGE_LABELS[to]} → ${LOOP_STAGE_LABELS[from]} (${ACTION_LABEL[reverseAction]})`,
      );
      clearUndo();
      try {
        const refreshed = await ticketApi.getTicket(ticketId);
        setTickets((cur) =>
          cur.map((t) => (t.id === ticketId ? refreshed : t)),
        );
      } catch {
        // best-effort merge
      }
    } catch (e: unknown) {
      setTickets(snapshot);
      let status = "";
      let detail = "";
      if (e instanceof ApiClientError) {
        status = `[HTTP ${e.status}] `;
        detail = e.message;
      } else if (e instanceof Error) {
        detail = e.message;
      } else {
        detail = String(e);
      }
      setError(
        `되돌리기 실패 ${status}· ${ticketNo} ${LOOP_STAGE_LABELS[to]} → ${LOOP_STAGE_LABELS[from]} (${ACTION_LABEL[reverseAction]}): ${detail}`,
      );
    } finally {
      setUndoing(false);
    }
  }

  const activeTicket = activeTicketId
    ? tickets.find((t) => t.id === activeTicketId) ?? null
    : null;

  return (
    <>
      <ContentHeader
        title="Loop 칸반"
        description="Loop 단계별 티켓 흐름을 한눈에 확인합니다. 카드를 인접 단계로 드래그하여 전이할 수 있습니다."
        actions={
          <Button variant="secondary" onClick={() => void loadTickets()}>
            새로고침
          </Button>
        }
      />

      <div className="max-w-content mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-4">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {lastTransition ? (
          <Alert variant="success" onClose={clearUndo}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span>
                {lastTransition.ticketNo}{" "}
                {LOOP_STAGE_LABELS[lastTransition.from]} →{" "}
                {LOOP_STAGE_LABELS[lastTransition.to]} (
                {ACTION_LABEL[lastTransition.action]})
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={undoing}
                onClick={() => void handleUndo()}
              >
                {undoing ? "되돌리는 중…" : "실행취소"}
              </Button>
            </div>
          </Alert>
        ) : (
          info && (
            <Alert variant="success" onClose={() => setInfo(null)}>
              {info}
            </Alert>
          )
        )}

        {kpi && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniKpiCard
              label="진행중"
              value={formatNumber(kpi.open_tickets)}
              tone="info"
            />
            <MiniKpiCard
              label="SLA 경고"
              value={formatNumber(kpi.sla_warning)}
              tone="warning"
            />
            <MiniKpiCard
              label="SLA 위반"
              value={formatNumber(kpi.sla_breached)}
              tone="danger"
            />
            <MiniKpiCard
              label="MTTR"
              value={formatMinutes(kpi.mttr_minutes)}
            />
          </div>
        )}

        <Card>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Select
                label="우선순위"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                options={PRIORITY_OPTIONS}
              />
              <Select
                label="서비스 구분"
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                options={SERVICE_TYPE_OPTIONS}
              />
              <Select
                label="고객사"
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                options={customerOptions}
              />
              <Select
                label="제품"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                options={productOptions}
              />
            </div>
          </CardBody>
        </Card>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {ACTIVE_STAGES.map((s) => (
              <Skeleton key={s} className="h-80 w-full" />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragCancel={handleDragCancel}
            onDragEnd={(ev) => void handleDragEnd(ev)}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {ACTIVE_STAGES.map((stage) => {
                const items = grouped.get(stage) ?? [];
                const isInvalid =
                  draggingFrom !== null &&
                  draggingFrom !== stage &&
                  resolveDragAction(draggingFrom, stage) === null;
                return (
                  <DroppableColumn
                    key={stage}
                    stage={stage}
                    isInvalid={isInvalid}
                    isDragging={draggingFrom !== null}
                  >
                    <div className="px-3 py-2 border-b border-line flex items-center justify-between">
                      <div className="text-sm font-semibold">
                        {LOOP_STAGE_LABELS[stage]}
                      </div>
                      <Badge variant="default">{items.length}</Badge>
                    </div>
                    <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[70vh]">
                      {items.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-6">
                          해당 단계 티켓 없음
                        </div>
                      ) : (
                        items.map((t) => (
                          <DraggableCard
                            key={t.id}
                            ticket={t}
                            stage={stage}
                            onClick={() => navigate(`/tickets/${t.id}`)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-mono text-muted-foreground">
                                {t.ticket_no}
                              </span>
                              <Badge variant={PRIORITY_BADGE[t.priority]}>
                                {PRIORITY_LABELS[t.priority]}
                              </Badge>
                            </div>
                            <div className="text-sm font-medium line-clamp-2 mb-2">
                              {t.title}
                            </div>
                            <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                              <span>
                                {SERVICE_TYPE_LABELS[t.service_type]}
                              </span>
                              {t.customer_id && customers.get(t.customer_id) && (
                                <>
                                  <span>·</span>
                                  <span>
                                    {customers.get(t.customer_id)!.code}
                                  </span>
                                </>
                              )}
                              {t.product_id && products.get(t.product_id) && (
                                <>
                                  <span>·</span>
                                  <span>
                                    {products.get(t.product_id)!.code}
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="mt-2 text-xs text-muted-foreground">
                              접수 {formatRelative(t.opened_at)}
                            </div>
                          </DraggableCard>
                        ))
                      )}
                    </div>
                  </DroppableColumn>
                );
              })}
            </div>

            {closedTickets.length > 0 && (
              <Card>
                <CardBody>
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-base font-semibold">
                      {LOOP_STAGE_LABELS.closed}
                    </h3>
                    <Badge variant="default">{closedTickets.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {closedTickets.slice(0, 12).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => navigate(`/tickets/${t.id}`)}
                        className={`text-left bg-surface-muted rounded-md ${STAGE_ACCENT.closed} p-3 hover:bg-surface transition-colors`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-muted-foreground">
                            {t.ticket_no}
                          </span>
                          <Badge variant={PRIORITY_BADGE[t.priority]}>
                            {PRIORITY_LABELS[t.priority]}
                          </Badge>
                        </div>
                        <div className="text-sm line-clamp-1">{t.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          종료 {t.closed_at ? formatRelative(t.closed_at) : "-"}
                        </div>
                      </button>
                    ))}
                  </div>
                  {closedTickets.length > 12 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      … 외 {closedTickets.length - 12}건
                    </div>
                  )}
                </CardBody>
              </Card>
            )}

            <DragOverlay dropAnimation={null}>
              {activeTicket && (
                <OverlayCard
                  ticket={activeTicket}
                  customerCode={
                    activeTicket.customer_id
                      ? customers.get(activeTicket.customer_id)?.code ?? null
                      : null
                  }
                  productCode={
                    activeTicket.product_id
                      ? products.get(activeTicket.product_id)?.code ?? null
                      : null
                  }
                />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </>
  );
}
