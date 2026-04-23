/**
 * v-itsm 고객사 관리 페이지.
 *
 * SYSTEM_ADMIN 전용 CRUD + 고객 담당자 관리.
 */

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
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
import * as customerApi from "../../lib/api/customers";
import {
  CUSTOMER_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  type Customer,
  type CustomerContact,
  type CustomerStatus,
  type RequestServiceType,
} from "../../lib/api/itsmTypes";

const SERVICE_TYPE_OPTIONS: Array<{ value: RequestServiceType; label: string }> = [
  { value: "on_premise", label: SERVICE_TYPE_LABELS.on_premise },
  { value: "saas", label: SERVICE_TYPE_LABELS.saas },
  { value: "internal", label: SERVICE_TYPE_LABELS.internal },
  { value: "partner", label: SERVICE_TYPE_LABELS.partner },
];

const STATUS_OPTIONS: Array<{ value: CustomerStatus; label: string }> = [
  { value: "active", label: CUSTOMER_STATUS_LABELS.active },
  { value: "inactive", label: CUSTOMER_STATUS_LABELS.inactive },
];

interface CustomerForm {
  code: string;
  name: string;
  service_type: RequestServiceType;
  industry: string;
  status: CustomerStatus;
  notes: string;
}

const emptyForm: CustomerForm = {
  code: "",
  name: "",
  service_type: "on_premise",
  industry: "",
  status: "active",
  notes: "",
};

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  role_title: string;
  is_primary: boolean;
  notes: string;
}

const emptyContactForm: ContactForm = {
  name: "",
  email: "",
  phone: "",
  role_title: "",
  is_primary: false,
  notes: "",
};

