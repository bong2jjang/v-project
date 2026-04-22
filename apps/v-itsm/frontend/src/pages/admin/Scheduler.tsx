/**
 * v-itsm 스케줄러 잡 모니터링 페이지.
 *
 * SchedulerRegistry 에 등록된 AsyncIOScheduler 잡 상태 확인, 간격 조정, 일시 정지.
 */

import { useEffect, useState } from "react";
import { Pause, Play, RefreshCw, Save } from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui";
import * as api from "../../lib/api/scheduler";
import type { SchedulerJob } from "../../lib/api/itsmTypes";

function formatRelative(iso: string | null): string {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Math.round((t - Date.now()) / 1000);
  const abs = Math.abs(diff);
  if (abs < 60) return diff >= 0 ? `${abs}초 후` : `${abs}초 전`;
  if (abs < 3600) {
    const m = Math.round(abs / 60);
    return diff >= 0 ? `${m}분 후` : `${m}분 전`;
  }
  if (abs < 86400) {
    const h = Math.round(abs / 3600);
    return diff >= 0 ? `${h}시간 후` : `${h}시간 전`;
  }
  return new Date(iso).toLocaleString("ko-KR");
}

export default function Scheduler() {
  const [items, setItems] = useState<SchedulerJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editedIntervals, setEditedIntervals] = useState<Record<string, string>>(
    {},
  );
  const [mutating, setMutating] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listSchedulerJobs();
      setItems(res.items);
      setEditedIntervals({});
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`스케줄러 잡 조회 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchList();
  }, []);

  async function handleSaveInterval(job: SchedulerJob) {
    const raw = editedIntervals[job.job_id];
    if (!raw) return;
    const seconds = Number(raw);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      setError("간격은 양의 정수여야 합니다.");
      return;
    }
    if (seconds < job.min_interval_seconds || seconds > job.max_interval_seconds) {
      setError(
        `허용 범위: ${job.min_interval_seconds}~${job.max_interval_seconds}초`,
      );
      return;
    }
    setMutating(job.job_id);
    setError(null);
    try {
      await api.rescheduleJob(job.job_id, { interval_seconds: seconds });
      setSuccess(`${job.job_id} 간격이 ${seconds}초로 변경되었습니다.`);
      await fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`간격 변경 실패: ${msg}`);
    } finally {
      setMutating(null);
    }
  }

  async function handleTogglePause(job: SchedulerJob) {
    const next = !job.paused;
    if (
      !confirm(
        `${job.job_id} 잡을 ${next ? "일시 정지" : "재개"}하시겠습니까?`,
      )
    )
      return;
    setMutating(job.job_id);
    setError(null);
    try {
      await api.rescheduleJob(job.job_id, { paused: next });
      setSuccess(`${job.job_id} 잡이 ${next ? "일시 정지" : "재개"}되었습니다.`);
      await fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`상태 변경 실패: ${msg}`);
    } finally {
      setMutating(null);
    }
  }

  return (
    <>
      <ContentHeader
        title="스케줄러 모니터링"
        description={`등록된 잡 ${items.length}건 — AsyncIOScheduler`}
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
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : items.length === 0 ? (
              <EmptyState
                title="등록된 스케줄러 잡이 없습니다"
                description="SchedulerRegistry.register() 로 잡을 등록하세요."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>잡 ID</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead>간격(초)</TableHead>
                    <TableHead>범위</TableHead>
                    <TableHead>다음 실행</TableHead>
                    <TableHead>최근 실행</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="w-28 text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((job) => {
                    const intervalValue =
                      editedIntervals[job.job_id] ?? String(job.interval_seconds);
                    const isDirty =
                      editedIntervals[job.job_id] !== undefined &&
                      Number(editedIntervals[job.job_id]) !== job.interval_seconds;
                    return (
                      <TableRow key={job.job_id}>
                        <TableCell className="font-mono text-xs">
                          {job.job_id}
                        </TableCell>
                        <TableCell className="text-sm">{job.description}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={job.min_interval_seconds}
                              max={job.max_interval_seconds}
                              value={intervalValue}
                              onChange={(e) =>
                                setEditedIntervals((prev) => ({
                                  ...prev,
                                  [job.job_id]: e.target.value,
                                }))
                              }
                              className="w-20"
                            />
                            {isDirty && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => void handleSaveInterval(job)}
                                disabled={mutating === job.job_id}
                                title="간격 저장"
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {job.min_interval_seconds}~{job.max_interval_seconds}
                          <br />
                          default {job.default_interval_seconds}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatRelative(job.next_run_at)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatRelative(job.last_run_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={job.paused ? "default" : "success"}>
                            {job.paused ? "정지" : "실행 중"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleTogglePause(job)}
                            disabled={mutating === job.job_id}
                            title={job.paused ? "재개" : "일시 정지"}
                          >
                            {job.paused ? (
                              <Play className="h-4 w-4" />
                            ) : (
                              <Pause className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
