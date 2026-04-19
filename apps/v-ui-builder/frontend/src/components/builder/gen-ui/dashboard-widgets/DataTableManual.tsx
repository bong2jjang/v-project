/**
 * DataTableManual — data_table_manual ui tool 의 component 렌더러.
 * columns + rows 수동 입력. sortable 헤더 클릭 정렬, page_size 페이징, striped/align/type(badge).
 */

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export interface DataTableColumn {
  key: string;
  label: string;
  align: "left" | "right" | "center";
  type: "text" | "number" | "date" | "badge";
}

export interface DataTableManualProps {
  title: string | null;
  columns: DataTableColumn[];
  rows: Record<string, unknown>[];
  sortable: boolean;
  page_size: number | null;
  striped: boolean;
}

type SortDir = "asc" | "desc" | null;

const ALIGN_CLASS: Record<DataTableColumn["align"], string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

function renderCell(
  value: unknown,
  type: DataTableColumn["type"],
): React.ReactNode {
  if (value === null || value === undefined) return "-";
  if (type === "badge") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-button bg-surface-raised border border-line text-[10.5px] text-content-primary">
        {String(value)}
      </span>
    );
  }
  if (type === "number" && typeof value === "number") {
    return value.toLocaleString();
  }
  return String(value);
}

export function DataTableManual({
  title,
  columns,
  rows,
  sortable,
  page_size,
  striped,
}: DataTableManualProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(() => {
    if (!sortKey || !sortDir) return rows;
    const out = [...rows];
    out.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "asc" ? av - bv : bv - av;
      const as = String(av);
      const bs = String(bv);
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return out;
  }, [rows, sortKey, sortDir]);

  const totalPages = page_size ? Math.ceil(sortedRows.length / page_size) : 1;
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const visibleRows = page_size
    ? sortedRows.slice(safePage * page_size, (safePage + 1) * page_size)
    : sortedRows;

  const handleSort = (key: string) => {
    if (!sortable) return;
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortKey(null);
      setSortDir(null);
    } else {
      setSortDir("asc");
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {title && (
        <div className="text-[12.5px] font-semibold text-content-primary mb-1 shrink-0">
          {title}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto border border-line rounded-input">
        <table className="w-full text-[11.5px]">
          <thead className="sticky top-0 bg-surface-chrome border-b border-line">
            <tr>
              {columns.map((col) => {
                const active = sortKey === col.key;
                const Icon = !active
                  ? ArrowUpDown
                  : sortDir === "asc"
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <th
                    key={col.key}
                    className={`px-2 py-1.5 font-semibold text-content-secondary ${ALIGN_CLASS[col.align]} ${sortable ? "cursor-pointer select-none hover:text-content-primary" : ""}`}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortable && <Icon size={10} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, ri) => (
              <tr
                key={ri}
                className={`border-b border-line last:border-b-0 ${striped && ri % 2 === 1 ? "bg-surface-raised/40" : ""}`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-2 py-1 text-content-primary ${ALIGN_CLASS[col.align]}`}
                  >
                    {renderCell(row[col.key], col.type)}
                  </td>
                ))}
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-2 py-4 text-center text-content-tertiary"
                >
                  데이터 없음
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {page_size && totalPages > 1 && (
        <div className="flex items-center justify-between mt-1 text-[11px] text-content-secondary shrink-0">
          <span>
            {safePage + 1} / {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              className="px-2 py-0.5 rounded-button border border-line disabled:opacity-40 hover:border-brand-500"
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
              disabled={safePage >= totalPages - 1}
              className="px-2 py-0.5 rounded-button border border-line disabled:opacity-40 hover:border-brand-500"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
