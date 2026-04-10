/**
 * FiltersPanel 컴포넌트
 *
 * 검색 + 필터 통합 패널 (개선 2026-04-05)
 * - 검색바 항상 표시
 * - 필터: 게이트웨이(플랫폼 아이콘), 사용자(표시명), 채널, 상태(레이블), 날짜 범위
 */

import { useState, useEffect } from "react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { MultiSelect } from "../ui/MultiSelect";
import { DateRangePicker } from "../ui/DateRangePicker";
import { getFilterOptions, type FilterOptions } from "../../lib/api/messages";

export interface Filters {
  /** @deprecated use route instead */
  gateway?: string | string[];
  route?: string;
  channel?: string | string[];
  src_channel?: string[];
  dst_channel?: string[];
  user?: string;
  status?: string | string[];
  from_date?: string;
  to_date?: string;
}

export interface FiltersPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onClear: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => void;
}

// ── 플랫폼 아이콘 prefix renderer ─────────────────────────────────────────
function GatewayPrefix({ value }: { value: string }) {
  const lower = value.toLowerCase();
  const isSlack = lower.includes("slack");
  const isTeams =
    lower.includes("teams") || lower.includes("teams") || lower.includes("ms");

  if (isSlack) {
    return (
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded text-white text-[9px] font-bold flex-shrink-0"
        style={{ backgroundColor: "#4A154B" }}
      >
        S
      </span>
    );
  }
  if (isTeams) {
    return (
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded text-white text-[9px] font-bold flex-shrink-0"
        style={{ backgroundColor: "#5059C9" }}
      >
        T
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-gray-400 text-white text-[9px] font-bold flex-shrink-0">
      ?
    </span>
  );
}

function RoutePrefix({ value }: { value: string }) {
  const [src, dst] = value.split("→");
  return (
    <div className="flex items-center gap-0.5">
      <GatewayPrefix value={src ?? ""} />
      <span className="text-content-tertiary text-[10px]">→</span>
      <GatewayPrefix value={dst ?? ""} />
    </div>
  );
}

// ── 상태 레이블 ─────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  sent: "전송 완료",
  partial_success: "부분 성공",
  failed: "실패",
  retrying: "재시도 중",
  pending: "대기 중",
};

