/**
 * v-itsm 계약 관리 페이지.
 *
 * SYSTEM_ADMIN 전용 CRUD. 고객/SLA 티어/제품 다대다 연결.
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
import * as contractApi from "../../lib/api/contracts";
import * as customerApi from "../../lib/api/customers";
import * as productApi from "../../lib/api/products";
import * as slaTierApi from "../../lib/api/slaTiers";
import {
  CONTRACT_STATUS_LABELS,
  type Contract,
  type ContractStatus,
  type Customer,
  type Product,
  type SlaTier,
} from "../../lib/api/itsmTypes";

interface ContractForm {
  contract_no: string;
  customer_id: string;
  name: string;
  start_date: string;
  end_date: string;
  sla_tier_id: string;
  status: ContractStatus;
  notes: string;
  product_ids: string[];
}

const EMPTY_FORM: ContractForm = {
  contract_no: "",
  customer_id: "",
  name: "",
  start_date: "",
  end_date: "",
  sla_tier_id: "",
  status: "active",
  notes: "",
  product_ids: [],
};

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "전체" },
  { value: "active", label: CONTRACT_STATUS_LABELS.active },
  { value: "expired", label: CONTRACT_STATUS_LABELS.expired },
  { value: "terminated", label: CONTRACT_STATUS_LABELS.terminated },
];

const STATUS_FORM_OPTIONS: Array<{ value: ContractStatus; label: string }> = [
  { value: "active", label: CONTRACT_STATUS_LABELS.active },
  { value: "expired", label: CONTRACT_STATUS_LABELS.expired },
  { value: "terminated", label: CONTRACT_STATUS_LABELS.terminated },
];

function statusBadgeVariant(status: ContractStatus): "success" | "warning" | "default" {
  if (status === "active") return "success";
  if (status === "expired") return "warning";
  return "default";
}

export default function Contracts() {
  const [items, setItems] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tiers, setTiers] = useState<SlaTier[]>([]);
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form, setForm] = useState<ContractForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function fetchRefs() {
    try {
      const [c, p, t] = await Promise.all([
        customerApi.listCustomers({ page_size: 100, status: "active" }),
        productApi.listProducts({ page_size: 100, active: true }),
        slaTierApi.listSlaTiers({ active_only: true }),
      ]);
      setCustomers(c.items);
      setProducts(p.items);
      setTiers(t.items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`참조 데이터 조회 실패: ${msg}`);
    }
  }

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const params: contractApi.ContractListParams = { page_size: 100 };
      if (search) params.search = search;
      if (customerFilter) params.customer_id = customerFilter;
      if (statusFilter) params.status = statusFilter as ContractStatus;
      const res = await contractApi.listContracts(params);
      setItems(res.items);
      setTotal(res.total);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`계약 조회 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRefs();
    void fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openEdit(item: Contract) {
    setEditing(item);
    setForm({
      contract_no: item.contract_no,
      customer_id: item.customer_id,
      name: item.name,
      start_date: item.start_date ?? "",
      end_date: item.end_date ?? "",
      sla_tier_id: item.sla_tier_id ?? "",
      status: item.status,
      notes: item.notes ?? "",
      product_ids: [...item.product_ids],
    });
    setDrawerOpen(true);
  }

  async function handleSubmit() {
    if (!form.contract_no.trim() || !form.name.trim()) {
      setError("계약번호와 계약명은 필수입니다.");
      return;
    }
    if (!editing && !form.customer_id) {
      setError("고객사를 선택하세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await contractApi.updateContract(editing.id, {
          contract_no: form.contract_no.trim(),
          name: form.name.trim(),
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          sla_tier_id: form.sla_tier_id || null,
          status: form.status,
          notes: form.notes.trim() || null,
          product_ids: form.product_ids,
        });
        setSuccess("계약이 수정되었습니다.");
      } else {
        await contractApi.createContract({
          contract_no: form.contract_no.trim(),
          customer_id: form.customer_id,
          name: form.name.trim(),
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          sla_tier_id: form.sla_tier_id || null,
          status: form.status,
          notes: form.notes.trim() || null,
          product_ids: form.product_ids,
        });
        setSuccess("계약이 등록되었습니다.");
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

  async function handleDelete(item: Contract) {
    if (!confirm(`"${item.name}" 계약을 삭제하시겠습니까?`)) return;
    setError(null);
    try {
      await contractApi.deleteContract(item.id);
      setSuccess("계약이 삭제되었습니다.");
      await fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`삭제 실패: ${msg}`);
    }
  }

  function toggleProduct(id: string) {
    setForm((prev) =>
      prev.product_ids.includes(id)
        ? { ...prev, product_ids: prev.product_ids.filter((x) => x !== id) }
        : { ...prev, product_ids: [...prev.product_ids, id] },
    );
  }

  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const tierMap = new Map(tiers.map((t) => [t.id, t]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const customerOptions = [
    { value: "", label: "전체 고객사" },
    ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
  ];
  const customerFormOptions = customers.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.code})`,
  }));
  const tierFormOptions = [
    { value: "", label: "(선택 안 함)" },
    ...tiers.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` })),
  ];

  return (
    <>
      <ContentHeader
        title="계약 관리"
        description={`총 ${total}건의 계약`}
        actions={
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            계약 등록
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
                  placeholder="계약번호 또는 계약명"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void fetchList();
                  }}
                />
              </div>
              <div className="w-56">
                <Select
                  label="고객사"
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  options={customerOptions}
                />
              </div>
              <div className="w-32">
                <Select
                  label="상태"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  options={STATUS_FILTER_OPTIONS}
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
                title="등록된 계약이 없습니다"
                description="우측 상단의 [계약 등록] 버튼으로 추가하세요."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>계약번호</TableHead>
                    <TableHead>계약명</TableHead>
                    <TableHead>고객사</TableHead>
                    <TableHead>SLA 티어</TableHead>
                    <TableHead>제품</TableHead>
                    <TableHead>기간</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="w-32 text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const customer = customerMap.get(item.customer_id);
                    const tier = item.sla_tier_id ? tierMap.get(item.sla_tier_id) : null;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.contract_no}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{customer ? customer.name : item.customer_id}</TableCell>
                        <TableCell>
                          {tier ? (
                            <Badge variant="info">{tier.code}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.product_ids.length === 0 ? (
                            <span className="text-muted-foreground">-</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {item.product_ids.slice(0, 3).map((pid) => {
                                const p = productMap.get(pid);
                                return (
                                  <Badge key={pid} variant="default">
                                    {p ? p.code : pid.slice(0, 8)}
                                  </Badge>
                                );
                              })}
                              {item.product_ids.length > 3 && (
                                <span className="text-muted-foreground">
                                  +{item.product_ids.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {item.start_date || "-"} ~ {item.end_date || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(item.status)}>
                            {CONTRACT_STATUS_LABELS[item.status]}
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
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? "계약 수정" : "계약 등록"}
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
              label="계약번호 *"
              placeholder="예: CT-2026-001"
              value={form.contract_no}
              onChange={(e) => setForm({ ...form, contract_no: e.target.value })}
            />
            <Input
              label="계약명 *"
              placeholder="예: ACME 유지보수 2026"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <Select
            label="고객사 *"
            value={form.customer_id}
            onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
            options={[
              { value: "", label: "고객사를 선택하세요" },
              ...customerFormOptions,
            ]}
            disabled={!!editing}
            helperText={editing ? "고객사는 수정할 수 없습니다" : undefined}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="시작일"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
            <Input
              label="종료일"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="SLA 티어"
              value={form.sla_tier_id}
              onChange={(e) => setForm({ ...form, sla_tier_id: e.target.value })}
              options={tierFormOptions}
            />
            <Select
              label="상태"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as ContractStatus })
              }
              options={STATUS_FORM_OPTIONS}
            />
          </div>

          <div>
            <div className="text-sm font-medium mb-2">계약 제품</div>
            <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-1">
              {products.length === 0 ? (
                <div className="text-sm text-muted-foreground">등록된 제품이 없습니다.</div>
              ) : (
                products.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.product_ids.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                    />
                    <span className="font-mono text-xs">{p.code}</span>
                    <span className="text-sm">{p.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <Textarea
            label="비고"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </Drawer>
    </>
  );
}
