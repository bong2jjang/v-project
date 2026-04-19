/**
 * SchemaForm — WidgetCatalogEntry.schema (Pydantic JSON Schema) 를 기반으로
 * 위젯의 props 편집 UI 를 자동 생성한다.
 *
 * - 변경을 debounce(400ms) 로 모아 PATCH /widgets/{id} 호출.
 * - `expected_updated_at` 로 낙관적 동시성 제어. 409 수신 시 last-write-wins 토스트 후 대시보드 재조회.
 * - data_table_manual 에 한해 "고급" 탭에서 CSV 붙여넣기 → columns/rows 일괄 치환을 지원.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ClipboardPaste, Loader2, RotateCcw } from "lucide-react";

import { useNotificationStore } from "@v-platform/core/stores/notification";

import {
  dashboardsApi,
  type DashboardWidget,
  type WidgetCatalogEntry,
} from "../../../../lib/api/dashboards";
import { TextField } from "./fields/TextField";
import { NumberField } from "./fields/NumberField";
import { BooleanField } from "./fields/BooleanField";
import { SelectField } from "./fields/SelectField";
import { ColorField } from "./fields/ColorField";
import { IconField } from "./fields/IconField";
import { MarkdownField } from "./fields/MarkdownField";
import { JsonField } from "./fields/JsonField";
import { ArrayField } from "./fields/ArrayField";
import {
  propertyLabel,
  resolveField,
  type JsonSchemaProperty,
} from "./fieldResolver";

interface SchemaFormProps {
  widget: DashboardWidget;
  catalogEntry: WidgetCatalogEntry;
  projectId: string;
}

const SAVE_DEBOUNCE_MS = 400;

const dashboardKey = (projectId: string) =>
  ["ui-builder", "dashboard", projectId] as const;

function isWidgetConflict(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as { response?: { status?: number; data?: { code?: string } } };
  return (
    anyErr.response?.status === 409 ||
    anyErr.response?.data?.code === "widget_conflict"
  );
}

function makeConflictToast(): Parameters<
  ReturnType<typeof useNotificationStore.getState>["addToast"]
>[0] {
  return {
    id: `widget-conflict-${Date.now()}`,
    timestamp: new Date().toISOString(),
    severity: "warning",
    category: "system",
    title: "위젯이 변경되었습니다",
    message:
      "다른 변경과 충돌하여 최신 상태로 새로고침했습니다. 다시 수정해 주세요.",
    source: "ui-builder",
    dismissible: true,
    persistent: false,
    read: false,
  };
}

export function SchemaForm({ widget, catalogEntry, projectId }: SchemaFormProps) {
  const queryClient = useQueryClient();
  const addToast = useNotificationStore((s) => s.addToast);

  const [props, setPropsLocal] = useState<Record<string, unknown>>(
    () => ({ ...(widget.props ?? {}) }),
  );
  const [expectedAt, setExpectedAt] = useState<string>(widget.updated_at);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tab, setTab] = useState<"basic" | "advanced">("basic");

  const saveTimerRef = useRef<number | null>(null);
  const pendingPropsRef = useRef<Record<string, unknown> | null>(null);

  /** 외부 widget 업데이트(재조회 등) 를 form 에 동기화. 저장 진행 중이면 건너뜀. */
  useEffect(() => {
    if (pendingPropsRef.current !== null) return;
    setPropsLocal({ ...(widget.props ?? {}) });
    setExpectedAt(widget.updated_at);
  }, [widget.id, widget.props, widget.updated_at]);

  const updateMutation = useMutation({
    mutationFn: (body: { props: Record<string, unknown>; expected: string }) =>
      dashboardsApi.updateWidget(projectId, widget.id, {
        props: body.props,
        expected_updated_at: body.expected,
      }),
    onSuccess: (updated) => {
      setExpectedAt(updated.updated_at);
      setSaveError(null);
      pendingPropsRef.current = null;
      queryClient.setQueryData(dashboardKey(projectId), (old: any) => {
        if (!old) return old;
        const widgets = (old.widgets as DashboardWidget[]).map((w) =>
          w.id === updated.id ? updated : w,
        );
        return { ...old, widgets };
      });
    },
    onError: (err) => {
      pendingPropsRef.current = null;
      if (isWidgetConflict(err)) {
        addToast(makeConflictToast());
        queryClient.invalidateQueries({ queryKey: dashboardKey(projectId) });
        setSaveError(null);
        return;
      }
      setSaveError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    },
  });

  const scheduleSave = useCallback(
    (next: Record<string, unknown>) => {
      pendingPropsRef.current = next;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        const snapshot = pendingPropsRef.current;
        if (!snapshot) return;
        updateMutation.mutate({ props: snapshot, expected: expectedAt });
      }, SAVE_DEBOUNCE_MS);
    },
    [updateMutation, expectedAt],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const setValue = useCallback(
    (key: string, value: unknown) => {
      setPropsLocal((prev) => {
        const next = { ...prev, [key]: value };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const resetToDefault = () => {
    const next = { ...(catalogEntry.default_args ?? {}) };
    setPropsLocal(next);
    scheduleSave(next);
  };

  const schema = catalogEntry.schema as {
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
  const properties = schema.properties ?? {};
  const propertyNames = Object.keys(properties);

  const showAdvancedTab = catalogEntry.tool === "data_table_manual";

  return (
    <div className="flex flex-col min-h-0 flex-1">
      {showAdvancedTab && (
        <div className="flex items-center border-b border-line shrink-0 text-[11px]">
          <TabButton active={tab === "basic"} onClick={() => setTab("basic")}>
            기본
          </TabButton>
          <TabButton active={tab === "advanced"} onClick={() => setTab("advanced")}>
            고급 (CSV)
          </TabButton>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto px-3 py-3 space-y-3">
        {tab === "basic" && (
          <>
            {propertyNames.length === 0 && (
              <div className="text-[11px] text-content-tertiary text-center py-6">
                편집 가능한 속성이 없습니다.
              </div>
            )}
            {propertyNames.map((name) => {
              const prop = properties[name];
              const resolved = resolveField(name, prop);
              const label = propertyLabel(name, prop);
              const value = props[name];
              const description = prop.description;

              switch (resolved.kind) {
                case "text":
                  return (
                    <TextField
                      key={name}
                      label={label}
                      description={description}
                      value={typeof value === "string" ? value : value == null ? "" : String(value)}
                      onChange={(v) => setValue(name, v)}
                    />
                  );
                case "number":
                  return (
                    <NumberField
                      key={name}
                      label={label}
                      description={description}
                      value={typeof value === "number" ? value : null}
                      onChange={(v) => setValue(name, v)}
                      min={resolved.min}
                      max={resolved.max}
                      step={resolved.step}
                      nullable={resolved.nullable}
                    />
                  );
                case "boolean":
                  return (
                    <BooleanField
                      key={name}
                      label={label}
                      description={description}
                      value={typeof value === "boolean" ? value : null}
                      onChange={(v) => setValue(name, v)}
                    />
                  );
                case "select":
                  return (
                    <SelectField
                      key={name}
                      label={label}
                      description={description}
                      value={value as string | number | null | undefined}
                      options={resolved.options ?? []}
                      onChange={(v) => setValue(name, v)}
                    />
                  );
                case "color":
                  return (
                    <ColorField
                      key={name}
                      label={label}
                      description={description}
                      value={value as string | null | undefined}
                      onChange={(v) => setValue(name, v)}
                    />
                  );
                case "icon":
                  return (
                    <IconField
                      key={name}
                      label={label}
                      description={description}
                      value={value as string | null | undefined}
                      nullable={resolved.nullable}
                      onChange={(v) => setValue(name, v)}
                    />
                  );
                case "markdown":
                  return (
                    <MarkdownField
                      key={name}
                      label={label}
                      description={description}
                      value={value as string | null | undefined}
                      onChange={(v) => setValue(name, v)}
                    />
                  );
                case "array-primitive":
                  return (
                    <ArrayField
                      key={name}
                      label={label}
                      description={description}
                      value={Array.isArray(value) ? value : []}
                      itemType={resolved.itemType ?? "string"}
                      onChange={(v) => setValue(name, v)}
                    />
                  );
                case "json":
                default:
                  return (
                    <JsonField
                      key={name}
                      label={label}
                      description={description}
                      value={value}
                      onChange={(v) => setValue(name, v)}
                    />
                  );
              }
            })}
          </>
        )}

        {tab === "advanced" && showAdvancedTab && (
          <CsvPasteImporter
            onApply={(next) => {
              const merged = { ...props, columns: next.columns, rows: next.rows };
              setPropsLocal(merged);
              scheduleSave(merged);
              setTab("basic");
            }}
          />
        )}
      </div>

      <div className="border-t border-line px-3 py-2 flex items-center justify-between gap-2 shrink-0 bg-surface-chrome">
        <div className="flex items-center gap-1.5 text-[10.5px] text-content-tertiary min-w-0">
          {updateMutation.isPending ? (
            <>
              <Loader2 size={10} className="animate-spin" /> 저장 중…
            </>
          ) : saveError ? (
            <span className="text-status-danger inline-flex items-center gap-1 truncate">
              <AlertTriangle size={10} /> {saveError}
            </span>
          ) : (
            <span>변경 사항은 자동 저장됩니다.</span>
          )}
        </div>
        <button
          type="button"
          onClick={resetToDefault}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10.5px] text-content-secondary hover:text-brand-500 rounded-button"
          title="기본값으로 복원"
        >
          <RotateCcw size={10} /> 기본값
        </button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-8 text-[11px] border-b-2 -mb-[1px] ${
        active
          ? "border-brand-500 text-content-primary"
          : "border-transparent text-content-tertiary hover:text-content-secondary"
      }`}
    >
      {children}
    </button>
  );
}

interface CsvPasteImporterProps {
  onApply: (parsed: {
    columns: Array<{ key: string; label: string; align: string; type: string }>;
    rows: Array<Record<string, unknown>>;
  }) => void;
}

/** 간단 CSV 파서 — 쉼표/탭 구분, 따옴표 이스케이프, 헤더 행이 컬럼 정의가 된다. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let sep: "," | "\t" | null = null;

  const pickSep = () => {
    if (sep !== null) return;
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    sep = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
  };
  pickSep();

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === sep) {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 0 && !(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
  }
  return rows;
}

function inferType(values: string[]): "number" | "text" {
  if (values.length === 0) return "text";
  let numeric = 0;
  for (const v of values) {
    if (v.trim() === "") continue;
    if (Number.isFinite(Number(v))) numeric++;
  }
  return numeric / values.filter((v) => v.trim() !== "").length >= 0.8 ? "number" : "text";
}

function CsvPasteImporter({ onApply }: CsvPasteImporterProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (!text.trim()) return null;
    try {
      const rows = parseCsv(text);
      if (rows.length < 1) return null;
      const header = rows[0];
      const body = rows.slice(1);
      const columns = header.map((h, idx) => {
        const colValues = body.map((r) => r[idx] ?? "");
        const type = inferType(colValues);
        return {
          key: h.trim() || `col_${idx + 1}`,
          label: h.trim() || `Column ${idx + 1}`,
          align: type === "number" ? "right" : "left",
          type,
        };
      });
      const rowObjects = body.map((r) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((c, idx) => {
          const raw = r[idx] ?? "";
          if (c.type === "number") {
            const n = Number(raw);
            obj[c.key] = Number.isFinite(n) ? n : raw;
          } else {
            obj[c.key] = raw;
          }
        });
        return obj;
      });
      return { columns, rows: rowObjects };
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV 파싱 실패");
      return null;
    }
  }, [text]);

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-content-secondary">
        CSV / TSV 를 붙여넣으면 첫 행이 컬럼, 이후 행이 데이터로 치환됩니다.
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setError(null);
          setText(e.target.value);
        }}
        rows={10}
        placeholder="Name,Value,Trend&#10;Alpha,12,up&#10;Beta,34,flat"
        className="w-full px-2 py-1.5 text-[11px] bg-surface-input border border-line rounded-button text-content-primary focus:outline-none focus:border-brand-500 font-mono resize-y"
      />
      {error && (
        <div className="text-[10.5px] text-status-danger flex items-center gap-1">
          <AlertTriangle size={10} /> {error}
        </div>
      )}
      {preview && (
        <div className="text-[10.5px] text-content-tertiary">
          미리보기: {preview.columns.length} 열 × {preview.rows.length} 행
        </div>
      )}
      <button
        type="button"
        disabled={!preview}
        onClick={() => preview && onApply(preview)}
        className="inline-flex items-center gap-1.5 rounded-button bg-brand-500 text-white px-2.5 py-1 text-[11px] disabled:opacity-40"
      >
        <ClipboardPaste size={11} /> 적용
      </button>
    </div>
  );
}
