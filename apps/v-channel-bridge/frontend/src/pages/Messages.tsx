/**
 * Messages 페이지
 *
 * 메시지 히스토리 검색 및 필터링 — 미니 스탯바, 상태 탭, 스켈레톤 로딩, perPage 선택
 */

import { useState, useEffect, useCallback } from "react";
import {
  searchMessages,
  getMessageStats,
  exportMessagesCSV,
  exportMessagesJSON,
  generateTestData,
  type MessageSearchParams,
  type MessageStats,
} from "../lib/api/messages";
import { MessageCard } from "../components/messages/MessageCard";
import {
  FiltersPanel,
  type Filters,
} from "../components/messages/FiltersPanel";
import { Pagination } from "../components/messages/Pagination";
import { DeleteMessagesModal } from "../components/messages/DeleteMessagesModal";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Card, CardBody } from "../components/ui/Card";
import { ContentHeader } from "../components/Layout";
import { Toggle } from "../components/ui/Toggle";
import { useTour } from "../hooks/useTour";
import { useWebSocket } from "../hooks/useWebSocket";
import { useAuthStore } from "../store/auth";
import { usePermissionStore } from "../store/permission";
import { isAdminRole } from "../lib/api/types";
import type { WebSocketMessage } from "../lib/websocket/types";

// ── 상태 탭 정의 ────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { key: "", label: "전체" },
  { key: "sent", label: "전송완료" },
  { key: "partial_success", label: "부분성공" },
  { key: "failed", label: "실패" },
  { key: "retrying", label: "재시도중" },
  { key: "pending", label: "대기중" },
] as const;

// ── 스켈레톤 카드 ────────────────────────────────────────────────────────────
function MessageCardSkeleton() {
  return (
    <div className="border border-line rounded-card p-4 animate-pulse">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 bg-surface-raised rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface-raised rounded w-1/4" />
          <div className="h-3 bg-surface-raised rounded w-1/3" />
        </div>
        <div className="h-6 bg-surface-raised rounded w-16" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 bg-surface-raised rounded w-full" />
        <div className="h-3 bg-surface-raised rounded w-4/5" />
      </div>
      <div className="h-3 bg-surface-raised rounded w-1/2 pt-3 border-t border-line" />
    </div>
  );
}

// ── 미니 스탯 바 ─────────────────────────────────────────────────────────────
interface MiniStatItemProps {
  label: string;
  value: string | number;
  colorClass?: string;
}
function MiniStatItem({
  label,
  value,
  colorClass = "text-content-primary",
}: MiniStatItemProps) {
  return (
    <div className="flex flex-col items-center px-4 py-2">
      <span className={`text-heading-sm font-bold tabular-nums ${colorClass}`}>
        {value}
      </span>
      <span className="text-body-xs text-content-tertiary mt-0.5">{label}</span>
    </div>
  );
}

