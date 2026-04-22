/**
 * v-itsm 알림 로그 모니터링 페이지.
 *
 * outbound provider 가 전송한 메시지 로그(성공/실패/대기) 조회 + 실패 건 재시도.
 */

import { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, RotateCw } from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Modal,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui";
import * as api from "../../lib/api/notificationLogs";
import type {
  NotificationLog,
  NotificationLogFilter,
  NotificationLogStatus,
} from "../../lib/api/itsmTypes";
import { NOTIFICATION_LOG_STATUS_LABELS } from "../../lib/api/itsmTypes";

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "전체 상태" },
  { value: "pending", label: NOTIFICATION_LOG_STATUS_LABELS.pending },
  { value: "success", label: NOTIFICATION_LOG_STATUS_LABELS.success },
  { value: "failure", label: NOTIFICATION_LOG_STATUS_LABELS.failure },
];

const CHANNEL_FILTER_OPTIONS = [
  { value: "", label: "전체 채널" },
  { value: "slack", label: "Slack" },
  { value: "teams", label: "Teams" },
  { value: "email", label: "Email" },
];

const PAGE_SIZE_OPTIONS = [
  { value: "20", label: "20개" },
  { value: "50", label: "50개" },
  { value: "100", label: "100개" },
];

function statusVariant(s: NotificationLogStatus): "success" | "error" | "default" {
  if (s === "success") return "success";
  if (s === "failure") return "error";
  return "default";
}

function formatTs(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { hour12: false });
}

