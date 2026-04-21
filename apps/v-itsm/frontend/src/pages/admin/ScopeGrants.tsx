/**
 * v-itsm 스코프 권한 관리 페이지.
 *
 * SYSTEM_ADMIN 전용. PermissionGroup × (service_type, customer, product) → scope_level 매트릭스.
 * NULL 은 와일드카드로 "모든 서비스구분/고객사/제품" 을 의미.
 */

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  InfoBox,
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
} from "../../components/ui";
import { getGroups } from "@v-platform/core/api/permission-groups";
import type { PermissionGroup } from "@v-platform/core/api/types";
import * as scopeGrantApi from "../../lib/api/scopeGrants";
import * as customerApi from "../../lib/api/customers";
import * as productApi from "../../lib/api/products";
import {
  SCOPE_LEVEL_LABELS,
  SERVICE_TYPE_LABELS,
  type Customer,
  type Product,
  type RequestServiceType,
  type ScopeGrant,
  type ScopeLevel,
} from "../../lib/api/itsmTypes";

interface GrantForm {
  permission_group_id: string;
  service_type: string;
  customer_id: string;
  product_id: string;
  scope_level: ScopeLevel;
}

const EMPTY_FORM: GrantForm = {
  permission_group_id: "",
  service_type: "",
  customer_id: "",
  product_id: "",
  scope_level: "read",
};

const SERVICE_TYPE_OPTIONS = [
  { value: "", label: "모든 서비스구분" },
  { value: "on_premise", label: SERVICE_TYPE_LABELS.on_premise },
  { value: "saas", label: SERVICE_TYPE_LABELS.saas },
  { value: "internal", label: SERVICE_TYPE_LABELS.internal },
  { value: "partner", label: SERVICE_TYPE_LABELS.partner },
];

const SCOPE_LEVEL_OPTIONS: Array<{ value: ScopeLevel; label: string }> = [
  { value: "read", label: `${SCOPE_LEVEL_LABELS.read} (read)` },
  { value: "write", label: `${SCOPE_LEVEL_LABELS.write} (write)` },
];

