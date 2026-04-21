/**
 * v-itsm SLA 모니터 페이지.
 *
 * SLA 타이머 현황(진행중/경고/위반/충족)을 실시간 조회하고,
 * 위반/경고 티켓을 빠르게 식별할 수 있도록 표로 렌더링한다.
 * 30초 주기로 자동 새로고침.
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
  EmptyState,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui";
import * as slaApi from "../lib/api/slaTimers";
import type {
  LoopStage,
  Priority,
  RequestServiceType,
  SlaSummary,
  SlaTimer,
  SlaTimerKind,
  SlaTimerStatus,
} from "../lib/api/itsmTypes";
import {
  LOOP_STAGE_LABELS,
  PRIORITY_LABELS,
  SERVICE_TYPE_LABELS,
  SLA_TIMER_KIND_LABELS,
  SLA_TIMER_STATUS_LABELS,
} from "../lib/api/itsmTypes";

type BadgeVariant =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "default"
  | "error"
  | "secondary";

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "전체 상태" },
  { value: "active", label: SLA_TIMER_STATUS_LABELS.active },
  { value: "warning", label: SLA_TIMER_STATUS_LABELS.warning },
  { value: "breached", label: SLA_TIMER_STATUS_LABELS.breached },
  { value: "satisfied", label: SLA_TIMER_STATUS_LABELS.satisfied },
];

const KIND_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "전체 종류" },
  { value: "response", label: SLA_TIMER_KIND_LABELS.response },
  { value: "resolution", label: SLA_TIMER_KIND_LABELS.resolution },
];

const PRIORITY_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "전체 우선순위" },
  { value: "critical", label: PRIORITY_LABELS.critical },
  { value: "high", label: PRIORITY_LABELS.high },
  { value: "normal", label: PRIORITY_LABELS.normal },
  { value: "low", label: PRIORITY_LABELS.low },
];

const STATUS_BADGE: Record<SlaTimerStatus, BadgeVariant> = {
  active: "info",
  warning: "warning",
  breached: "error",
  satisfied: "success",
};

const KIND_BADGE: Record<SlaTimerKind, BadgeVariant> = {
  response: "info",
  resolution: "secondary",
};

const PRIORITY_BADGE: Record<Priority, BadgeVariant> = {
  critical: "error",
  high: "danger",
  normal: "info",
  low: "secondary",
};

const STAGE_BADGE: Record<LoopStage, BadgeVariant> = {
  intake: "info",
  analyze: "secondary",
  execute: "warning",
  verify: "info",
  answer: "success",
  closed: "default",
};

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatRemaining(
  seconds: number,
  status: SlaTimerStatus,
): { text: string; tone: "danger" | "warning" | "muted" | "success" } {
  if (status === "satisfied") {
    return { text: "충족", tone: "success" };
  }
  const abs = Math.abs(seconds);
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const minutes = Math.floor((abs % 3600) / 60);

  let text: string;
  if (days > 0) text = `${days}일 ${hours}시간`;
  else if (hours > 0) text = `${hours}시간 ${minutes}분`;
  else text = `${minutes}분`;

  if (seconds < 0) return { text: `${text} 초과`, tone: "danger" };
  if (status === "warning") return { text: `${text} 남음`, tone: "warning" };
  return { text: `${text} 남음`, tone: "muted" };
}

const TONE_CLASS: Record<"danger" | "warning" | "muted" | "success", string> = {
  danger: "text-red-600 dark:text-red-400 font-semibold",
  warning: "text-yellow-700 dark:text-yellow-400 font-medium",
  muted: "text-muted-foreground",
  success: "text-green-600 dark:text-green-400",
};

export default function SlaMonitor() {
  const navigate = useNavigate();

  const [items, setItems] = useState<SlaTimer[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<SlaSummary | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<string>("");
  const [kind, setKind] = useState<string>("");
  const [priority, setPriority] = useState<string>("");

  async function fetchAll(targetPage = page) {
    setLoading(true);
    setError(null);
    try {
      const params: slaApi.SlaTimerListParams = {
        page: targetPage,
        page_size: PAGE_SIZE,
      };
      if (status) params.status = status as SlaTimerStatus;
      if (kind) params.kind = kind as SlaTimerKind;
      if (priority) params.priority = priority as Priority;

      const [list, sum] = await Promise.all([
        slaApi.listSlaTimers(params),
        slaApi.getSlaSummary(),
      ]);
      setItems(list.items);
      setTotal(list.total);
      setSummary(sum);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`SLA 타이머 조회 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchAll(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void fetchAll(page);
    }, 30_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, kind, priority]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );

  function handleSearch() {
    setPage(1);
    void fetchAll(1);
  }

  function handleReset() {
    setStatus("");
    setKind("");
    setPriority("");
    setPage(1);
    void (async () => {
      setLoading(true);
      try {
        const [list, sum] = await Promise.all([
          slaApi.listSlaTimers({ page: 1, page_size: PAGE_SIZE }),
          slaApi.getSlaSummary(),
        ]);
        setItems(list.items);
        setTotal(list.total);
        setSummary(sum);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`SLA 타이머 조회 실패: ${msg}`);
      } finally {
        setLoading(false);
      }
    })();
  }

  function goToPage(target: number) {
    const bounded = Math.max(1, Math.min(totalPages, target));
    setPage(bounded);
    void fetchAll(bounded);
  }

  return (
    <>
      <ContentHeader
        title="SLA 모니터"
        description="응답·해결 SLA 타이머 현황을 실시간 조회합니다. 30초 주기로 자동 갱신됩니다."
      />

      <div className="max-w-content mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-4">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryCard
            label="전체"
            value={summary?.total ?? 0}
            tone="default"
          />
          <SummaryCard
            label={SLA_TIMER_STATUS_LABELS.active}
            value={summary?.active ?? 0}
            tone="info"
          />
          <SummaryCard
            label={SLA_TIMER_STATUS_LABELS.warning}
            value={summary?.warning ?? 0}
            tone="warning"
          />
          <SummaryCard
            label={SLA_TIMER_STATUS_LABELS.breached}
            value={summary?.breached ?? 0}
            tone="danger"
          />
          <SummaryCard
            label={SLA_TIMER_STATUS_LABELS.satisfied}
            value={summary?.satisfied ?? 0}
            tone="success"
          />
        </div>

        {/* 필터 */}
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select
                label="상태"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={STATUS_FILTER_OPTIONS}
              />
              <Select
                label="종류"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                options={KIND_FILTER_OPTIONS}
              />
              <Select
                label="우선순위"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                options={PRIORITY_FILTER_OPTIONS}
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

        {/* 목록 */}
        <Card>
          <CardBody>
            {loading && items.length === 0 ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                title="SLA 타이머가 없습니다"
                description="접수된 티켓에 SLA 티어가 연결되면 타이머가 생성됩니다."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>티켓번호</TableHead>
                      <TableHead>제목</TableHead>
                      <TableHead>종류</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>우선순위</TableHead>
                      <TableHead>단계</TableHead>
                      <TableHead>서비스</TableHead>
                      <TableHead>마감시각</TableHead>
                      <TableHead>잔여</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((t) => {
                      const remaining = formatRemaining(
                        t.remaining_seconds,
                        t.status,
                      );
                      return (
                        <TableRow
                          key={t.id}
                          onClick={() => navigate(`/tickets/${t.ticket_id}`)}
                          className="cursor-pointer hover:bg-muted/40"
                        >
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {t.ticket_no}
                          </TableCell>
                          <TableCell className="font-medium">
                            {t.ticket_title}
                          </TableCell>
                          <TableCell>
                            <Badge variant={KIND_BADGE[t.kind]}>
                              {SLA_TIMER_KIND_LABELS[t.kind]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_BADGE[t.status]}>
                              {SLA_TIMER_STATUS_LABELS[t.status]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={PRIORITY_BADGE[t.ticket_priority]}>
                              {PRIORITY_LABELS[t.ticket_priority]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={STAGE_BADGE[t.ticket_stage]}>
                              {LOOP_STAGE_LABELS[t.ticket_stage]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {SERVICE_TYPE_LABELS[t.ticket_service_type]}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDateTime(t.due_at)}
                          </TableCell>
                          <TableCell
                            className={`text-sm whitespace-nowrap ${TONE_CLASS[remaining.tone]}`}
                          >
                            {remaining.text}
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

interface SummaryCardProps {
  label: string;
  value: number;
  tone: "default" | "info" | "warning" | "danger" | "success";
}

const TONE_HEADING: Record<SummaryCardProps["tone"], string> = {
  default: "text-content-primary",
  info: "text-blue-600 dark:text-blue-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  danger: "text-red-600 dark:text-red-400",
  success: "text-green-600 dark:text-green-400",
};

function SummaryCard({ label, value, tone }: SummaryCardProps) {
  return (
    <Card>
      <CardBody>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${TONE_HEADING[tone]}`}>
          {value.toLocaleString("ko-KR")}
        </div>
      </CardBody>
    </Card>
  );
}