export default function NotificationLogs() {
  const [items, setItems] = useState<NotificationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("");
  const [ticketIdFilter, setTicketIdFilter] = useState<string>("");
  const [targetUserIdFilter, setTargetUserIdFilter] = useState<string>("");
  const [sinceFilter, setSinceFilter] = useState<string>("");
  const [untilFilter, setUntilFilter] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");

  const [detail, setDetail] = useState<NotificationLog | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const filter = useMemo<NotificationLogFilter>(() => {
    const f: NotificationLogFilter = {
      page,
      page_size: pageSize,
    };
    if (statusFilter) f.status = statusFilter as NotificationLogStatus;
    if (channelFilter) f.channel = channelFilter;
    if (eventTypeFilter) f.event_type = eventTypeFilter;
    if (ticketIdFilter) f.ticket_id = ticketIdFilter;
    if (targetUserIdFilter) {
      const n = Number(targetUserIdFilter);
      if (Number.isFinite(n) && n > 0) f.target_user_id = n;
    }
    if (sinceFilter) f.since = sinceFilter;
    if (untilFilter) f.until = untilFilter;
    if (searchFilter) f.search = searchFilter;
    return f;
  }, [
    page,
    pageSize,
    statusFilter,
    channelFilter,
    eventTypeFilter,
    ticketIdFilter,
    targetUserIdFilter,
    sinceFilter,
    untilFilter,
    searchFilter,
  ]);

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listNotificationLogs(filter);
      setItems(res.items);
      setTotal(res.total);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`알림 로그 조회 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    pageSize,
    statusFilter,
    channelFilter,
    eventTypeFilter,
    ticketIdFilter,
    targetUserIdFilter,
    sinceFilter,
    untilFilter,
    searchFilter,
  ]);

  function resetFilters() {
    setPage(1);
    setStatusFilter("");
    setChannelFilter("");
    setEventTypeFilter("");
    setTicketIdFilter("");
    setTargetUserIdFilter("");
    setSinceFilter("");
    setUntilFilter("");
    setSearchFilter("");
  }

  async function handleRetry(log: NotificationLog) {
    if (!confirm(`로그 ${log.id} 를 재시도하시겠습니까?`)) return;
    setRetrying(log.id);
    setError(null);
    try {
      const res = await api.retryNotificationLog(log.id);
      setSuccess(res.message || "재시도가 예약되었습니다.");
      await fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`재시도 실패: ${msg}`);
    } finally {
      setRetrying(null);
    }
  }

  return (
    <>
      <ContentHeader
        title="알림 로그"
        description={`총 ${total}건 — Slack / Teams / Email outbound provider 전송 이력`}
        actions={
          <Button variant="secondary" onClick={() => void fetchList()}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
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
        {success && (
          <Alert variant="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <Card>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select
                label="상태"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={STATUS_FILTER_OPTIONS}
              />
              <Select
                label="채널"
                value={channelFilter}
                onChange={(e) => {
                  setChannelFilter(e.target.value);
                  setPage(1);
                }}
                options={CHANNEL_FILTER_OPTIONS}
              />
              <Input
                label="이벤트 타입"
                placeholder="sla_warning / loop_transition …"
                value={eventTypeFilter}
                onChange={(e) => {
                  setEventTypeFilter(e.target.value);
                  setPage(1);
                }}
              />
              <Input
                label="티켓 ID"
                placeholder="ULID"
                value={ticketIdFilter}
                onChange={(e) => {
                  setTicketIdFilter(e.target.value);
                  setPage(1);
                }}
              />
              <Input
                label="대상 사용자 ID"
                type="number"
                min={1}
                value={targetUserIdFilter}
                onChange={(e) => {
                  setTargetUserIdFilter(e.target.value);
                  setPage(1);
                }}
              />
              <Input
                label="시작 시각"
                type="datetime-local"
                value={sinceFilter}
                onChange={(e) => {
                  setSinceFilter(e.target.value);
                  setPage(1);
                }}
              />
              <Input
                label="종료 시각"
                type="datetime-local"
                value={untilFilter}
                onChange={(e) => {
                  setUntilFilter(e.target.value);
                  setPage(1);
                }}
              />
              <Input
                label="검색"
                placeholder="에러 메시지 / 대상"
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex justify-end mt-3">
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                필터 초기화
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : items.length === 0 ? (
              <EmptyState
                title="조건에 맞는 알림 로그가 없습니다"
                description="필터를 조정하거나 티켓에서 알림 이벤트를 발생시켜 보세요."
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>상태</TableHead>
                      <TableHead>채널</TableHead>
                      <TableHead>이벤트</TableHead>
                      <TableHead>티켓</TableHead>
                      <TableHead>대상</TableHead>
                      <TableHead>전송</TableHead>
                      <TableHead>생성</TableHead>
                      <TableHead className="w-28 text-right">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Badge variant={statusVariant(log.status)}>
                            {NOTIFICATION_LOG_STATUS_LABELS[log.status]}
                            {log.is_retry && " · 재시도"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.channel}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.event_type}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.ticket_id ?? "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {log.target_user_id
                            ? `#${log.target_user_id}`
                            : log.target_address ?? "-"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatTs(log.sent_at)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatTs(log.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDetail(log)}
                              title="상세"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {log.status === "failure" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleRetry(log)}
                                disabled={retrying === log.id}
                                title="재시도"
                              >
                                <RotateCw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-muted-foreground">
                    페이지 {page} / {totalPages} · 총 {total}건
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={String(pageSize)}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      options={PAGE_SIZE_OPTIONS}
                      className="w-24"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      이전
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      다음
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title="알림 로그 상세"
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setDetail(null)}>
            닫기
          </Button>
        }
      >
        {detail && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">ID</div>
                <div className="font-mono text-xs">{detail.id}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">상태</div>
                <div>
                  <Badge variant={statusVariant(detail.status)}>
                    {NOTIFICATION_LOG_STATUS_LABELS[detail.status]}
                  </Badge>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">채널</div>
                <div>{detail.channel}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">이벤트</div>
                <div className="font-mono text-xs">{detail.event_type}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">티켓</div>
                <div className="font-mono text-xs">{detail.ticket_id ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">대상</div>
                <div className="text-xs">
                  {detail.target_user_id
                    ? `user #${detail.target_user_id}`
                    : detail.target_address ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">생성</div>
                <div className="text-xs">{formatTs(detail.created_at)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">전송</div>
                <div className="text-xs">{formatTs(detail.sent_at)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">재시도</div>
                <div className="text-xs">
                  {detail.is_retry ? `원본: ${detail.retry_of_id ?? "-"}` : "원본"}
                </div>
              </div>
            </div>

            {detail.error && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">에러</div>
                <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                  {detail.error}
                </pre>
              </div>
            )}

            <div>
              <div className="text-xs text-muted-foreground mb-1">Payload</div>
              <pre className="bg-muted rounded p-2 text-xs overflow-auto max-h-80">
                {detail.payload
                  ? JSON.stringify(detail.payload, null, 2)
                  : "(없음)"}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
