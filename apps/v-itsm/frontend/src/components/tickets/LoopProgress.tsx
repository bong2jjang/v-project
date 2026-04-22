/**
 * 업무 루프(접수→분석→실행→검증→답변→종료) 진행 시각화.
 *
 * - 6-step 스텝퍼: 완료/현재/미완료/보류/반려 시각적 구분
 * - 각 단계 진입 시각·소요 시간 표시
 * - 데스크톱: 가로, 모바일: 세로 레이아웃
 */

import {
  CheckCircle2,
  ChevronRight,
  Inbox,
  Lock,
  MessageSquareText,
  NotebookPen,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  LoopAction,
  LoopStage,
  LoopTransition,
} from "../../lib/api/itsmTypes";
import { LOOP_ACTION_LABELS } from "../../lib/api/itsmTypes";

const STAGE_FLOW: LoopStage[] = [
  "intake",
  "analyze",
  "execute",
  "verify",
  "answer",
  "closed",
];

interface StageMeta {
  icon: LucideIcon;
  label: string;
  role: string;
  description: string;
  accent: string;
}

const STAGE_META: Record<LoopStage, StageMeta> = {
  intake: {
    icon: Inbox,
    label: "접수",
    role: "VOC",
    description: "고객 요청 수신·분류",
    accent: "#3b82f6",
  },
  analyze: {
    icon: Search,
    label: "분석",
    role: "사업",
    description: "영향도·우선순위 판단",
    accent: "#6366f1",
  },
  execute: {
    icon: Play,
    label: "실행",
    role: "제품",
    description: "개발·구성 변경 수행",
    accent: "#8b5cf6",
  },
  verify: {
    icon: ShieldCheck,
    label: "검증",
    role: "운영",
    description: "QA·운영 검증",
    accent: "#06b6d4",
  },
  answer: {
    icon: MessageSquareText,
    label: "답변",
    role: "고객",
    description: "결과 회신·확인",
    accent: "#10b981",
  },
  closed: {
    icon: Lock,
    label: "종료",
    role: "완료",
    description: "티켓 클로즈",
    accent: "#64748b",
  },
};

type StageStatus = "completed" | "current" | "pending";

interface StageEntry {
  stage: LoopStage;
  status: StageStatus;
  enteredAt: string | null;
  leftAt: string | null;
  durationMs: number | null;
  visited: boolean;
}

