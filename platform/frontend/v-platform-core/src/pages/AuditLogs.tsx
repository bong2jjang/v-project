/**
 * AuditLogs 페이지
 *
 * 감사 로그 조회, 필터링, CSV 내보내기 (관리자 전용)
 * - URL 쿼리 파라미터 동기화
 * - 날짜 범위 필터 (DateRangePicker)
 * - 이메일 디바운스 검색
 * - perPage 선택 (20/50/100)
 * - 로그 상세 모달
 * - CSV 내보내기
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import * as auditLogsApi from "../api/auditLogs";
import type { GetAuditLogsParams } from "../api/auditLogs";
import { ApiClientError } from "../api/client";
import type { AuditLog } from "../api/types";
import { Select } from "../components/ui/Select";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { ContentHeader } from "../components/layout/ContentHeader";
import { DateRangePicker } from "../components/ui/DateRangePicker";

// --- 스켈레톤 행 ---
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="h-4 w-32 bg-surface-raised rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-28 bg-surface-raised rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-20 bg-surface-raised rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-24 bg-surface-raised rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-40 bg-surface-raised rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-12 bg-surface-raised rounded-full" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-24 bg-surface-raised rounded" />
      </td>
    </tr>
  );
}

// --- 액션 한글화 매핑 ---
const ACTION_LABELS: Record<string, string> = {
  "user.login": "로그인",
  "user.logout": "로그아웃",
  "user.register": "회원가입",
  "user.update": "사용자 수정",
  "user.delete": "사용자 삭제",
  "user.role_change": "역할 변경",
  "user.password_change": "비밀번호 변경",
  "user.password_reset_request": "비밀번호 재설정 요청",
  "user.password_reset": "비밀번호 재설정",
  "bridge.start": "브리지 시작",
  "bridge.stop": "브리지 중지",
  "bridge.restart": "브리지 재시작",
  "bridge.route.add": "라우트 추가",
  "bridge.route.remove": "라우트 삭제",
  "config.read": "설정 조회",
  "config.update": "설정 변경",
  "config.backup": "설정 백업",
  "config.restore": "설정 복원",
  "channel.create": "채널 생성",
  "channel.update": "채널 수정",
  "channel.delete": "채널 삭제",
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  user: "사용자",
  config: "설정",
  bridge: "브리지",
  route: "라우트",
  channel: "채널",
};

// 액션 옵션 (카테고리별 그룹)
const ACTION_OPTIONS = [
  {
    group: "사용자",
    items: [
      { value: "user.login", label: "로그인" },
      { value: "user.logout", label: "로그아웃" },
      { value: "user.register", label: "회원가입" },
      { value: "user.update", label: "사용자 수정" },
      { value: "user.delete", label: "사용자 삭제" },
      { value: "user.role_change", label: "역할 변경" },
      { value: "user.password_change", label: "비밀번호 변경" },
      { value: "user.password_reset_request", label: "비밀번호 재설정 요청" },
      { value: "user.password_reset", label: "비밀번호 재설정" },
    ],
  },
  {
    group: "브리지",
    items: [
      { value: "bridge.start", label: "브리지 시작" },
      { value: "bridge.stop", label: "브리지 중지" },
      { value: "bridge.restart", label: "브리지 재시작" },
      { value: "bridge.route.add", label: "라우트 추가" },
      { value: "bridge.route.remove", label: "라우트 삭제" },
    ],
  },
  {
    group: "설정",
    items: [
      { value: "config.read", label: "설정 조회" },
      { value: "config.update", label: "설정 변경" },
      { value: "config.backup", label: "설정 백업" },
      { value: "config.restore", label: "설정 복원" },
    ],
  },
  {
    group: "채널",
    items: [
      { value: "channel.create", label: "채널 생성" },
      { value: "channel.update", label: "채널 수정" },
      { value: "channel.delete", label: "채널 삭제" },
    ],
  },
];

const PER_PAGE_OPTIONS = [20, 50, 100];

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatActionLabel(action: string): string {
  return ACTION_LABELS[action] || action;
}

function formatResourceType(type: string | null): string {
  if (!type) return "";
  return RESOURCE_TYPE_LABELS[type] || type;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// --- 상세 모달 ---
interface AuditLogDetailModalProps {
  log: AuditLog | null;
  isOpen: boolean;
  onClose: () => void;
}

function AuditLogDetailModal({
  log,
  isOpen,
  onClose,
}: AuditLogDetailModalProps) {
  if (!log) return null;

  let parsedDetails: Record<string, unknown> | null = null;
  if (log.details) {
    try {
      parsedDetails = JSON.parse(log.details);
    } catch {
      // details가 JSON이 아닌 경우 원문 표시
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="감사 로그 상세" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-label-sm text-content-tertiary">ID</p>
            <p className="text-body-sm text-content-primary">{log.id}</p>
          </div>
          <div>
            <p className="text-label-sm text-content-tertiary">시간</p>
            <p className="text-body-sm text-content-primary">
              {formatDate(log.timestamp)}
            </p>
          </div>
          <div>
            <p className="text-label-sm text-content-tertiary">사용자</p>
            <p className="text-body-sm text-content-primary">
              {log.user_email || "-"}
            </p>
          </div>
          <div>
            <p className="text-label-sm text-content-tertiary">액션</p>
            <p className="text-body-sm text-content-primary">
              {formatActionLabel(log.action)}{" "}
              <code className="text-label-sm bg-surface-raised px-1.5 py-0.5 rounded text-content-secondary">
                {log.action}
              </code>
            </p>
          </div>
          <div>
            <p className="text-label-sm text-content-tertiary">앱</p>
            <p className="text-body-sm text-content-primary">
              {log.app_id ? (
                <code className="text-label-sm bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded">
                  {log.app_id}
                </code>
              ) : (
                <span className="text-content-tertiary">플랫폼 공통</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-label-sm text-content-tertiary">리소스 타입</p>
            <p className="text-body-sm text-content-primary">
              {formatResourceType(log.resource_type) || "-"}
            </p>
          </div>
          <div>
            <p className="text-label-sm text-content-tertiary">리소스 ID</p>
            <p className="text-body-sm text-content-primary">
              {log.resource_id || "-"}
            </p>
          </div>
          <div>
            <p className="text-label-sm text-content-tertiary">상태</p>
            <p className="text-body-sm">
              <StatusBadge status={log.status} />
            </p>
          </div>
          <div>
            <p className="text-label-sm text-content-tertiary">IP 주소</p>
            <p className="text-body-sm text-content-primary">
              {log.ip_address || "-"}
            </p>
          </div>
        </div>

        {log.description && (
          <div>
            <p className="text-label-sm text-content-tertiary mb-1">설명</p>
            <p className="text-body-sm text-content-primary bg-surface-raised rounded-card p-3">
              {log.description}
            </p>
          </div>
        )}

        {log.error_message && (
          <div>
            <p className="text-label-sm text-status-danger mb-1">에러 메시지</p>
            <pre className="text-body-sm text-status-danger bg-status-danger-light rounded-card p-3 whitespace-pre-wrap break-words">
              {log.error_message}
            </pre>
          </div>
        )}

        {log.details && (
          <div>
            <p className="text-label-sm text-content-tertiary mb-1">
              상세 정보
            </p>
            <pre className="text-body-sm text-content-primary bg-surface-raised rounded-card p-3 whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
              {parsedDetails
                ? JSON.stringify(parsedDetails, null, 2)
                : log.details}
            </pre>
          </div>
        )}

        {log.user_agent && (
          <div>
            <p className="text-label-sm text-content-tertiary mb-1">
              User Agent
            </p>
            <p className="text-body-sm text-content-secondary bg-surface-raised rounded-card p-3 break-all">
              {log.user_agent}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// --- 상태 배지 ---
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "success":
      return <Badge variant="success">성공</Badge>;
    case "failure":
      return <Badge variant="danger">실패</Badge>;
    case "error":
      return <Badge variant="danger">오류</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

// --- 페이지네이션 ---
interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const pages = useMemo(() => {
    const result: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) result.push(i);
    } else {
      result.push(1);
      if (page > 3) result.push("ellipsis");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) result.push(i);
      if (page < totalPages - 2) result.push("ellipsis");
      result.push(totalPages);
    }
    return result;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="px-2.5 py-1.5 text-body-sm border border-line rounded-button bg-surface-card hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        이전
      </button>
      {pages.map((p, idx) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${idx}`} className="px-2 text-content-tertiary">
            ...
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-3 py-1.5 text-body-sm border rounded-button transition-colors ${
              p === page
                ? "bg-brand-600 text-content-inverse border-brand-700"
                : "border-line bg-surface-card hover:bg-surface-raised"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-2.5 py-1.5 text-body-sm border border-line rounded-button bg-surface-card hover:bg-surface-raised disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        다음
      </button>
    </div>
  );
}

// --- 메인 컴포넌트 ---
export default function AuditLogs() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL → 상태 초기화
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialPerPage = parseInt(searchParams.get("per_page") || "50", 10);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [perPage, setPerPage] = useState(
    PER_PAGE_OPTIONS.includes(initialPerPage) ? initialPerPage : 50,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 필터 상태
  const [actionFilter, setActionFilter] = useState(
    searchParams.get("action") || "",
  );
  const [emailInput, setEmailInput] = useState(
    searchParams.get("user_email") || "",
  );
  const [resourceTypeFilter, setResourceTypeFilter] = useState(
    searchParams.get("resource_type") || "",
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "",
  );
  const [fromDate, setFromDate] = useState(
    searchParams.get("start_date") || "",
  );
  const [toDate, setToDate] = useState(searchParams.get("end_date") || "");

  // 상세 모달
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // 디바운스된 이메일 값
  const debouncedEmail = useDebounce(emailInput, 300);

  // 활성 필터 수
  const activeFilterCount = [
    actionFilter,
    debouncedEmail,
    resourceTypeFilter,
    statusFilter,
    fromDate,
    toDate,
  ].filter(Boolean).length;

  // URL 동기화
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (perPage !== 50) params.set("per_page", String(perPage));
    if (actionFilter) params.set("action", actionFilter);
    if (debouncedEmail) params.set("user_email", debouncedEmail);
    if (resourceTypeFilter) params.set("resource_type", resourceTypeFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (fromDate) params.set("start_date", fromDate);
    if (toDate) params.set("end_date", toDate);
    setSearchParams(params, { replace: true });
  }, [
    page,
    perPage,
    actionFilter,
    debouncedEmail,
    resourceTypeFilter,
    statusFilter,
    fromDate,
    toDate,
    setSearchParams,
  ]);

  // 데이터 로드
  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params: GetAuditLogsParams = { page, per_page: perPage };
      if (actionFilter) params.action = actionFilter;
      if (debouncedEmail) params.user_email = debouncedEmail;
      if (resourceTypeFilter) params.resource_type = resourceTypeFilter;
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.start_date = fromDate;
      if (toDate) params.end_date = toDate;

      const response = await auditLogsApi.getAuditLogs(params);
      setLogs(response.logs);
      setTotal(response.total);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.getUserMessage());
      } else {
        setError("감사 로그를 불러오는 중 오류가 발생했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    perPage,
    actionFilter,
    debouncedEmail,
    resourceTypeFilter,
    statusFilter,
    fromDate,
    toDate,
  ]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // 필터 변경 시 페이지 리셋
  const handleFilterChange = useCallback(
    (setter: (v: string) => void) =>
      (e: React.ChangeEvent<HTMLSelectElement>) => {
        setter(e.target.value);
        setPage(1);
      },
    [],
  );

  const handlePerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPerPage(Number(e.target.value));
    setPage(1);
  };

  const resetFilters = () => {
    setActionFilter("");
    setEmailInput("");
    setResourceTypeFilter("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  // CSV 내보내기
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const params: Omit<GetAuditLogsParams, "page" | "per_page"> = {};
      if (actionFilter) params.action = actionFilter;
      if (debouncedEmail) params.user_email = debouncedEmail;
      if (resourceTypeFilter) params.resource_type = resourceTypeFilter;
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.start_date = fromDate;
      if (toDate) params.end_date = toDate;

      const blob = await auditLogsApi.exportAuditLogsCSV(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccessMessage("CSV 내보내기 완료!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.getUserMessage());
      } else {
        setError("CSV 내보내기에 실패했습니다.");
      }
    } finally {
      setIsExporting(false);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <>
      <ContentHeader
        title="감사 로그"
        description="시스템의 모든 활동을 추적하고 감사합니다"
      />

      <div className="page-container space-y-section-gap">
        {/* 알림 */}
        {error && (
          <Alert variant="danger" title="오류">
            {error}
          </Alert>
        )}
        {successMessage && (
          <Alert variant="success" title="완료">
            {successMessage}
          </Alert>
        )}

        {/* 필터 섹션 */}
        <div className="bg-surface-card border border-line rounded-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-heading-sm text-content-primary">
              필터
              {activeFilterCount > 0 && (
                <Badge variant="default" className="ml-2">
                  {activeFilterCount}개 활성
                </Badge>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  필터 초기화
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportCSV}
                loading={isExporting}
              >
                CSV 내보내기
              </Button>
            </div>
          </div>

          {/* 1행: 셀렉트 필터 4개 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Select
              label="액션"
              value={actionFilter}
              onChange={handleFilterChange(setActionFilter)}
            >
              <option value="">전체</option>
              {ACTION_OPTIONS.map((group) => (
                <optgroup key={group.group} label={group.group}>
                  {group.items.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>

            <Select
              label="리소스 타입"
              value={resourceTypeFilter}
              onChange={handleFilterChange(setResourceTypeFilter)}
            >
              <option value="">전체</option>
              <option value="user">사용자</option>
              <option value="config">설정</option>
              <option value="bridge">브리지</option>
              <option value="route">라우트</option>
              <option value="channel">채널</option>
            </Select>

            <Select
              label="상태"
              value={statusFilter}
              onChange={handleFilterChange(setStatusFilter)}
            >
              <option value="">전체</option>
              <option value="success">성공</option>
              <option value="failure">실패</option>
              <option value="error">오류</option>
            </Select>

            <div>
              <label className="block text-body-sm font-medium text-content-primary mb-1.5">
                사용자 이메일
              </label>
              <input
                type="text"
                placeholder="이메일 검색..."
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 text-body-sm bg-surface-card border border-line rounded-button text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
              />
            </div>
          </div>

          {/* 2행: 날짜 범위 */}
          <DateRangePicker
            label="기간"
            fromDate={fromDate}
            toDate={toDate}
            onFromDateChange={(date) => {
              setFromDate(date);
              setPage(1);
            }}
            onToDateChange={(date) => {
              setToDate(date);
              setPage(1);
            }}
          />
        </div>

        {/* 통계 카드 */}
        <div className="bg-surface-card border border-line rounded-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-body-sm text-content-tertiary">전체 로그</p>
                <p className="text-heading-lg text-content-primary">
                  {total.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-body-sm text-content-tertiary">
                  페이지 {page} / {totalPages || 1}
                </p>
                <p className="text-body-sm text-content-tertiary">
                  {total > 0
                    ? `${((page - 1) * perPage + 1).toLocaleString()}-${Math.min(page * perPage, total).toLocaleString()}건`
                    : "0건"}
                </p>
              </div>
              <Select value={String(perPage)} onChange={handlePerPageChange}>
                {PER_PAGE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}개씩
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* 로그 테이블 */}
        <div className="bg-surface-card border border-line rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-raised border-b border-line">
                <tr>
                  <th className="px-4 py-3 text-left text-label-sm text-content-secondary">
                    시간
                  </th>
                  <th className="px-4 py-3 text-left text-label-sm text-content-secondary">
                    앱
                  </th>
                  <th className="px-4 py-3 text-left text-label-sm text-content-secondary">
                    사용자
                  </th>
                  <th className="px-4 py-3 text-left text-label-sm text-content-secondary">
                    액션
                  </th>
                  <th className="px-4 py-3 text-left text-label-sm text-content-secondary">
                    리소스
                  </th>
                  <th className="px-4 py-3 text-left text-label-sm text-content-secondary">
                    설명
                  </th>
                  <th className="px-4 py-3 text-left text-label-sm text-content-secondary">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-label-sm text-content-secondary">
                    IP 주소
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {isLoading ? (
                  <>
                    {Array.from({ length: Math.min(perPage, 10) }).map(
                      (_, i) => (
                        <SkeletonRow key={i} />
                      ),
                    )}
                  </>
                ) : logs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-content-tertiary"
                    >
                      {activeFilterCount > 0
                        ? "필터 조건에 맞는 로그가 없습니다."
                        : "감사 로그가 없습니다."}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-surface-raised transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-body-sm text-content-primary whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-4 py-3 text-body-sm">
                        {log.app_id ? (
                          <code className="text-xs bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded">
                            {log.app_id.replace('v-', '')}
                          </code>
                        ) : (
                          <span className="text-xs text-content-tertiary">공통</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-body-sm text-content-primary">
                        {log.user_email || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-body-sm text-content-primary">
                          {formatActionLabel(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-body-sm text-content-secondary">
                        {log.resource_type ? (
                          <div>
                            <span className="font-medium">
                              {formatResourceType(log.resource_type)}
                            </span>
                            {log.resource_id && (
                              <span className="text-content-tertiary">
                                #{log.resource_id}
                              </span>
                            )}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-body-sm text-content-secondary max-w-xs truncate">
                        {log.description || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={log.status} />
                      </td>
                      <td className="px-4 py-3 text-body-sm text-content-tertiary">
                        {log.ip_address || "-"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {!isLoading && logs.length > 0 && (
            <div className="px-4 py-3 border-t border-line bg-surface-raised">
              <div className="flex items-center justify-between">
                <div className="text-body-sm text-content-tertiary">
                  {total.toLocaleString()}개 중{" "}
                  {((page - 1) * perPage + 1).toLocaleString()}-
                  {Math.min(page * perPage, total).toLocaleString()}개 표시
                </div>
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 상세 모달 */}
      <AuditLogDetailModal
        log={selectedLog}
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
      />
    </>
  );
}
