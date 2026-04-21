/**
 * v-itsm 티켓 목록 페이지.
 *
 * 필터: stage / priority / service_type / customer / product + 페이지네이션.
 * 행 클릭 시 상세 페이지 이동. "티켓 접수" 버튼으로 신규 접수.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui";
import * as ticketApi from "../../lib/api/tickets";
import * as customerApi from "../../lib/api/customers";
import * as productApi from "../../lib/api/products";
import type {
  Customer,
  LoopStage,
  Priority,
  Product,
  RequestServiceType,
  Ticket,
} from "../../lib/api/itsmTypes";
import {
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

const STAGE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "전체 단계" },
  { value: "intake", label: LOOP_STAGE_LABELS.intake },
  { value: "analyze", label: LOOP_STAGE_LABELS.analyze },
  { value: "execute", label: LOOP_STAGE_LABELS.execute },
  { value: "verify", label: LOOP_STAGE_LABELS.verify },
  { value: "answer", label: LOOP_STAGE_LABELS.answer },
  { value: "closed", label: LOOP_STAGE_LABELS.closed },
];

const PRIORITY_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "전체 우선순위" },
  { value: "critical", label: PRIORITY_LABELS.critical },
  { value: "high", label: PRIORITY_LABELS.high },
  { value: "normal", label: PRIORITY_LABELS.normal },
  { value: "low", label: PRIORITY_LABELS.low },
];

const SERVICE_TYPE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "전체 서비스" },
  { value: "internal", label: SERVICE_TYPE_LABELS.internal },
  { value: "on_premise", label: SERVICE_TYPE_LABELS.on_premise },
  { value: "saas", label: SERVICE_TYPE_LABELS.saas },
  { value: "partner", label: SERVICE_TYPE_LABELS.partner },
];

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

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function TicketsIndex() {
  const navigate = useNavigate();

  const [items, setItems] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stage, setStage] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [serviceType, setServiceType] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [cs, ps] = await Promise.all([
          customerApi.listCustomers({ page_size: 100, status: "active" }),
          productApi.listProducts({ page_size: 100, active: true }),
        ]);
        setCustomers(cs.items);
        setProducts(ps.items);
      } catch {
        // 참조 데이터 실패는 치명적이지 않음
      }
    })();
  }, []);

  async function fetchList(targetPage = page) {
    setLoading(true);
    setError(null);
    try {
      const params: ticketApi.TicketListParams = {
        page: targetPage,
        page_size: PAGE_SIZE,
      };
      if (stage) params.stage = stage as LoopStage;
      if (serviceType) params.service_type = serviceType as RequestServiceType;
      if (customerId) params.customer_id = customerId;
      if (productId) params.product_id = productId;
      const res = await ticketApi.listTickets(params);
      let filtered = res.items;
      // priority 는 서버 필터 미지원 — 클라이언트 필터
      if (priority) {
        filtered = filtered.filter((t) => t.priority === priority);
      }
      setItems(filtered);
      setTotal(res.total);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`티켓 목록 조회 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchList(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const customerMap = useMemo(() => {
    const m = new Map<string, Customer>();
    for (const c of customers) m.set(c.id, c);
    return m;
  }, [customers]);

  const productMap = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const customerFilterOptions = useMemo(
    () => [
      { value: "", label: "전체 고객사" },
      ...customers.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` })),
    ],
    [customers],
  );

  const productFilterOptions = useMemo(
    () => [
      { value: "", label: "전체 제품" },
      ...products.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
    ],
    [products],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleSearch() {
    setPage(1);
    void fetchList(1);
  }

  function handleReset() {
    setStage("");
    setPriority("");
    setServiceType("");
    setCustomerId("");
    setProductId("");
    setPage(1);
    // 다음 이펙트 대신 직접 호출: 상태 갱신이 비동기이므로 빈 파라미터로 호출
    void (async () => {
      setLoading(true);
      try {
        const res = await ticketApi.listTickets({ page: 1, page_size: PAGE_SIZE });
        setItems(res.items);
        setTotal(res.total);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`티켓 목록 조회 실패: ${msg}`);
      } finally {
        setLoading(false);
      }
    })();
  }

  function goToPage(target: number) {
    const bounded = Math.max(1, Math.min(totalPages, target));
    setPage(bounded);
    void fetchList(bounded);
  }

  return (
    <>
      <ContentHeader
        title="티켓 목록"
        description="접수된 티켓을 조회하고 Loop 처리 현황을 확인합니다."
        actions={
          <Button
            variant="primary"
            onClick={() => navigate("/tickets/new")}
            icon={<Plus className="w-4 h-4" />}
          >
            티켓 접수
          </Button>
        }
      />

      <div className="max-w-content mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-4">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <Select
                label="단계"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                options={STAGE_FILTER_OPTIONS}
              />
              <Select
                label="우선순위"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                options={PRIORITY_FILTER_OPTIONS}
              />
              <Select
                label="서비스 구분"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                options={SERVICE_TYPE_FILTER_OPTIONS}
              />
              <Select
                label="고객사"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                options={customerFilterOptions}
              />
              <Select
                label="제품"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                options={productFilterOptions}
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" onClick={handleReset}>
                초기화
              </Button>
              <Button variant="primary" onClick={handleSearch} loading={loading}>
                조회
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                title="조회된 티켓이 없습니다"
                description="필터를 조정하거나 신규 티켓을 접수하세요."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>티켓번호</TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead>단계</TableHead>
                      <TableHead>우선순위</TableHead>
                      <TableHead>서비스</TableHead>
                      <TableHead>고객사</TableHead>
                      <TableHead>제품</TableHead>
                      <TableHead>접수일시</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((t) => {
                      const c = t.customer_id
                        ? customerMap.get(t.customer_id)
                        : null;
                      const p = t.product_id
                        ? productMap.get(t.product_id)
                        : null;
                      return (
                        <TableRow
                          key={t.id}
                          onClick={() => navigate(`/tickets/${t.id}`)}
                          className="cursor-pointer hover:bg-muted/40"
                        >
                          <TableCell className="font-mono text-xs">
                            {t.ticket_no}
                          </TableCell>
                          <TableCell className="font-medium">
                            {t.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STAGE_BADGE[t.current_stage]}>
                              {LOOP_STAGE_LABELS[t.current_stage]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={PRIORITY_BADGE[t.priority]}>
                              {PRIORITY_LABELS[t.priority]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {SERVICE_TYPE_LABELS[t.service_type]}
                          </TableCell>
                          <TableCell className="text-sm">
                            {c ? `${c.code} · ${c.name}` : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {p ? `${p.code} · ${p.name}` : "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(t.opened_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {total > 0 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  총 {total}건 · 페이지 {page}/{totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={page <= 1 || loading}
                    onClick={() => goToPage(page - 1)}
                  >
                    이전
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={page >= totalPages || loading}
                    onClick={() => goToPage(page + 1)}
                  >
                    다음
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