function formatDurationShort(ms: number | null): string {
  if (ms === null || ms < 0) return "-";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}초`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  if (hr < 24) return remMin > 0 ? `${hr}시간 ${remMin}분` : `${hr}시간`;
  const day = Math.floor(hr / 24);
  const remHr = hr % 24;
  return remHr > 0 ? `${day}일 ${remHr}시간` : `${day}일`;
}

function formatTimeShort(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function computeStageEntries(
  currentStage: LoopStage,
  transitions: LoopTransition[],
  openedAt: string,
  closedAt: string | null,
): StageEntry[] {
  const currentIdx = STAGE_FLOW.indexOf(currentStage);
  const sorted = [...transitions].sort(
    (a, b) =>
      new Date(a.transitioned_at).getTime() -
      new Date(b.transitioned_at).getTime(),
  );

  const nowMs = Date.now();

  return STAGE_FLOW.map((stage, idx) => {
    let status: StageStatus;
    if (idx < currentIdx) status = "completed";
    else if (idx === currentIdx) status = "current";
    else status = "pending";

    let enteredAt: string | null = null;
    let leftAt: string | null = null;
    const visited =
      stage === currentStage ||
      sorted.some((tx) => tx.to_stage === stage || tx.from_stage === stage);

    if (stage === "intake") {
      enteredAt = openedAt;
    } else {
      const entryTx = [...sorted]
        .reverse()
        .find((tx) => tx.to_stage === stage);
      enteredAt = entryTx?.transitioned_at ?? null;
    }

    if (stage === "closed") {
      leftAt = null;
    } else {
      const leaveTx = [...sorted]
        .reverse()
        .find(
          (tx) =>
            tx.from_stage === stage &&
            enteredAt !== null &&
            new Date(tx.transitioned_at).getTime() >
              new Date(enteredAt).getTime(),
        );
      leftAt = leaveTx?.transitioned_at ?? null;
    }

    let durationMs: number | null = null;
    if (enteredAt) {
      const start = new Date(enteredAt).getTime();
      if (leftAt) {
        durationMs = new Date(leftAt).getTime() - start;
      } else if (status === "current") {
        const endMs = closedAt ? new Date(closedAt).getTime() : nowMs;
        durationMs = endMs - start;
      }
    }

    return { stage, status, enteredAt, leftAt, durationMs, visited };
  });
}

const ACTION_ICON: Partial<Record<LoopAction, LucideIcon>> = {
  on_hold: Pause,
  reject: XCircle,
  rollback: RotateCcw,
  resume: Play,
  reopen: RotateCcw,
  note: NotebookPen,
};

interface LoopProgressProps {
  currentStage: LoopStage;
  transitions: LoopTransition[];
  openedAt: string;
  closedAt: string | null;
}

export default function LoopProgress({
  currentStage,
  transitions,
  openedAt,
  closedAt,
}: LoopProgressProps) {
  const entries = computeStageEntries(
    currentStage,
    transitions,
    openedAt,
    closedAt,
  );

  const sortedDesc = [...transitions].sort(
    (a, b) =>
      new Date(b.transitioned_at).getTime() -
      new Date(a.transitioned_at).getTime(),
  );
  const lastTx = sortedDesc[0];
  const isOnHold = lastTx?.action === "on_hold";
  const isRejected = lastTx?.action === "reject";
  const lastRollbackTx = sortedDesc.find((tx) => tx.action === "rollback");

  const totalMs =
    (closedAt ? new Date(closedAt).getTime() : Date.now()) -
    new Date(openedAt).getTime();

  const statusHint = isOnHold
    ? { text: "보류 중", tone: "warning" as const, Icon: Pause }
    : isRejected
      ? { text: "반려됨", tone: "danger" as const, Icon: XCircle }
      : lastRollbackTx && lastTx?.action === "rollback"
        ? { text: "롤백됨", tone: "warning" as const, Icon: RotateCcw }
        : currentStage === "closed"
          ? { text: "완료", tone: "success" as const, Icon: CheckCircle2 }
          : { text: "진행 중", tone: "info" as const, Icon: Play };

  const toneClass = {
    info: "bg-brand-50 text-brand-700 border-brand-200",
    success: "bg-success-50 text-success-700 border-success-200",
    warning: "bg-warning-50 text-warning-700 border-warning-200",
    danger: "bg-danger-50 text-danger-700 border-danger-200",
  }[statusHint.tone];

  return (
    <div className="rounded-lg border border-line bg-surface-primary p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-content-primary">
              업무 루프 진행 상황
            </h3>
            <p className="text-xs sm:text-sm text-content-tertiary">
              VOC → 사업 → 제품 → 운영 → 고객, 5단계 전주기 루프
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}
          >
            <statusHint.Icon className="h-3.5 w-3.5" />
            {statusHint.text}
          </span>
        </div>

        <div className="text-right">
          <div className="text-xs text-content-tertiary">총 경과</div>
          <div className="text-sm sm:text-base font-semibold text-content-primary">
            {formatDurationShort(totalMs)}
          </div>
        </div>
      </div>

      {/* Desktop: horizontal stepper */}
      <div className="hidden md:block">
        <div className="flex items-start">
          {entries.map((entry, idx) => {
            const meta = STAGE_META[entry.stage];
            const Icon = meta.icon;
            const isLast = idx === entries.length - 1;
            const nextEntry = entries[idx + 1];

            const circleBase =
              "relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all";
            let circleClass = "";
            let iconClass = "";
            let labelClass = "";

            if (entry.status === "completed") {
              circleClass =
                "border-brand-500 bg-brand-500 text-white shadow-sm";
              iconClass = "text-white";
              labelClass = "text-content-primary";
            } else if (entry.status === "current") {
              circleClass =
                "border-brand-500 bg-brand-50 text-brand-700 shadow-md ring-4 ring-brand-100";
              iconClass = "text-brand-600";
              labelClass = "text-content-primary font-semibold";
            } else {
              circleClass = "border-line bg-surface-secondary text-content-tertiary";
              iconClass = "text-content-tertiary";
              labelClass = "text-content-tertiary";
            }

            const connectorClass = (() => {
              if (isLast) return "";
              if (
                entry.status === "completed" &&
                (nextEntry.status === "completed" ||
                  nextEntry.status === "current")
              ) {
                return "bg-gradient-to-r from-brand-500 to-brand-400";
              }
              return "bg-line";
            })();

            return (
              <div
                key={entry.stage}
                className="flex-1 min-w-0 flex items-start"
              >
                <div className="flex flex-col items-center flex-1 min-w-0">
                  <div className={`${circleBase} ${circleClass}`}>
                    {entry.status === "completed" ? (
                      <CheckCircle2 className={`h-6 w-6 ${iconClass}`} />
                    ) : (
                      <Icon className={`h-6 w-6 ${iconClass}`} />
                    )}
                    {entry.status === "current" && isOnHold && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-warning-500 text-white shadow">
                        <Pause className="h-3 w-3" />
                      </span>
                    )}
                    {entry.status === "current" && isRejected && (
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger-500 text-white shadow">
                        <XCircle className="h-3 w-3" />
                      </span>
                    )}
                    {entry.status === "current" &&
                      !isOnHold &&
                      !isRejected &&
                      currentStage !== "closed" && (
                        <span className="absolute inset-0 rounded-full animate-ping bg-brand-400/30" />
                      )}
                  </div>

                  <div className="mt-2.5 text-center px-1 w-full">
                    <div className={`text-sm ${labelClass}`}>{meta.label}</div>
                    <div className="text-[11px] text-content-tertiary mt-0.5">
                      {meta.role}
                    </div>
                    {entry.enteredAt && (
                      <div className="text-[11px] text-content-tertiary mt-1 tabular-nums">
                        {formatTimeShort(entry.enteredAt)}
                      </div>
                    )}
                    {entry.durationMs !== null && (
                      <div
                        className={`text-[11px] mt-0.5 tabular-nums ${
                          entry.status === "current"
                            ? "text-brand-600 font-medium"
                            : "text-content-secondary"
                        }`}
                      >
                        {formatDurationShort(entry.durationMs)}
                        {entry.status === "current" && " 경과"}
                      </div>
                    )}
                  </div>
                </div>

                {!isLast && (
                  <div className="flex-1 pt-6 px-1">
                    <div className={`h-1 rounded-full ${connectorClass}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: vertical stepper */}
      <div className="md:hidden">
        <ol className="relative border-l-2 border-line ml-3 space-y-4">
          {entries.map((entry) => {
            const meta = STAGE_META[entry.stage];
            const Icon = meta.icon;

            let markerClass = "";
            let titleClass = "";
            if (entry.status === "completed") {
              markerClass = "border-brand-500 bg-brand-500 text-white";
              titleClass = "text-content-primary";
            } else if (entry.status === "current") {
              markerClass =
                "border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-100";
              titleClass = "text-content-primary font-semibold";
            } else {
              markerClass =
                "border-line bg-surface-secondary text-content-tertiary";
              titleClass = "text-content-tertiary";
            }

            return (
              <li key={entry.stage} className="ml-5 relative">
                <span
                  className={`absolute -left-[30px] top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 ${markerClass}`}
                >
                  {entry.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm ${titleClass}`}>{meta.label}</span>
                  <span className="text-[11px] text-content-tertiary">
                    · {meta.role}
                  </span>
                  {entry.status === "current" && isOnHold && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-warning-100 text-warning-700 px-1.5 py-0.5 text-[10px]">
                      <Pause className="h-2.5 w-2.5" /> 보류
                    </span>
                  )}
                </div>
                <div className="text-xs text-content-tertiary mt-0.5">
                  {meta.description}
                </div>
                {entry.enteredAt && (
                  <div className="text-[11px] text-content-tertiary mt-1 tabular-nums">
                    {formatTimeShort(entry.enteredAt)}
                    {entry.durationMs !== null && (
                      <span className="ml-1">
                        · {formatDurationShort(entry.durationMs)}
                        {entry.status === "current" ? " 경과" : ""}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Special events summary */}
      {(lastRollbackTx || isRejected || isOnHold) && (
        <div className="mt-4 pt-3 border-t border-line flex flex-wrap gap-2">
          {isOnHold && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs text-warning-700">
              <Pause className="h-3.5 w-3.5" />
              {formatTimeShort(lastTx?.transitioned_at ?? null)} {LOOP_ACTION_LABELS.on_hold}
              {lastTx?.note && ` · ${lastTx.note.slice(0, 30)}${lastTx.note.length > 30 ? "…" : ""}`}
            </span>
          )}
          {lastRollbackTx && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs text-warning-700">
              <RotateCcw className="h-3.5 w-3.5" />
              {formatTimeShort(lastRollbackTx.transitioned_at)} 롤백:{" "}
              {lastRollbackTx.from_stage
                ? STAGE_META[lastRollbackTx.from_stage].label
                : "—"}{" "}
              <ChevronRight className="h-3 w-3" />
              {STAGE_META[lastRollbackTx.to_stage].label}
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-danger-200 bg-danger-50 px-2.5 py-1 text-xs text-danger-700">
              <XCircle className="h-3.5 w-3.5" />
              {formatTimeShort(lastTx?.transitioned_at ?? null)}{" "}
              {LOOP_ACTION_LABELS.reject}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { STAGE_META, ACTION_ICON, formatDurationShort, formatTimeShort };