const STATUS_VALUES = [
  "sent",
  "partial_success",
  "failed",
  "retrying",
  "pending",
];

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function FiltersPanel({
  filters,
  onChange,
  onClear,
  searchQuery,
  onSearchQueryChange,
  onSearch,
}: FiltersPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    gateways: [],
    channels: [],
    src_channels: [],
    dst_channels: [],
    users: [],
  });
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  useEffect(() => {
    if (expanded && filterOptions.gateways.length === 0) {
      setIsLoadingOptions(true);
      getFilterOptions()
        .then((options) => setFilterOptions(options))
        .catch((err) => console.error("Failed to load filter options:", err))
        .finally(() => setIsLoadingOptions(false));
    }
  }, [expanded]);

  const activeFilterCount = Object.values(filters).filter((v) => {
    if (Array.isArray(v)) return v.length > 0;
    return !!v;
  }).length;
  const hasFilters = activeFilterCount > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
  };

  const handleClear = () => {
    onClear();
    setExpanded(false);
  };

  // 라우트 선택 (단일 선택)
  const selectedRoute = filters.route ?? "";

  // 채널 선택 (분리)
  const selectedSrcChannels = filters.src_channel ?? [];
  const selectedDstChannels = filters.dst_channel ?? [];

  // 상태 선택
  const selectedStatuses = Array.isArray(filters.status)
    ? filters.status
    : filters.status
      ? [filters.status]
      : [];

  // 사용자 선택
  const selectedUsers = filters.user ? [filters.user] : [];

  return (
    <Card>
      {/* 검색바 + 필터 토글 */}
      <div className="p-4">
        <div className="flex items-center gap-2">
          {/* 검색 입력 */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="w-5 h-5 text-content-tertiary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지 내용 검색..."
              className="block w-full pl-10 pr-3 py-2 border border-line-heavy rounded-input bg-surface-card text-content-primary placeholder:text-content-tertiary focus-ring"
            />
          </div>

          {/* 필터 토글 */}
          <Button
            variant={expanded || hasFilters ? "secondary" : "ghost"}
            onClick={() => setExpanded(!expanded)}
            icon={
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
            }
          >
            필터
            {hasFilters && <Badge variant="info">{activeFilterCount}</Badge>}
          </Button>

          <Button variant="primary" onClick={onSearch}>
            검색
          </Button>
        </div>

        {/* 적용된 필터 요약 칩 */}
        {hasFilters && !expanded && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {selectedRoute && (
              <FilterChip
                label={`라우트: ${selectedRoute}`}
                onRemove={() => onChange({ ...filters, route: undefined })}
              />
            )}
            {selectedSrcChannels.map((c) => (
              <FilterChip
                key={`src-${c}`}
                label={`발신: ${filterOptions.src_channel_labels?.[c] ?? c}`}
                onRemove={() =>
                  onChange({
                    ...filters,
                    src_channel: selectedSrcChannels.filter((x) => x !== c),
                  })
                }
              />
            ))}
            {selectedDstChannels.map((c) => (
              <FilterChip
                key={`dst-${c}`}
                label={`수신: ${filterOptions.dst_channel_labels?.[c] ?? c}`}
                onRemove={() =>
                  onChange({
                    ...filters,
                    dst_channel: selectedDstChannels.filter((x) => x !== c),
                  })
                }
              />
            ))}
            {selectedStatuses.map((s) => (
              <FilterChip
                key={s}
                label={STATUS_LABELS[s] ?? s}
                onRemove={() =>
                  onChange({
                    ...filters,
                    status: selectedStatuses.filter((x) => x !== s),
                  })
                }
              />
            ))}
            {filters.user && (
              <FilterChip
                label={`사용자: ${filterOptions.user_labels?.[filters.user] ?? filters.user}`}
                onRemove={() => onChange({ ...filters, user: undefined })}
              />
            )}
            {(filters.from_date || filters.to_date) && (
              <FilterChip
                label={`${filters.from_date ?? "~"} ~ ${filters.to_date ?? "~"}`}
                onRemove={() =>
                  onChange({
                    ...filters,
                    from_date: undefined,
                    to_date: undefined,
                  })
                }
              />
            )}
            <button
              type="button"
              onClick={handleClear}
              className="text-body-xs text-content-tertiary hover:text-content-primary underline"
            >
              전체 초기화
            </button>
          </div>
        )}
      </div>

      {/* 필터 영역 */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-line pt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-heading-sm text-content-secondary">
              상세 필터
              {isLoadingOptions && (
                <span className="ml-2 text-body-sm text-content-tertiary">
                  로딩 중...
                </span>
              )}
            </p>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                전체 초기화
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {/* 날짜 범위 */}
            <DateRangePicker
              label="날짜 범위"
              fromDate={filters.from_date}
              toDate={filters.to_date}
              onFromDateChange={(date) =>
                onChange({ ...filters, from_date: date })
              }
              onToDateChange={(date) => onChange({ ...filters, to_date: date })}
              disabled={isLoadingOptions}
            />

            {/* 보내는 채널 + 받는 채널 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MultiSelect
                label="보내는 채널"
                options={filterOptions.src_channels ?? filterOptions.channels}
                selected={selectedSrcChannels}
                onChange={(selected) =>
                  onChange({
                    ...filters,
                    src_channel: selected.length > 0 ? selected : undefined,
                  })
                }
                placeholder="발신 채널 선택..."
                disabled={isLoadingOptions}
                optionLabels={
                  filterOptions.src_channel_labels ??
                  filterOptions.channel_labels
                }
              />

              <MultiSelect
                label="받는 채널"
                options={filterOptions.dst_channels ?? filterOptions.channels}
                selected={selectedDstChannels}
                onChange={(selected) =>
                  onChange({
                    ...filters,
                    dst_channel: selected.length > 0 ? selected : undefined,
                  })
                }
                placeholder="수신 채널 선택..."
                disabled={isLoadingOptions}
                optionLabels={
                  filterOptions.dst_channel_labels ??
                  filterOptions.channel_labels
                }
              />
            </div>

            {/* 전송 상태 + 사용자 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MultiSelect
                label="전송 상태"
                options={STATUS_VALUES}
                selected={selectedStatuses}
                onChange={(selected) =>
                  onChange({
                    ...filters,
                    status: selected.length > 0 ? selected : undefined,
                  })
                }
                placeholder="상태 선택..."
                disabled={isLoadingOptions}
                optionLabels={STATUS_LABELS}
              />

              <MultiSelect
                label="사용자"
                options={filterOptions.users}
                selected={selectedUsers}
                onChange={(selected) =>
                  onChange({
                    ...filters,
                    user: selected.length > 0 ? selected[0] : undefined,
                  })
                }
                placeholder="사용자 선택..."
                disabled={isLoadingOptions}
                optionLabels={filterOptions.user_labels}
              />
            </div>

            {/* 라우트 (발신→수신 경로) */}
            {filterOptions.routes && filterOptions.routes.length > 0 && (
              <div>
                <p className="block text-body-sm font-medium text-content-primary mb-1.5">
                  라우트 경로
                  <span className="ml-1 text-body-xs text-content-tertiary font-normal">
                    (발신 → 수신)
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.routes.map((routeValue) => {
                    const [src, dst] = routeValue.split("→");
                    const isActive = selectedRoute === routeValue;
                    return (
                      <button
                        key={routeValue}
                        type="button"
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-body-sm transition-colors ${
                          isActive
                            ? "border-brand-500 bg-brand-600/10 text-brand-600 font-medium"
                            : "border-line bg-surface-base hover:bg-surface-raised text-content-secondary"
                        }`}
                        onClick={() =>
                          onChange({
                            ...filters,
                            route: isActive ? undefined : routeValue,
                          })
                        }
                        title={`${src} → ${dst}`}
                      >
                        <RoutePrefix value={routeValue} />
                        <span className="font-mono text-body-xs">
                          {src} → {dst}
                        </span>
                        {isActive && (
                          <svg
                            className="w-3.5 h-3.5 text-brand-500 ml-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── 필터 칩 ──────────────────────────────────────────────────────────────────
function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-600/10 text-brand-600 rounded text-body-xs">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="hover:text-brand-800 ml-0.5"
      >
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </span>
  );
}

/* Card wrapper */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-card border border-line rounded-card shadow-card">
      {children}
    </div>
  );
}
