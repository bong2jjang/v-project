/**
 * v-itsm SLA 정책(카테고리 예외) 관리 페이지.
 *
 * SLA 티어는 계약 단위 등급이고, SLA 정책은 (priority, category) 단위 예외 오버라이드.
 * 본 페이지에서 CRUD + 저장된 정책으로 활성 타이머 재계산.
 */

import { useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
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
  ModalFooter,
  Select,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "../../components/ui";
import * as slaPolicyApi from "../../lib/api/slaPolicies";
import type {
  Priority,
  SlaPolicy,
  SlaRecalcResult,
} from "../../lib/api/itsmTypes";
import { PRIORITY_LABELS } from "../../lib/api/itsmTypes";

const PRIORITIES: Priority[] = ["critical", "high", "normal", "low"];

const PRIORITY_FILTER_OPTIONS = [
  { value: "", label: "전체 우선순위" },
  ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
];

const PRIORITY_FORM_OPTIONS = PRIORITIES.map((p) => ({
  value: p,
  label: PRIORITY_LABELS[p],
}));

const ACTIVE_FILTER_OPTIONS = [
  { value: "", label: "전체" },
  { value: "true", label: "활성만" },
];

const ACTIVE_FORM_OPTIONS = [
  { value: "true", label: "활성" },
  { value: "false", label: "비활성" },
];

interface PolicyForm {
  name: string;
  priority: Priority;
  category: string;
  response_minutes: string;
  resolution_minutes: string;
  business_hours_json: string;
  active: boolean;
}

const EMPTY_FORM: PolicyForm = {
  name: "",
  priority: "normal",
  category: "",
  response_minutes: "60",
  resolution_minutes: "1440",
  business_hours_json: "",
  active: true,
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}시간 ${m}분` : `${h}시간`;
  }
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return h ? `${d}일 ${h}시간` : `${d}일`;
}

export default function SlaPolicies() {
  const [items, setItems] = useState<SlaPolicy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SlaPolicy | null>(null);
  const [form, setForm] = useState<PolicyForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [recalcing, setRecalcing] = useState<string | null>(null);

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const params: slaPolicyApi.SlaPolicyListParams = { page: 1, page_size: 200 };
      if (priorityFilter) params.priority = priorityFilter as Priority;
      if (activeFilter === "true") params.active_only = true;
      if (search.trim()) params.search = search.trim();
      const res = await slaPolicyApi.listSlaPolicies(params);
      setItems(res.items);
      setTotal(res.total);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`SLA 정책 조회 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(item: SlaPolicy) {
    setEditing(item);
    setForm({
      name: item.name,
      priority: item.priority,
      category: item.category ?? "",
      response_minutes: String(item.response_minutes),
      resolution_minutes: String(item.resolution_minutes),
      business_hours_json: item.business_hours
        ? JSON.stringify(item.business_hours, null, 2)
        : "",
      active: item.active,
    });
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      setError("이름은 필수입니다.");
      return;
    }
    const resp = Number(form.response_minutes);
    const reso = Number(form.resolution_minutes);
    if (!Number.isFinite(resp) || resp <= 0 || !Number.isFinite(reso) || reso <= 0) {
      setError("응답/해결 시간은 양의 정수여야 합니다.");
      return;
    }
    let businessHours: Record<string, unknown> | null = null;
    if (form.business_hours_json.trim()) {
      try {
        businessHours = JSON.parse(form.business_hours_json);
      } catch {
        setError("영업시간 JSON 파싱 실패: 유효한 JSON을 입력하세요.");
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        priority: form.priority,
        category: form.category.trim() || null,
        response_minutes: resp,
        resolution_minutes: reso,
        business_hours: businessHours,
        active: form.active,
      };
      if (editing) {
        await slaPolicyApi.updateSlaPolicy(editing.id, payload);
        setSuccess("SLA 정책이 수정되었습니다.");
      } else {
        await slaPolicyApi.createSlaPolicy(payload);
        setSuccess("SLA 정책이 등록되었습니다.");
      }
      setModalOpen(false);
      await fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`저장 실패: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: SlaPolicy) {
    if (!confirm(`"${item.name}" SLA 정책을 삭제하시겠습니까?`)) return;
    setError(null);
    try {
      await slaPolicyApi.deleteSlaPolicy(item.id);
      setSuccess("SLA 정책이 삭제되었습니다.");
      await fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`삭제 실패: ${msg}`);
    }
  }

  async function handleRecalculate(item: SlaPolicy) {
    if (
      !confirm(
        `"${item.name}" 정책으로 활성 타이머를 재계산합니다.\n` +
          "이미 위반/달성 상태인 타이머는 건너뜁니다. 계속하시겠습니까?",
      )
    )
      return;
    setRecalcing(item.id);
    setError(null);
    try {
      const result: SlaRecalcResult = await slaPolicyApi.recalculateSlaPolicy(item.id);
      setSuccess(
        `재계산 완료 — 스캔 ${result.tickets_scanned} / 갱신 ${result.timers_updated} / 스킵(위반) ${result.skipped_breached} / 스킵(달성) ${result.skipped_satisfied}`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`재계산 실패: ${msg}`);
    } finally {
      setRecalcing(null);
    }
  }

  return (
    <>
      <ContentHeader
        title="SLA 정책 관리"
        description={`총 ${total}건의 정책 (카테고리/우선순위 예외)`}
        actions={
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            정책 등록
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
            <div className="flex items-end gap-3 flex-wrap">
              <div className="w-40">
                <Select
                  label="우선순위"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  options={PRIORITY_FILTER_OPTIONS}
                />
              </div>
              <div className="w-32">
                <Select
                  label="활성 여부"
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  options={ACTIVE_FILTER_OPTIONS}
                />
              </div>
              <div className="flex-1 min-w-48">
                <Input
                  label="검색"
                  placeholder="이름/카테고리 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void fetchList();
                  }}
                />
              </div>
              <Button variant="secondary" onClick={() => void fetchList()}>
                조회
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
                title="등록된 SLA 정책이 없습니다"
                description="우측 상단의 [정책 등록] 버튼으로 추가하세요."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>우선순위</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead>응답</TableHead>
                    <TableHead>해결</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="w-44 text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="default">{PRIORITY_LABELS[item.priority]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.category || (
                          <span className="text-muted-foreground">전체</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDuration(item.response_minutes)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDuration(item.resolution_minutes)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.active ? "success" : "default"}>
                          {item.active ? "활성" : "비활성"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRecalculate(item)}
                            title="활성 타이머 재계산"
                            disabled={recalcing === item.id}
                          >
                            <RefreshCw
                              className={`h-4 w-4 ${recalcing === item.id ? "animate-spin" : ""}`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(item)}
                            title="수정"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(item)}
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "SLA 정책 수정" : "SLA 정책 등록"}
        size="lg"
        footer={
          <ModalFooter
            onCancel={() => setModalOpen(false)}
            onConfirm={() => void handleSubmit()}
            confirmText={editing ? "수정" : "등록"}
            loading={saving}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="이름 *"
            placeholder="예: 보안 이슈 Critical 즉시대응"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="우선순위 *"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
              options={PRIORITY_FORM_OPTIONS}
            />
            <Input
              label="카테고리"
              placeholder="예: security (비우면 전체 적용)"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              helperText="우선순위 + 카테고리 조합으로 매칭"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="응답 시간 (분) *"
              type="number"
              min={1}
              value={form.response_minutes}
              onChange={(e) => setForm({ ...form, response_minutes: e.target.value })}
            />
            <Input
              label="해결 시간 (분) *"
              type="number"
              min={1}
              value={form.resolution_minutes}
              onChange={(e) => setForm({ ...form, resolution_minutes: e.target.value })}
            />
          </div>

          <Textarea
            label="영업시간 JSON (선택)"
            rows={4}
            placeholder='{"timezone":"Asia/Seoul","weekday":[{"start":"09:00","end":"18:00"}]}'
            value={form.business_hours_json}
            onChange={(e) => setForm({ ...form, business_hours_json: e.target.value })}
            helperText="비우면 24/7 적용. 유효한 JSON만 허용"
          />

          <Select
            label="상태"
            value={form.active ? "true" : "false"}
            onChange={(e) => setForm({ ...form, active: e.target.value === "true" })}
            options={ACTIVE_FORM_OPTIONS}
          />
        </div>
      </Modal>
    </>
  );
}
