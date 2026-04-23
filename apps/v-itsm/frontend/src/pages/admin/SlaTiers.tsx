/**
 * v-itsm SLA 티어 관리 페이지.
 *
 * SYSTEM_ADMIN 전용 CRUD. priority_matrix (critical/high/normal/low × response/resolution 분) 편집.
 */

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Drawer,
  DrawerFooter,
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
import * as slaTierApi from "../../lib/api/slaTiers";
import type {
  SlaPriority,
  SlaPriorityMatrix,
  SlaTier,
} from "../../lib/api/itsmTypes";

const PRIORITIES: Array<{ key: SlaPriority; label: string }> = [
  { key: "critical", label: "Critical (긴급)" },
  { key: "high", label: "High (높음)" },
  { key: "normal", label: "Normal (보통)" },
  { key: "low", label: "Low (낮음)" },
];

const ACTIVE_FILTER_OPTIONS = [
  { value: "", label: "전체" },
  { value: "true", label: "활성" },
  { value: "false", label: "비활성" },
];

const ACTIVE_FORM_OPTIONS = [
  { value: "true", label: "활성" },
  { value: "false", label: "비활성" },
];

interface MatrixRow {
  response: string;
  resolution: string;
}

type MatrixForm = Record<SlaPriority, MatrixRow>;

interface SlaTierForm {
  code: string;
  name: string;
  description: string;
  active: boolean;
  matrix: MatrixForm;
}

const EMPTY_MATRIX: MatrixForm = {
  critical: { response: "15", resolution: "240" },
  high: { response: "30", resolution: "480" },
  normal: { response: "60", resolution: "1440" },
  low: { response: "240", resolution: "2880" },
};

const EMPTY_FORM: SlaTierForm = {
  code: "",
  name: "",
  description: "",
  active: true,
  matrix: JSON.parse(JSON.stringify(EMPTY_MATRIX)) as MatrixForm,
};

function matrixToForm(matrix: SlaPriorityMatrix): MatrixForm {
  const out: MatrixForm = JSON.parse(JSON.stringify(EMPTY_MATRIX)) as MatrixForm;
  for (const { key } of PRIORITIES) {
    const m = matrix[key];
    if (m) {
      out[key] = { response: String(m.response), resolution: String(m.resolution) };
    }
  }
  return out;
}

function formToMatrix(matrix: MatrixForm): SlaPriorityMatrix {
  const out: SlaPriorityMatrix = {};
  for (const { key } of PRIORITIES) {
    const r = Number(matrix[key].response);
    const s = Number(matrix[key].resolution);
    if (Number.isFinite(r) && Number.isFinite(s) && r > 0 && s > 0) {
      out[key] = { response: r, resolution: s };
    }
  }
  return out;
}

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

export default function SlaTiers() {
  const [items, setItems] = useState<SlaTier[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<SlaTier | null>(null);
  const [form, setForm] = useState<SlaTierForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const params: slaTierApi.SlaTierListParams = {};
      if (activeFilter === "true") params.active_only = true;
      const res = await slaTierApi.listSlaTiers(params);
      let list = res.items;
      if (activeFilter === "false") list = list.filter((t) => !t.active);
      setItems(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`SLA 티어 조회 실패: ${msg}`);
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
    setForm({
      ...EMPTY_FORM,
      matrix: JSON.parse(JSON.stringify(EMPTY_MATRIX)) as MatrixForm,
    });
    setDrawerOpen(true);
  }

  function openEdit(item: SlaTier) {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description ?? "",
      active: item.active,
      matrix: matrixToForm(item.priority_matrix),
    });
    setDrawerOpen(true);
  }

  async function handleSubmit() {
    if (!form.code.trim() || !form.name.trim()) {
      setError("코드와 이름은 필수입니다.");
      return;
    }
    const matrix = formToMatrix(form.matrix);
    if (Object.keys(matrix).length === 0) {
      setError("최소 한 개 이상의 우선순위 매트릭스 값이 필요합니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await slaTierApi.updateSlaTier(editing.id, {
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          active: form.active,
          priority_matrix: matrix,
        });
        setSuccess("SLA 티어가 수정되었습니다.");
      } else {
        await slaTierApi.createSlaTier({
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          active: form.active,
          priority_matrix: matrix,
        });
        setSuccess("SLA 티어가 등록되었습니다.");
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

  async function handleDelete(item: SlaTier) {
    if (!confirm(`"${item.name}" SLA 티어를 삭제하시겠습니까?\n연결된 계약이 있으면 실패합니다.`)) {
      return;
    }
    setError(null);
    try {
      await slaTierApi.deleteSlaTier(item.id);
      setSuccess("SLA 티어가 삭제되었습니다.");
      await fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`삭제 실패: ${msg}`);
    }
  }

  return (
    <>
      <ContentHeader
        title="SLA 티어 관리"
        description={`총 ${items.length}건의 티어`}
        actions={
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            티어 등록
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
            <div className="flex items-end gap-3">
              <div className="w-40">
                <Select
                  label="활성 여부"
                  value={activeFilter}
                  onChange={(e) => setActiveFilter(e.target.value)}
                  options={ACTIVE_FILTER_OPTIONS}
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
                title="등록된 SLA 티어가 없습니다"
                description="우측 상단의 [티어 등록] 버튼으로 추가하세요."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>코드</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>Critical</TableHead>
                    <TableHead>High</TableHead>
                    <TableHead>Normal</TableHead>
                    <TableHead>Low</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="w-32 text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.code}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      {PRIORITIES.map(({ key }) => {
                        const cell = item.priority_matrix[key];
                        return (
                          <TableCell key={key} className="text-xs">
                            {cell ? (
                              <div className="space-y-0.5">
                                <div>응답 {formatDuration(cell.response)}</div>
                                <div className="text-muted-foreground">
                                  해결 {formatDuration(cell.resolution)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        );
                      })}
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
          </CardBody>
        </Card>
      </div>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? "SLA 티어 수정" : "SLA 티어 등록"}
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
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="코드 *"
              placeholder="예: PLATINUM"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              helperText="영문 대문자 권장 (예: PLATINUM, GOLD)"
            />
            <Input
              label="이름 *"
              placeholder="예: 플래티넘"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <Textarea
            label="설명"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <Select
            label="상태"
            value={form.active ? "true" : "false"}
            onChange={(e) => setForm({ ...form, active: e.target.value === "true" })}
            options={ACTIVE_FORM_OPTIONS}
          />

          <div>
            <div className="text-sm font-medium mb-2">
              우선순위별 SLA 매트릭스 (분 단위)
            </div>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">우선순위</th>
                    <th className="px-3 py-2 text-left">응답 (분)</th>
                    <th className="px-3 py-2 text-left">해결 (분)</th>
                  </tr>
                </thead>
                <tbody>
                  {PRIORITIES.map(({ key, label }) => (
                    <tr key={key} className="border-t">
                      <td className="px-3 py-2">{label}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={form.matrix[key].response}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              matrix: {
                                ...form.matrix,
                                [key]: { ...form.matrix[key], response: e.target.value },
                              },
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={1}
                          value={form.matrix[key].resolution}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              matrix: {
                                ...form.matrix,
                                [key]: { ...form.matrix[key], resolution: e.target.value },
                              },
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              예: Critical 응답 15분 / 해결 240분 (4시간), Bronze Normal 응답 480분 / 해결 2880분 (2일)
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
