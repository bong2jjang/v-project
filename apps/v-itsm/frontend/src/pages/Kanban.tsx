/**
 * v-itsm Loop 칸반 보드.
 *
 * 각 Loop Stage(intake → analyze → execute → verify → answer)별 컬럼.
 * 카드 클릭 시 상세 페이지로 이동, 실제 단계 전이는 상세에서 FSM 가드를 통해 수행.
 * closed 단계는 별도 영역으로 분리 표시.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [productFilter, setProductFilter] = useState<string>("");

  const [kpi, setKpi] = useState<KpiSummary | null>(null);

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

  return (
    <>
      <ContentHeader
        title="Loop 칸반"
        description="Loop 단계별 티켓 흐름을 한눈에 확인합니다."
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
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {ACTIVE_STAGES.map((stage) => {
                const items = grouped.get(stage) ?? [];
                return (
                  <div
                    key={stage}
                    className="bg-surface-muted rounded-md border border-line flex flex-col min-h-[300px]"
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
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => navigate(`/tickets/${t.id}`)}
                            className={`w-full text-left bg-surface rounded-md ${STAGE_ACCENT[stage]} p-3 shadow-sm hover:shadow-md transition-shadow`}
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
                          </button>
                        ))
                      )}
                    </div>
                  </div>
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
          </>
        )}
      </div>
    </>
  );
}