export default function ScopeGrants() {
  const [items, setItems] = useState<ScopeGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<GrantForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function fetchRefs() {
    try {
      const [g, c, p] = await Promise.all([
        getGroups(),
        customerApi.listCustomers({ page_size: 100 }),
        productApi.listProducts({ page_size: 100 }),
      ]);
      setGroups(g);
      setCustomers(c.items);
      setProducts(p.items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`참조 데이터 조회 실패: ${msg}`);
    }
  }

  async function fetchList() {
    setLoading(true);
    setError(null);
    try {
      const params: scopeGrantApi.ScopeGrantListParams = {};
      if (groupFilter) params.permission_group_id = Number(groupFilter);
      if (customerFilter) params.customer_id = customerFilter;
      if (productFilter) params.product_id = productFilter;
      const res = await scopeGrantApi.listScopeGrants(params);
      setItems(res.items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`스코프 조회 실패: ${msg}`);
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
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!form.permission_group_id) {
      setError("권한 그룹을 선택하세요.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await scopeGrantApi.createScopeGrant({
        permission_group_id: Number(form.permission_group_id),
        service_type: (form.service_type || null) as RequestServiceType | null,
        customer_id: form.customer_id || null,
        product_id: form.product_id || null,
        scope_level: form.scope_level,
      });
      setSuccess("스코프가 부여되었습니다.");
      setModalOpen(false);
      await fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`저장 실패: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: ScopeGrant) {
    if (!confirm("이 스코프 권한을 삭제하시겠습니까?")) return;
    setError(null);
    try {
      await scopeGrantApi.deleteScopeGrant(item.id);
      setSuccess("스코프가 삭제되었습니다.");
      await fetchList();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`삭제 실패: ${msg}`);
    }
  }

  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const productMap = new Map(products.map((p) => [p.id, p]));

  const groupFilterOptions = [
    { value: "", label: "전체 권한그룹" },
    ...groups.map((g) => ({ value: String(g.id), label: g.name })),
  ];
  const groupFormOptions = [
    { value: "", label: "권한그룹을 선택하세요" },
    ...groups.map((g) => ({ value: String(g.id), label: g.name })),
  ];
  const customerFilterOptions = [
    { value: "", label: "전체 고객사" },
    ...customers.map((c) => ({ value: c.id, label: c.name })),
  ];
  const customerFormOptions = [
    { value: "", label: "모든 고객사 (NULL 와일드카드)" },
    ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
  ];
  const productFilterOptions = [
    { value: "", label: "전체 제품" },
    ...products.map((p) => ({ value: p.id, label: p.name })),
  ];
  const productFormOptions = [
    { value: "", label: "모든 제품 (NULL 와일드카드)" },
    ...products.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })),
  ];

  return (
    <>
      <ContentHeader
        title="스코프 권한 관리"
        description={`총 ${items.length}건의 스코프 부여`}
        actions={
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />
            스코프 부여
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

        <InfoBox>
          권한그룹에 부여된 스코프 튜플(서비스구분·고객사·제품)이 합집합(OR)로 평가됩니다.
          NULL(공백) 은 모든 값을 허용하는 와일드카드입니다. SYSTEM_ADMIN 은 스코프와 무관하게 전권을 가집니다.
        </InfoBox>

        <Card>
          <CardBody>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-56">
                <Select
                  label="권한그룹"
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  options={groupFilterOptions}
                />
              </div>
              <div className="w-56">
                <Select
                  label="고객사"
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  options={customerFilterOptions}
                />
              </div>
              <div className="w-56">
                <Select
                  label="제품"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  options={productFilterOptions}
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
                title="부여된 스코프가 없습니다"
                description="우측 상단의 [스코프 부여] 버튼으로 추가하세요."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>권한그룹</TableHead>
                    <TableHead>서비스구분</TableHead>
                    <TableHead>고객사</TableHead>
                    <TableHead>제품</TableHead>
                    <TableHead>권한 수준</TableHead>
                    <TableHead>부여일</TableHead>
                    <TableHead className="w-24 text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const group = groupMap.get(item.permission_group_id);
                    const customer = item.customer_id ? customerMap.get(item.customer_id) : null;
                    const product = item.product_id ? productMap.get(item.product_id) : null;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {group ? group.name : `#${item.permission_group_id}`}
                        </TableCell>
                        <TableCell>
                          {item.service_type ? (
                            SERVICE_TYPE_LABELS[item.service_type]
                          ) : (
                            <span className="text-muted-foreground italic">모두</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.customer_id ? (
                            customer ? (
                              customer.name
                            ) : (
                              <span className="font-mono text-xs">{item.customer_id.slice(0, 8)}</span>
                            )
                          ) : (
                            <span className="text-muted-foreground italic">모두</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.product_id ? (
                            product ? (
                              product.name
                            ) : (
                              <span className="font-mono text-xs">{item.product_id.slice(0, 8)}</span>
                            )
                          ) : (
                            <span className="text-muted-foreground italic">모두</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.scope_level === "write" ? "warning" : "info"}>
                            {SCOPE_LEVEL_LABELS[item.scope_level]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(item)}
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="스코프 권한 부여"
        size="md"
        footer={
          <ModalFooter
            onCancel={() => setModalOpen(false)}
            onConfirm={() => void handleSubmit()}
            confirmText="부여"
            loading={saving}
          />
        }
      >
        <div className="space-y-4">
          <Select
            label="권한그룹 *"
            value={form.permission_group_id}
            onChange={(e) => setForm({ ...form, permission_group_id: e.target.value })}
            options={groupFormOptions}
          />
          <Select
            label="서비스구분"
            value={form.service_type}
            onChange={(e) => setForm({ ...form, service_type: e.target.value })}
            options={SERVICE_TYPE_OPTIONS}
            helperText="비워두면 모든 서비스구분(와일드카드)"
          />
          <Select
            label="고객사"
            value={form.customer_id}
            onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
            options={customerFormOptions}
            helperText="비워두면 모든 고객사(와일드카드)"
          />
          <Select
            label="제품"
            value={form.product_id}
            onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            options={productFormOptions}
            helperText="비워두면 모든 제품(와일드카드)"
          />
          <Select
            label="권한 수준 *"
            value={form.scope_level}
            onChange={(e) =>
              setForm({ ...form, scope_level: e.target.value as ScopeLevel })
            }
            options={SCOPE_LEVEL_OPTIONS}
            helperText="read = 조회만 / write = 접수/수정/전이"
          />
        </div>
      </Modal>
    </>
  );
}
