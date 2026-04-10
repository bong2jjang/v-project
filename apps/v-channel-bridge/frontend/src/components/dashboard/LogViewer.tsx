/**
 * LogViewer 컴포넌트
 *
 * 브리지 로그 뷰어
 * - 실시간 WebSocket 로그 스트리밍
 * - 로그 레벨 필터링 (ERROR, WARN, INFO, DEBUG, ALL)
 * - 검색어 필터링
 * - CSV/TXT 내보내기
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { useBridgeStore } from "../../store";
import { useAuthStore } from "../../store/auth";
import { isTokenExpired } from "../../lib/api/auth";
import { Card, CardHeader, CardTitle, CardBody } from "../ui/Card";
import { Button } from "../ui/Button";
import { InfoTooltip } from "../ui/InfoTooltip";

const LINE_OPTIONS = [50, 100, 200, 500, 1000];
const LOG_LEVELS = ["ALL", "ERROR", "WARN", "INFO", "DEBUG"] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

interface LogViewerProps {
  isServerReachable?: boolean;
}

export function LogViewer({ isServerReachable = true }: LogViewerProps) {
  const { logs, isLoading, fetchLogs } = useBridgeStore();
  const [lines, setLines] = useState(100);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logLevel, setLogLevel] = useState<LogLevel>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 로그 필터링
  const filteredLogs = useMemo(() => {
    // logs가 undefined 또는 null이면 빈 배열 반환
    if (!logs || !Array.isArray(logs)) {
      return [];
    }

    let filtered = logs;

    // 레벨 필터
    if (logLevel !== "ALL") {
      filtered = filtered.filter((log) => log.includes(logLevel));
    }

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((log) => log.toLowerCase().includes(query));
    }

    return filtered;
  }, [logs, logLevel, searchQuery]);

  const { isAuthenticated } = useAuthStore();

  // 마운트 시 초기 로그 로드 (인증 + 토큰 유효성 확인)
  useEffect(() => {
    if (isServerReachable && isAuthenticated && !isTokenExpired()) {
      fetchLogs(lines);
    }
  }, [isServerReachable, isAuthenticated]);

  // 로그 변경 시 자동 스크롤
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const handleRefresh = () => {
    fetchLogs(lines);
  };

  const handleLinesChange = (newLines: number) => {
    setLines(newLines);
    fetchLogs(newLines);
  };

  const handleClearLogs = () => {
    useBridgeStore.setState({ logs: [] });
  };

  // 로그 내보내기 (TXT)
  const handleExportTXT = () => {
    const content = filteredLogs.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bridge-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 로그 내보내기 (CSV)
  const handleExportCSV = () => {
    const csvLines = [
      ["Line", "Level", "Timestamp", "Message"].join(","),
      ...filteredLogs.map((log, index) => {
        const level = getLogLevel(log);
        const timestamp = extractTimestamp(log) || "";
        const message = log.replace(/"/g, '""'); // CSV escape
        return `${index + 1},"${level}","${timestamp}","${message}"`;
      }),
    ];
    const content = csvLines.join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bridge-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="space-y-3">
          {/* Row 1: Title and Controls */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <CardTitle>
                  Logs
                  {filteredLogs.length !== (logs?.length || 0) && (
                    <span className="ml-2 text-body-sm font-normal text-content-tertiary">
                      ({filteredLogs.length} / {logs?.length || 0})
                    </span>
                  )}
                </CardTitle>
                <InfoTooltip
                  title="브리지 로그"
                  description="백엔드 브리지 서비스의 실시간 로그를 표시합니다. 메시지 전송, Provider 연결, 오류 등 모든 이벤트가 기록됩니다."
                  hint="레벨 필터(ERROR, WARN 등)와 검색 기능으로 원하는 로그만 확인할 수 있습니다. Export로 TXT/CSV 다운로드도 가능합니다."
                  side="bottom"
                />
              </div>
              <p className="text-body-sm text-content-tertiary mt-1">
                브리지 서비스 실시간 로그 (오류, 경고, 메시지 전송 등)
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Filter Toggle */}
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`text-body-sm px-3 py-1 rounded-button border transition-colors duration-normal ${
                  showFilters || logLevel !== "ALL" || searchQuery
                    ? "bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-900/30 dark:border-brand-700 dark:text-brand-400"
                    : "bg-surface-raised border-line-heavy text-content-secondary"
                }`}
                title="필터 표시/숨기기"
              >
                <div className="flex items-center gap-1">
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
                      d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                    />
                  </svg>
                  Filter
                </div>
              </button>

              {/* Lines Selector */}
              <select
                value={lines}
                onChange={(e) => handleLinesChange(Number(e.target.value))}
                disabled={!isServerReachable}
                className="text-body-sm border border-line-heavy rounded-input px-2 py-1 focus-ring disabled:opacity-50"
              >
                {LINE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option} lines
                  </option>
                ))}
              </select>

              {/* Auto-scroll Toggle */}
              <button
                type="button"
                onClick={() => setAutoScroll(!autoScroll)}
                className={`text-body-sm px-3 py-1 rounded-button border transition-colors duration-normal ${
                  autoScroll
                    ? "bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-900/30 dark:border-brand-700 dark:text-brand-400"
                    : "bg-surface-raised border-line-heavy text-content-secondary"
                }`}
                title="자동 스크롤 토글"
              >
                <div className="flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Auto
                </div>
              </button>

              {/* Export Dropdown */}
              <div className="relative inline-block text-left">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={filteredLogs.length === 0}
                  onClick={(e) => {
                    const target = e.currentTarget;
                    const menu = target.nextElementSibling as HTMLElement;
                    if (menu) {
                      menu.classList.toggle("hidden");
                    }
                  }}
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
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                  }
                >
                  Export
                </Button>
                <div className="hidden absolute right-0 mt-1 w-32 bg-surface-card border border-line-heavy rounded-menu shadow-elevation-medium z-10">
                  <button
                    type="button"
                    onClick={() => {
                      handleExportTXT();
                      const menu = document.querySelector(
                        ".hidden",
                      ) as HTMLElement;
                      if (menu) menu.classList.add("hidden");
                    }}
                    className="block w-full text-left px-3 py-2 text-body-sm hover:bg-surface-hover transition-colors"
                  >
                    TXT
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleExportCSV();
                      const menu = document.querySelector(
                        ".hidden",
                      ) as HTMLElement;
                      if (menu) menu.classList.add("hidden");
                    }}
                    className="block w-full text-left px-3 py-2 text-body-sm hover:bg-surface-hover transition-colors"
                  >
                    CSV
                  </button>
                </div>
              </div>

              {/* Refresh */}
              <Button
                size="sm"
                variant="secondary"
                onClick={handleRefresh}
                disabled={isLoading || !isServerReachable}
                loading={isLoading}
                icon={
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                      clipRule="evenodd"
                    />
                  </svg>
                }
              >
                Refresh
              </Button>

              {/* Clear */}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearLogs}
                disabled={(logs?.length || 0) === 0}
                icon={
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                }
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Row 2: Filters (collapsible) */}
          {showFilters && (
            <div className="flex items-center gap-3 pt-2 border-t border-line-light">
              {/* Log Level Filter */}
              <div className="flex items-center gap-2">
                <label className="text-body-sm text-content-secondary font-medium">
                  Level:
                </label>
                <div className="flex gap-1">
                  {LOG_LEVELS.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setLogLevel(level)}
                      className={`text-body-xs px-2 py-1 rounded-button border transition-colors duration-normal ${
                        logLevel === level
                          ? "bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-900/30 dark:border-brand-700 dark:text-brand-400"
                          : "bg-surface-raised border-line-heavy text-content-secondary hover:bg-surface-hover"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Filter */}
              <div className="flex-1 flex items-center gap-2">
                <label className="text-body-sm text-content-secondary font-medium">
                  Search:
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search logs..."
                  className="flex-1 text-body-sm border border-line-heavy rounded-input px-3 py-1 focus-ring"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-content-tertiary hover:text-content-secondary transition-colors"
                    title="Clear search"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {!logs || logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-content-tertiary">
            <svg
              className="w-12 h-12 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-body-base font-medium text-content-secondary">
              {isServerReachable ? "로그가 없습니다" : "서버 연결 대기 중"}
            </p>
            <p className="text-body-sm text-content-tertiary mt-1">
              {isServerReachable
                ? "브리지를 시작하면 로그가 표시됩니다"
                : "백엔드 서버가 실행되면 로그를 확인할 수 있습니다"}
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-content-tertiary">
            <svg
              className="w-12 h-12 mb-3"
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
            <p className="text-body-base font-medium text-content-secondary">
              필터와 일치하는 로그가 없습니다
            </p>
            <p className="text-body-sm text-content-tertiary mt-1">
              다른 필터 조건을 시도해보세요
            </p>
          </div>
        ) : (
          <div
            ref={logContainerRef}
            className="bg-[#1e1e1e] text-[#cccccc] p-4 font-mono text-body-sm overflow-y-auto rounded-b-card border-t border-line-light"
            style={{ maxHeight: "60vh", minHeight: "300px" }}
          >
            {filteredLogs.map((log, index) => (
              <LogLine key={index} line={log} lineNumber={index + 1} />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// 로그 레벨 추출 헬퍼 함수
function getLogLevel(line: string): string {
  if (line.includes("ERROR") || line.includes("FATAL")) return "ERROR";
  if (line.includes("WARN")) return "WARN";
  if (line.includes("INFO")) return "INFO";
  if (line.includes("DEBUG")) return "DEBUG";
  return "INFO";
}

// 타임스탬프 추출 헬퍼 함수
function extractTimestamp(line: string): string | null {
  // ISO 8601 형식: 2025-03-21T10:30:45Z 또는 2025-03-21 10:30:45
  const isoMatch = line.match(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/);
  if (isoMatch) return isoMatch[0];

  // 시간만: 10:30:45 또는 [10:30:45]
  const timeMatch = line.match(/\[?(\d{2}:\d{2}:\d{2})\]?/);
  if (timeMatch) return timeMatch[1];

  return null;
}

interface LogLineProps {
  line: string;
  lineNumber: number;
}

function LogLine({ line, lineNumber }: LogLineProps) {
  const getLogColor = (line: string): string => {
    if (line.includes("ERROR") || line.includes("FATAL"))
      return "text-[#f14c4c]";
    if (line.includes("WARN")) return "text-[#cca700]";
    if (line.includes("INFO")) return "text-[#3794ff]";
    if (line.includes("DEBUG")) return "text-[#6e6e6e]";
    return "text-[#cccccc]";
  };

  return (
    <div className="flex hover:bg-[#2a2d2e] transition-colors duration-fast">
      <span
        className="text-[#6e6e6e] select-none mr-4 text-right"
        style={{ minWidth: "3rem" }}
      >
        {lineNumber}
      </span>
      <span
        className={`flex-1 whitespace-pre-wrap break-all ${getLogColor(line)}`}
      >
        {line}
      </span>
    </div>
  );
}
