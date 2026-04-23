/**
 * v-itsm SLA 알림 정책 관리 페이지.
 *
 * warning(80%) / breach(100%) 이벤트 발생 시 누구에게 어느 채널로 알릴지 관리.
 * 우선순위·서비스구분 조합으로 필터링 가능 (NULL = 전체 적용).
 */

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Drawer,
  DrawerFooter,
  EmptyState,
  Input,
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
import * as api from "../../lib/api/slaNotificationPolicies";
import type {
  Priority,
  RequestServiceType,
  SlaNotificationPolicy,
  TriggerEvent,
} from "../../lib/api/itsmTypes";
import {
  PRIORITY_LABELS,
  SERVICE_TYPE_LABELS,
  TRIGGER_EVENT_LABELS,
} from "../../lib/api/itsmTypes";

const TRIGGER_EVENTS: TriggerEvent[] = ["warning", "breach"];
const PRIORITIES: Priority[] = ["critical", "high", "normal", "low"];
const SERVICE_TYPES: RequestServiceType[] = [
  "on_premise",
  "saas",
  "internal",
  "partner",
];
const CHANNELS = ["slack", "teams", "email"];

const TRIGGER_FILTER_OPTIONS = [
  { value: "", label: "전체 트리거" },
  ...TRIGGER_EVENTS.map((t) => ({ value: t, label: TRIGGER_EVENT_LABELS[t] })),
];

const TRIGGER_FORM_OPTIONS = TRIGGER_EVENTS.map((t) => ({
  value: t,
  label: TRIGGER_EVENT_LABELS[t],
}));

const PRIORITY_FILTER_OPTIONS = [
  { value: "", label: "전체 우선순위" },
  ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
];

const PRIORITY_FORM_OPTIONS = [
  { value: "", label: "전체 (NULL)" },
  ...PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] })),
];

const SERVICE_TYPE_FILTER_OPTIONS = [
  { value: "", label: "전체 서비스구분" },
  ...SERVICE_TYPES.map((s) => ({ value: s, label: SERVICE_TYPE_LABELS[s] })),
];

const SERVICE_TYPE_FORM_OPTIONS = [
  { value: "", label: "전체 (NULL)" },
  ...SERVICE_TYPES.map((s) => ({ value: s, label: SERVICE_TYPE_LABELS[s] })),
];

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
  trigger_event: TriggerEvent;
  applies_priority: string;
  applies_service_type: string;
  notify_channels: string[];
  notify_assignee: boolean;
  notify_assignee_manager: boolean;
  notify_custom_user_ids_text: string;
  notify_custom_addresses_text: string;
  template_key: string;
  active: boolean;
}

const EMPTY_FORM: PolicyForm = {
  name: "",
  trigger_event: "warning",
  applies_priority: "",
  applies_service_type: "",
  notify_channels: ["slack"],
  notify_assignee: true,
  notify_assignee_manager: false,
  notify_custom_user_ids_text: "",
  notify_custom_addresses_text: "",
  template_key: "",
  active: true,
};

function parseIdList(text: string): number[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const ids = trimmed
    .split(/[\s,]+/)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length ? ids : null;
}

