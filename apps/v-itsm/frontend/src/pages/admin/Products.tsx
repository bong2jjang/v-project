/**
 * v-itsm 제품 카탈로그 관리 페이지.
 *
 * SYSTEM_ADMIN 전용 CRUD.
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
import * as productApi from "../../lib/api/products";
import type { Product } from "../../lib/api/itsmTypes";

interface ProductForm {
  code: string;
  name: string;
  description: string;
  active: boolean;
}

const EMPTY_FORM: ProductForm = {
  code: "",
  name: "",
  description: "",
  active: true,
};

const ACTIVE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "전체" },
  { value: "true", label: "활성" },
  { value: "false", label: "비활성" },
];

const ACTIVE_FORM_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "true", label: "활성" },
  { value: "false", label: "비활성" },
];

export default function Products() {
  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const params: productApi.ProductListParams = { page_size: 100 };
      if (search) params.search = search;
      if (activeFilter !== "") params.active = activeFilter === "true";
      const res = await productApi.listProducts(params);
      setItems(res.items);
      setTotal(res.total);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`제품 조회 실패: ${msg}`);
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
    setDrawerOpen(true);
  }

  function openEdit(item: Product) {
    setEditing(item);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description ?? "",
      active: item.active,
    });
    setDrawerOpen(true);
  }

  async function handleSubmit() {
    if (!form.code.trim() || !form.name.trim()) {
      setError("코드와 이름은 필수입니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await productApi.updateProduct(editing.id, {
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          active: form.active,
        });
        setSuccess("제품이 수정되었습니다.");
      } else {
        await productApi.createProduct({
          code: form.code.trim(),
          name: form.name.trim(),
          description: form.description.trim() || null,
          active: form.active,
        });
        setSuccess("제품이 등록되었습니다.");
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

  async function handleDelete(item: Product) {
    if (!confirm(`"${item.name}" 제품을 삭제하시겠습니까?`)) return;
    setError(null);
    try {
      await productApi.deleteProduct(item.id);
      setSuccess("제품이 삭제되었습니다.");
      await fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`삭제 실패: ${msg}`);
    }
  }

  return (
    <>
      <ContentHeader
        title="제품 관리"
        description={`총 ${total}건의 제품`}
        actions={
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            제품 등록
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
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <Input
                  label="검색"
                  placeholder="코드 또는 이름"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void fetchList();
                  }}
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
                title="등록된 제품이 없습니다"
                description="우측 상단의 [제품 등록] 버튼으로 추가하세요."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>코드</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>설명</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="w-32 text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono">{item.code}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.description || "-"}
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
          </CardBody>
        </Card>
      </div>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? "제품 수정" : "제품 등록"}
        size="md"
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
            label="코드 *"
            placeholder="예: V-ITSM"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            helperText="영문 대문자/숫자/하이픈 권장"
          />
          <Input
            label="이름 *"
            placeholder="예: v-itsm 업무 루프"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Textarea
            label="설명"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <Select
            label="상태"
            value={form.active ? "true" : "false"}
            onChange={(e) => setForm({ ...form, active: e.target.value === "true" })}
            options={ACTIVE_FORM_OPTIONS}
          />
        </div>
      </Drawer>
    </>
  );
}