function MiniStatsBar({
  total,
  stats,
}: {
  total: number;
  stats: MessageStats | null;
}) {
  const sent = stats?.by_status?.sent ?? 0;
  const failed = stats?.by_status?.failed ?? 0;
  const withAttachment = stats?.with_attachment ?? 0;
  const successRate =
    stats?.success_rate != null ? `${stats.success_rate}%` : "—";

  return (
    <div className="flex items-center justify-center divide-x divide-line bg-surface-card border border-line rounded-card">
      <MiniStatItem label="검색 결과" value={total.toLocaleString() + "건"} />
      <MiniStatItem
        label="성공률"
        value={successRate}
        colorClass="text-green-600 dark:text-green-400"
      />
      <MiniStatItem
        label="전송 완료"
        value={sent.toLocaleString()}
        colorClass="text-green-600 dark:text-green-400"
      />
      <MiniStatItem
        label="실패"
        value={failed.toLocaleString()}
        colorClass={
          failed > 0 ? "text-red-600 dark:text-red-400" : "text-content-primary"
        }
      />
      <MiniStatItem label="첨부파일" value={withAttachment.toLocaleString()} />
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
const Messages = () => {
  const { startPageTour } = useTour();
  const { token, user } = useAuthStore();

  const isAdmin = isAdminRole(user?.role);
  const canEdit = usePermissionStore().canWrite("messages");

  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [statusTab, setStatusTab] = useState<string>("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<number>(50);

  const [messages, setMessages] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const statusFilter =
        statusTab ||
        (Array.isArray(filters.status) ? filters.status[0] : filters.status) ||
        undefined;
      const params: MessageSearchParams = {
        q: searchQuery || undefined,
        route: filters.route || undefined,
        src_channel: filters.src_channel?.length
          ? filters.src_channel
          : undefined,
        dst_channel: filters.dst_channel?.length
          ? filters.dst_channel
          : undefined,
        user: filters.user || undefined,
        status: statusFilter,
        from_date: filters.from_date
          ? `${filters.from_date}T00:00:00`
          : undefined,
        to_date: filters.to_date ? `${filters.to_date}T23:59:59` : undefined,
        page,
        per_page: perPage,
        sort: "timestamp_desc",
      };

      const statsParams = {
        from_date: filters.from_date
          ? `${filters.from_date}T00:00:00`
          : undefined,
        to_date: filters.to_date ? `${filters.to_date}T23:59:59` : undefined,
      };

      const [result, statsResult] = await Promise.all([
        searchMessages(params),
        getMessageStats(statsParams).catch(() => null),
      ]);

      setMessages(result.messages);
      setTotal(result.total);
      setTotalPages(result.total_pages);
      setStats(statsResult);
    } catch (err: any) {
      setError(err.message || "메시지를 불러오는데 실패했습니다");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filters, statusTab, page, perPage]);

  // WebSocket 핸들러
  const handleWebSocketMessage = useCallback(
    (message: WebSocketMessage) => {
      if (message.type === "message_created" && message.data) {
        if (page === 1 && !searchQuery && Object.keys(filters).length === 0) {
          setMessages((prev) => [message.data, ...prev]);
          setTotal((prev) => prev + 1);
          setSuccessMessage("새 메시지가 도착했습니다!");
          setTimeout(() => setSuccessMessage(null), 3000);
        }
      }
    },
    [page, searchQuery, filters],
  );

  const wsUrl = token
    ? `ws://${window.location.hostname}:8000/api/ws?token=${encodeURIComponent(token)}`
    : "";

  const { isConnected, send } = useWebSocket({
    url: wsUrl,
    onMessage: handleWebSocketMessage,
    autoConnect: false,
  });

  useEffect(() => {
    if (isConnected && realtimeEnabled) {
      send({ type: "subscribe", data: { channels: ["messages"] } });
    }
  }, [isConnected, realtimeEnabled, send]);

  // fetchMessages가 재생성될 때마다(deps 변경 시) 자동 실행
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSearch = () => {
    setPage(1);
    fetchMessages();
  };

  const handleClearFilters = () => {
    setFilters({});
    setSearchQuery("");
    setStatusTab("");
    setPage(1);
  };

  const handleStatusTab = (key: string) => {
    setStatusTab(key);
    setPage(1);
    // fetchMessages는 useEffect([fetchMessages])로 자동 트리거됨
  };

  const handlePerPageChange = (value: number) => {
    setPerPage(value);
    setPage(1);
  };

  const handleExportCSV = async () => {
    try {
      const blob = await exportMessagesCSV({
        q: searchQuery || undefined,
        route: filters.route || undefined,
        channel:
          (Array.isArray(filters.channel)
            ? filters.channel[0]
            : filters.channel) || undefined,
        user: filters.user,
        status:
          (Array.isArray(filters.status)
            ? filters.status[0]
            : filters.status) || undefined,
        from_date: filters.from_date,
        to_date: filters.to_date,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `messages_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccessMessage("CSV로 내보내기 완료!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "CSV 내보내기에 실패했습니다");
    }
  };

  const handleExportJSON = async () => {
    try {
      const blob = await exportMessagesJSON({
        q: searchQuery || undefined,
        route: filters.route || undefined,
        channel:
          (Array.isArray(filters.channel)
            ? filters.channel[0]
            : filters.channel) || undefined,
        user: filters.user,
        status:
          (Array.isArray(filters.status)
            ? filters.status[0]
            : filters.status) || undefined,
        from_date: filters.from_date,
        to_date: filters.to_date,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `messages_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccessMessage("JSON으로 내보내기 완료!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "JSON 내보내기에 실패했습니다");
    }
  };

  const handleGenerateTestData = async () => {
    try {
      await generateTestData(100);
      setSuccessMessage("테스트 메시지 100개가 생성되었습니다!");
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchMessages();
    } catch (err: any) {
      setError(err.message || "테스트 데이터 생성에 실패했습니다");
    }
  };

  const handleDeleteSuccess = (deletedCount: number) => {
    setSuccessMessage(`${deletedCount}개의 메시지가 삭제되었습니다!`);
    setTimeout(() => setSuccessMessage(null), 3000);
    fetchMessages();
  };

  const hasActiveFilters =
    searchQuery ||
    filters.gateway ||
    filters.src_channel?.length ||
    filters.dst_channel?.length ||
    filters.user ||
    filters.status ||
    filters.from_date ||
    filters.to_date ||
    statusTab;

  return (
    <>
      <ContentHeader
        title="메시지 히스토리"
        description="브리지를 통해 전송된 모든 메시지 히스토리 검색 및 분석"
        actions={
          <>
            {/* Real-time 토글 */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white text-brand-700 rounded-button hover:bg-white/90 dark:bg-brand-600 dark:text-content-inverse dark:hover:bg-brand-700 transition-colors duration-normal">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span className="text-body-base font-medium">Real-time</span>
              <Toggle
                checked={realtimeEnabled}
                onChange={setRealtimeEnabled}
                label="Real-time 업데이트 토글"
                size="sm"
              />
              <span className="text-body-base font-semibold min-w-[24px]">
                {realtimeEnabled ? "ON" : "OFF"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white text-brand-700 rounded-button hover:bg-white/90 dark:bg-brand-600 dark:text-content-inverse dark:hover:bg-brand-700 transition-colors duration-normal"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportJSON}
              className="flex items-center gap-2 px-4 py-2 bg-white text-brand-700 rounded-button hover:bg-white/90 dark:bg-brand-600 dark:text-content-inverse dark:hover:bg-brand-700 transition-colors duration-normal"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              JSON
            </button>

            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={handleGenerateTestData}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-brand-700 rounded-button hover:bg-white/90 dark:bg-brand-600 dark:text-content-inverse dark:hover:bg-brand-700 transition-colors duration-normal"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                    />
                  </svg>
                  테스트 데이터
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-button hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors duration-normal border border-red-200 dark:border-red-800"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  메시지 삭제
                </button>
              </>
            )}
          </>
        }
      />

      <div className="page-container space-y-section-gap">
        {successMessage && (
          <Alert variant="success" onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}
        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 검색 + 필터 패널 */}
        <div data-tour="message-search">
          <FiltersPanel
            filters={filters}
            onChange={setFilters}
            onClear={handleClearFilters}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            onSearch={handleSearch}
          />
        </div>

        {/* 미니 스탯 바 */}
        <div data-tour="message-stats">
          <MiniStatsBar total={total} stats={stats} />
        </div>

        {/* 결과 카드 */}
        <Card data-tour="message-list">
          <CardBody>
            {/* 상단: 상태 탭 + perPage + 새로고침 */}
            <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
              {/* 상태 탭 */}
              <div className="flex items-center gap-1 bg-surface-base rounded-lg p-1">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleStatusTab(tab.key)}
                    className={`px-3 py-1.5 rounded-md text-body-sm font-medium transition-colors duration-normal ${
                      statusTab === tab.key
                        ? "bg-surface-card shadow-sm text-content-primary border border-line"
                        : "text-content-secondary hover:text-content-primary"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                {/* perPage 셀렉터 */}
                <div className="flex items-center gap-1.5 text-body-sm text-content-secondary">
                  <span>페이지당</span>
                  <select
                    value={perPage}
                    onChange={(e) =>
                      handlePerPageChange(Number(e.target.value))
                    }
                    className="border border-line rounded-md px-2 py-1 text-body-sm bg-surface-card text-content-primary focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value={25}>25개</option>
                    <option value={50}>50개</option>
                    <option value={100}>100개</option>
                  </select>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={fetchMessages}
                  disabled={isLoading}
                  icon={
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                  }
                >
                  새로고침
                </Button>
              </div>
            </div>

            {/* 목록 */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <MessageCardSkeleton key={i} />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-14">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-surface-raised mb-4">
                  <svg
                    className="h-7 w-7 text-content-tertiary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h3 className="text-heading-sm text-content-primary mb-1">
                  {hasActiveFilters
                    ? "조건에 맞는 메시지가 없습니다"
                    : "아직 메시지가 없습니다"}
                </h3>
                <p className="text-body-base text-content-secondary mb-4">
                  {hasActiveFilters
                    ? "검색 조건이나 필터를 변경해 보세요."
                    : "브리지가 활성화되면 메시지가 여기에 표시됩니다."}
                </p>
                <div className="flex items-center justify-center gap-2">
                  {hasActiveFilters && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleClearFilters}
                    >
                      필터 초기화
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => startPageTour("messages")}
                    icon={
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        />
                      </svg>
                    }
                  >
                    사용 방법 보기
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <MessageCard key={message.id} message={message} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination
                  current={page}
                  total={totalPages}
                  onChange={setPage}
                  totalItems={total}
                  perPage={perPage}
                />
              </div>
            )}
          </CardBody>
        </Card>

        <DeleteMessagesModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onSuccess={handleDeleteSuccess}
          currentFilters={{
            gateway:
              (Array.isArray(filters.gateway)
                ? filters.gateway[0]
                : filters.gateway) || undefined,
            channel:
              (Array.isArray(filters.channel)
                ? filters.channel[0]
                : filters.channel) || undefined,
            user: filters.user,
            from_date: filters.from_date,
            to_date: filters.to_date,
          }}
        />
      </div>
    </>
  );
};

export default Messages;