function parseAddressList(text: string): string[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const items = trimmed
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

const PAGE_SIZE = 20;

export default function SlaNotificationPolicies() {
  const [items, setItems] = useState<SlaNotificationPolicy[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [triggerFilter, setTriggerFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<SlaNotificationPolicy | null>(null);
  const [form, setForm] = useState<PolicyForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function fetchList(targetPage: number = page) {
    setLoading(true);
    setError(null);
    try {
      const params: api.SlaNotificationPolicyListParams = {
        page: targetPage,
        page_size: PAGE_SIZE,
      };
      if (triggerFilter) params.trigger_event = triggerFilter as TriggerEvent;
      if (priorityFilter) params.priority = priorityFilter as Priority;
      if (serviceTypeFilter)
        params.service_type = serviceTypeFilter as RequestServiceType;
      if (activeFilter === "true") params.active_only = true;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await api.listSlaNotificationPolicies(params);
      setItems(res.items);
      setTotal(res.total);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`알림 정책 조회 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
    void fetchList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerFilter, priorityFilter, serviceTypeFilter, activeFilter, searchQuery]);

  useEffect(() => {
    void fetchList(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function applySearch() {
    setSearchQuery(search);
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openEdit(item: SlaNotificationPolicy) {
    setEditing(item);
    setForm({
      name: item.name,
      trigger_event: item.trigger_event,
      applies_priority: item.applies_priority ?? "",
      applies_service_type: item.applies_service_type ?? "",
      notify_channels: [...item.notify_channels],
      notify_assignee: item.notify_assignee,
      notify_assignee_manager: item.notify_assignee_manager,
      notify_custom_user_ids_text: item.notify_custom_user_ids
        ? item.notify_custom_user_ids.join(", ")
        : "",
      notify_custom_addresses_text: item.notify_custom_addresses
        ? item.notify_custom_addresses.join(", ")
        : "",
      template_key: item.template_key ?? "",
      active: item.active,
    });
    setDrawerOpen(true);
  }

  function toggleChannel(ch: string) {
    setForm((f) => {
      const has = f.notify_channels.includes(ch);
      return {
        ...f,
        notify_channels: has
          ? f.notify_channels.filter((c) => c !== ch)
          : [...f.notify_channels, ch],
      };
    });
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      setError("이름은 필수입니다.");
      return;
    }
    if (form.notify_channels.length === 0) {
      setError("최소 1개 채널을 선택하세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        trigger_event: form.trigger_event,
        applies_priority: (form.applies_priority || null) as Priority | null,
        applies_service_type: (form.applies_service_type ||
          null) as RequestServiceType | null,
        notify_channels: form.notify_channels,
        notify_assignee: form.notify_assignee,
        notify_assignee_manager: form.notify_assignee_manager,
        notify_custom_user_ids: parseIdList(form.notify_custom_user_ids_text),
        notify_custom_addresses: parseAddressList(form.notify_custom_addresses_text),
        template_key: form.template_key.trim() || null,
        active: form.active,
      };
      if (editing) {
        await api.updateSlaNotificationPolicy(editing.id, payload);
        setSuccess("알림 정책이 수정되었습니다.");
      } else {
        await api.createSlaNotificationPolicy(payload);
        setSuccess("알림 정책이 등록되었습니다.");
      }
      setDrawerOpen(false);
      await fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`저장 실패: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: SlaNotificationPolicy) {
    if (!confirm(`"${item.name}" 알림 정책을 삭제하시겠습니까?`)) return;
    setError(null);
    try {
      await api.deleteSlaNotificationPolicy(item.id);
      setSuccess("알림 정책이 삭제되었습니다.");
      await fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`삭제 실패: ${msg}`);
    }
  }

  return (
    <>
      <ContentHeader
        title="SLA 알림 정책"
        description={`총 ${total}건의 알림 정책 (warning=80%, breach=100%)`}
        actions={
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            알림 정책 등록
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
                  label="트리거"
                  value={triggerFilter}
                  onChange={(e) => setTriggerFilter(e.target.value)}
                  options={TRIGGER_FILTER_OPTIONS}
                />
              </div>
              <div className="w-40">
                <Select
                  label="우선순위"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  options={PRIORITY_FILTER_OPTIONS}
                />
              </div>
              <div className="w-44">
                <Select
                  label="서비스구분"
                  value={serviceTypeFilter}
                  onChange={(e) => setServiceTypeFilter(e.target.value)}
                  options={SERVICE_TYPE_FILTER_OPTIONS}
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
                  placeholder="이름 검색 (Enter)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applySearch();
                  }}
                />
              </div>
              <Button variant="secondary" onClick={applySearch}>
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
                title="등록된 알림 정책이 없습니다"
                description="우측 상단의 [알림 정책 등록] 버튼으로 추가하세요."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>트리거</TableHead>
                    <TableHead>적용 범위</TableHead>
                    <TableHead>채널</TableHead>
                    <TableHead>수신자</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="w-32 text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.trigger_event === "breach" ? "error" : "warning"
                          }
                        >
                          {TRIGGER_EVENT_LABELS[item.trigger_event]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs space-x-1">
                        {item.applies_priority ? (
                          <Badge variant="default">
                            {PRIORITY_LABELS[item.applies_priority]}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">전체 우선순위</span>
                        )}
                        {item.applies_service_type && (
                          <Badge variant="default">
                            {SERVICE_TYPE_LABELS[item.applies_service_type]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {item.notify_channels.join(", ")}
                      </TableCell>
                      <TableCell className="text-xs">
                        {[
                          item.notify_assignee && "담당자",
                          item.notify_assignee_manager && "담당자 매니저",
                          item.notify_custom_user_ids?.length &&
                            `user(${item.notify_custom_user_ids.length})`,
                          item.notify_custom_addresses?.length &&
                            `addr(${item.notify_custom_addresses.length})`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
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
            {!loading && items.length > 0 && (
              <div className="flex items-center justify-between mt-4 text-sm text-content-secondary">
                <span>
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / 총 {total}건
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />이전
                  </Button>
                  <span className="px-2 tabular-nums">{page} / {totalPages}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    다음<ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? "알림 정책 수정" : "알림 정책 등록"}
        size="lg"
        footer={
          <DrawerFooter
            onCancel={() => setDrawerOpen(false)}
            onConfirm={() => void handleSubmit()}
            confirmText={editing ? "수정" : "등록"}
            loading={saving}
          />
        }
      >
        <div className="space-y-4">
          <Input
            label="이름 *"
            placeholder="예: Critical 위반 즉시 알림"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <div className="grid grid-cols-3 gap-3">
            <Select
              label="트리거 *"
              value={form.trigger_event}
              onChange={(e) =>
                setForm({ ...form, trigger_event: e.target.value as TriggerEvent })
              }
              options={TRIGGER_FORM_OPTIONS}
            />
            <Select
              label="적용 우선순위"
              value={form.applies_priority}
              onChange={(e) => setForm({ ...form, applies_priority: e.target.value })}
              options={PRIORITY_FORM_OPTIONS}
            />
            <Select
              label="적용 서비스구분"
              value={form.applies_service_type}
              onChange={(e) =>
                setForm({ ...form, applies_service_type: e.target.value })
              }
              options={SERVICE_TYPE_FORM_OPTIONS}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              채널 *
            </label>
            <div className="flex gap-4">
              {CHANNELS.map((ch) => (
                <label key={ch} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={form.notify_channels.includes(ch)}
                    onChange={() => toggleChannel(ch)}
                    className="rounded border-input"
                  />
                  <span className="capitalize">{ch}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={form.notify_assignee}
                onChange={(e) =>
                  setForm({ ...form, notify_assignee: e.target.checked })
                }
                className="rounded border-input"
              />
              <span>담당자에게 알림</span>
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={form.notify_assignee_manager}
                onChange={(e) =>
                  setForm({ ...form, notify_assignee_manager: e.target.checked })
                }
                className="rounded border-input"
              />
              <span>담당자 매니저에게 알림</span>
            </label>
          </div>

          <Textarea
            label="추가 사용자 ID (쉼표 구분)"
            rows={2}
            placeholder="1, 5, 12"
            value={form.notify_custom_user_ids_text}
            onChange={(e) =>
              setForm({ ...form, notify_custom_user_ids_text: e.target.value })
            }
            helperText="v-platform user.id 목록. 비우면 없음"
          />

          <Textarea
            label="추가 이메일 주소 (쉼표 구분)"
            rows={2}
            placeholder="oncall@example.com, ops@example.com"
            value={form.notify_custom_addresses_text}
            onChange={(e) =>
              setForm({ ...form, notify_custom_addresses_text: e.target.value })
            }
            helperText="email 채널에서 사용. 비우면 없음"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="템플릿 키"
              placeholder="예: sla_breach_default"
              value={form.template_key}
              onChange={(e) => setForm({ ...form, template_key: e.target.value })}
            />
            <Select
              label="상태"
              value={form.active ? "true" : "false"}
              onChange={(e) => setForm({ ...form, active: e.target.value === "true" })}
              options={ACTIVE_FORM_OPTIONS}
            />
          </div>
        </div>
      </Drawer>
    </>
  );
}
