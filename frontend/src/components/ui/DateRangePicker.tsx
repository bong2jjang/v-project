/**
 * DateRangePicker Component
 *
 * 날짜 범위 선택 컴포넌트
 */

import { Input } from "./Input";

export interface DateRangePickerProps {
  fromDate?: string;
  toDate?: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  label?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  label,
  disabled = false,
}: DateRangePickerProps) {
  // Get today's date in YYYY-MM-DD format for max attribute
  const today = new Date().toISOString().split("T")[0];

  // Quick select presets
  const selectToday = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    onFromDateChange(todayStr);
    onToDateChange(todayStr);
  };

  const selectLast7Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    onFromDateChange(start.toISOString().split("T")[0]);
    onToDateChange(end.toISOString().split("T")[0]);
  };

  const selectLast30Days = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    onFromDateChange(start.toISOString().split("T")[0]);
    onToDateChange(end.toISOString().split("T")[0]);
  };

  const selectThisMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    onFromDateChange(start.toISOString().split("T")[0]);
    onToDateChange(end.toISOString().split("T")[0]);
  };

  const clearDates = () => {
    onFromDateChange("");
    onToDateChange("");
  };

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-body-sm font-medium text-content-primary">
          {label}
        </label>
      )}

      {/* Quick select buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={selectToday}
          disabled={disabled}
          className="px-3 py-1.5 text-body-sm bg-surface-raised hover:bg-surface-raised-hover text-content-primary rounded-button border border-line transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          오늘
        </button>
        <button
          type="button"
          onClick={selectLast7Days}
          disabled={disabled}
          className="px-3 py-1.5 text-body-sm bg-surface-raised hover:bg-surface-raised-hover text-content-primary rounded-button border border-line transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          최근 7일
        </button>
        <button
          type="button"
          onClick={selectLast30Days}
          disabled={disabled}
          className="px-3 py-1.5 text-body-sm bg-surface-raised hover:bg-surface-raised-hover text-content-primary rounded-button border border-line transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          최근 30일
        </button>
        <button
          type="button"
          onClick={selectThisMonth}
          disabled={disabled}
          className="px-3 py-1.5 text-body-sm bg-surface-raised hover:bg-surface-raised-hover text-content-primary rounded-button border border-line transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          이번 달
        </button>
        {(fromDate || toDate) && (
          <button
            type="button"
            onClick={clearDates}
            disabled={disabled}
            className="px-3 py-1.5 text-body-sm text-content-tertiary hover:text-content-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            초기화
          </button>
        )}
      </div>

      {/* Date inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="시작일"
          type="date"
          value={fromDate || ""}
          onChange={(e) => onFromDateChange(e.target.value)}
          max={toDate || today}
          disabled={disabled}
        />
        <Input
          label="종료일"
          type="date"
          value={toDate || ""}
          onChange={(e) => onToDateChange(e.target.value)}
          min={fromDate}
          max={today}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