export default function Customers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [contactCustomer, setContactCustomer] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactEditing, setContactEditing] = useState<CustomerContact | null>(
    null,
  );
  const [contactForm, setContactForm] = useState<ContactForm>(emptyContactForm);
  const [contactSaving, setContactSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await customerApi.listCustomers({
        page: 1,
        page_size: 100,
        search: search || undefined,
        service_type: (serviceFilter || undefined) as RequestServiceType | undefined,
        status: (statusFilter || undefined) as CustomerStatus | undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDrawerOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      code: c.code,
      name: c.name,
      service_type: c.service_type,
      industry: c.industry ?? "",
      status: c.status,
      notes: c.notes ?? "",
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError("코드와 이름은 필수입니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await customerApi.updateCustomer(editing.id, {
          code: form.code.trim(),
          name: form.name.trim(),
          service_type: form.service_type,
          industry: form.industry.trim() || null,
          status: form.status,
          notes: form.notes.trim() || null,
        });
        setSuccess("고객사를 수정했습니다.");
      } else {
        await customerApi.createCustomer({
          code: form.code.trim(),
          name: form.name.trim(),
          service_type: form.service_type,
          industry: form.industry.trim() || null,
          status: form.status,
          notes: form.notes.trim() || null,
        });
        setSuccess("고객사를 등록했습니다.");
      }
      setDrawerOpen(false);
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`고객사 "${c.name}"을(를) 삭제할까요?`)) return;
    try {
      await customerApi.deleteCustomer(c.id);
      setSuccess("고객사를 삭제했습니다.");
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  };

  const openContacts = async (c: Customer) => {
    setContactCustomer(c);
    setContactEditing(null);
    setContactForm(emptyContactForm);
    setContactLoading(true);
    try {
      const rows = await customerApi.listContacts(c.id);
      setContacts(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "담당자 목록 조회 실패");
    } finally {
      setContactLoading(false);
    }
  };

  const refreshContacts = async () => {
    if (!contactCustomer) return;
    const rows = await customerApi.listContacts(contactCustomer.id);
    setContacts(rows);
  };

  const editContact = (ct: CustomerContact) => {
    setContactEditing(ct);
    setContactForm({
      name: ct.name,
      email: ct.email ?? "",
      phone: ct.phone ?? "",
      role_title: ct.role_title ?? "",
      is_primary: ct.is_primary,
      notes: ct.notes ?? "",
    });
  };

  const saveContact = async () => {
    if (!contactCustomer) return;
    if (!contactForm.name.trim()) {
      setError("담당자 이름은 필수입니다.");
      return;
    }
    setContactSaving(true);
    setError(null);
    try {
      const payload = {
        name: contactForm.name.trim(),
        email: contactForm.email.trim() || null,
        phone: contactForm.phone.trim() || null,
        role_title: contactForm.role_title.trim() || null,
        is_primary: contactForm.is_primary,
        notes: contactForm.notes.trim() || null,
      };
      if (contactEditing) {
        await customerApi.updateContact(contactEditing.id, payload);
      } else {
        await customerApi.createContact(contactCustomer.id, payload);
      }
      setContactEditing(null);
      setContactForm(emptyContactForm);
      await refreshContacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "담당자 저장 실패");
    } finally {
      setContactSaving(false);
    }
  };

  const deleteContact = async (ct: CustomerContact) => {
    if (!confirm(`담당자 "${ct.name}"을(를) 삭제할까요?`)) return;
    try {
      await customerApi.deleteContact(ct.id);
      await refreshContacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "담당자 삭제 실패");
    }
  };

  const headerActions = useMemo(
    () => (
      <Button variant="primary" onClick={openCreate} icon={<Plus className="w-4 h-4" />}>
        고객사 등록
      </Button>
    ),
    [],
  );

  return (
    <>
      <ContentHeader
        title="고객사 관리"
        description={`총 ${total}건의 고객사`}
        actions={headerActions}
      />

      <div className="max-w-content mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-4">
        {success && <Alert variant="success" onClose={() => setSuccess(null)}>{success}</Alert>}
        {error && <Alert variant="danger" onClose={() => setError(null)}>{error}</Alert>}

        <Card>
          <CardBody>
            <div className="flex flex-wrap gap-3 items-end">
              <Input
                label="검색"
                placeholder="코드·이름"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchList()}
              />
              <Select
                label="서비스구분"
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
              >
                <option value="">전체</option>
                {SERVICE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Select
                label="상태"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">전체</option>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" onClick={fetchList}>
                조회
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : items.length === 0 ? (
              <EmptyState title="등록된 고객사가 없습니다" description="상단의 등록 버튼으로 추가하세요." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>코드</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>서비스구분</TableHead>
                    <TableHead>업종</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono">{c.code}</TableCell>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>
                        <Badge variant="info">{SERVICE_TYPE_LABELS[c.service_type]}</Badge>
                      </TableCell>
                      <TableCell>{c.industry ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "active" ? "success" : "default"}>
                          {CUSTOMER_STATUS_LABELS[c.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openContacts(c)}
                            icon={<Users className="w-4 h-4" />}
                          >
                            담당자
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(c)}
                            icon={<Pencil className="w-4 h-4" />}
                          >
                            수정
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(c)}
                            icon={<Trash2 className="w-4 h-4" />}
                          >
                            삭제
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
        title={editing ? "고객사 수정" : "고객사 등록"}
        size="lg"
        footer={
          <DrawerFooter
            onCancel={() => setDrawerOpen(false)}
            onConfirm={handleSubmit}
            loading={saving}
            confirmText={editing ? "수정" : "등록"}
          />
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="코드"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="ACME"
            />
            <Input
              label="이름"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="서비스구분"
              value={form.service_type}
              onChange={(e) =>
                setForm({ ...form, service_type: e.target.value as RequestServiceType })
              }
              options={SERVICE_TYPE_OPTIONS}
            />
            <Select
              label="상태"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as CustomerStatus })}
              options={STATUS_OPTIONS}
            />
          </div>
          <Input
            label="업종"
            value={form.industry}
            onChange={(e) => setForm({ ...form, industry: e.target.value })}
          />
          <Textarea
            label="비고"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </Drawer>

      <Drawer
        isOpen={!!contactCustomer}
        onClose={() => setContactCustomer(null)}
        title={`담당자 관리${contactCustomer ? ` — ${contactCustomer.name}` : ""}`}
        size="xl"
      >
        <div className="space-y-4">
          <Card>
            <CardBody>
              <div className="text-heading-sm text-content-primary mb-3">
                {contactEditing ? "담당자 수정" : "담당자 추가"}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="이름"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                />
                <Input
                  label="직책"
                  value={contactForm.role_title}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, role_title: e.target.value })
                  }
                />
                <Input
                  label="이메일"
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                />
                <Input
                  label="전화번호"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 mt-3 text-body-base text-content-primary">
                <input
                  type="checkbox"
                  checked={contactForm.is_primary}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, is_primary: e.target.checked })
                  }
                />
                대표 담당자
              </label>
              <Textarea
                label="비고"
                rows={2}
                className="mt-3"
                value={contactForm.notes}
                onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
              />
              <div className="flex gap-2 mt-3">
                <Button onClick={saveContact} loading={contactSaving}>
                  {contactEditing ? "수정" : "추가"}
                </Button>
                {contactEditing && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setContactEditing(null);
                      setContactForm(emptyContactForm);
                    }}
                  >
                    새로 입력
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>

          {contactLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : contacts.length === 0 ? (
            <EmptyState title="담당자가 없습니다" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>직책</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>전화</TableHead>
                  <TableHead>대표</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((ct) => (
                  <TableRow key={ct.id}>
                    <TableCell>{ct.name}</TableCell>
                    <TableCell>{ct.role_title ?? "-"}</TableCell>
                    <TableCell>{ct.email ?? "-"}</TableCell>
                    <TableCell>{ct.phone ?? "-"}</TableCell>
                    <TableCell>{ct.is_primary ? <Badge variant="success">대표</Badge> : "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => editContact(ct)}>
                          수정
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteContact(ct)}>
                          삭제
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </Drawer>
    </>
  );
}
