/**
 * v-itsm 티켓 접수(Intake) 페이지.
 *
 * v0.2 확장: service_type / customer / product / contract 필드 포함.
 * 계약은 선택한 고객사 + 제품과 자동 연결되는 옵션을 제공한다.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ContentHeader } from "../../components/Layout";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Input,
  Select,
  Textarea,
} from "../../components/ui";
import * as ticketApi from "../../lib/api/tickets";
import * as customerApi from "../../lib/api/customers";
import * as productApi from "../../lib/api/products";
import * as contractApi from "../../lib/api/contracts";
import type {
  ChannelSource,
  Contract,
  Customer,
  Priority,
  Product,
  RequestServiceType,
  TicketIntakeInput,
} from "../../lib/api/itsmTypes";
import {
  CHANNEL_SOURCE_LABELS,
  PRIORITY_LABELS,
  SERVICE_TYPE_LABELS,
} from "../../lib/api/itsmTypes";

const SERVICE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "internal", label: SERVICE_TYPE_LABELS.internal },
  { value: "on_premise", label: SERVICE_TYPE_LABELS.on_premise },
  { value: "saas", label: SERVICE_TYPE_LABELS.saas },
  { value: "partner", label: SERVICE_TYPE_LABELS.partner },
];

const PRIORITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "critical", label: PRIORITY_LABELS.critical },
  { value: "high", label: PRIORITY_LABELS.high },
  { value: "normal", label: PRIORITY_LABELS.normal },
  { value: "low", label: PRIORITY_LABELS.low },
];

const CHANNEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "web", label: CHANNEL_SOURCE_LABELS.web },
  { value: "email", label: CHANNEL_SOURCE_LABELS.email },
  { value: "slack", label: CHANNEL_SOURCE_LABELS.slack },
  { value: "teams", label: CHANNEL_SOURCE_LABELS.teams },
  { value: "phone", label: CHANNEL_SOURCE_LABELS.phone },
];

interface IntakeForm {
  title: string;
  description: string;
  source_channel: ChannelSource;
  source_ref: string;
  priority: Priority;
  category_l1: string;
  category_l2: string;
  service_type: RequestServiceType;
  customer_id: string;
  product_id: string;
  contract_id: string;
}

const EMPTY_FORM: IntakeForm = {
  title: "",
  description: "",
  source_channel: "web",
  source_ref: "",
  priority: "normal",
  category_l1: "",
  category_l2: "",
  service_type: "internal",
  customer_id: "",
  product_id: "",
  contract_id: "",
};

export default function TicketNew() {
  const navigate = useNavigate();
  const [form, setForm] = useState<IntakeForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [cs, ps, cts] = await Promise.all([
          customerApi.listCustomers({ page_size: 100, status: "active" }),
          productApi.listProducts({ page_size: 100, active: true }),
          contractApi.listContracts({ page_size: 100, status: "active" }),
        ]);
        setCustomers(cs.items);
        setProducts(ps.items);
        setContracts(cts.items);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`참조 데이터 로딩 실패: ${msg}`);
      }
    })();
  }, []);

  const filteredContracts = useMemo(() => {
    return contracts.filter((c) => {
      if (form.customer_id && c.customer_id !== form.customer_id) return false;
      if (form.product_id && !c.product_ids.includes(form.product_id))
        return false;
      return true;
    });
  }, [contracts, form.customer_id, form.product_id]);

  const customerOptions = useMemo(
    () => [
      { value: "", label: "(선택)" },
      ...customers.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` })),
    ],
    [customers],
  );

  const productOptions = useMemo(
    () => [
      { value: "", label: "(선택)" },
      ...products.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` })),
    ],
    [products],
  );

  const contractOptions = useMemo(
    () => [
      { value: "", label: "(선택)" },
      ...filteredContracts.map((c) => ({
        value: c.id,
        label: `${c.contract_no} · ${c.name}`,
      })),
    ],
    [filteredContracts],
  );

  const isInternal = form.service_type === "internal";

  async function handleSubmit() {
    setError(null);
    if (!form.title.trim()) {
      setError("제목은 필수입니다.");
      return;
    }
    if (!isInternal && (!form.customer_id || !form.product_id)) {
      setError("내부요청이 아닌 경우 고객사와 제품은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const payload: TicketIntakeInput = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        source_channel: form.source_channel,
        source_ref: form.source_ref.trim() || null,
        priority: form.priority,
        category_l1: form.category_l1.trim() || null,
        category_l2: form.category_l2.trim() || null,
        service_type: form.service_type,
        customer_id: form.customer_id || null,
        product_id: form.product_id || null,
        contract_id: form.contract_id || null,
      };
      const ticket = await ticketApi.intakeTicket(payload);
      navigate(`/tickets/${ticket.id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`접수 실패: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ContentHeader
        title="티켓 접수"
        description="신규 요청을 접수하고 Loop 처리를 시작합니다."
        actions={
          <Button variant="secondary" onClick={() => navigate("/tickets")}>
            목록
          </Button>
        }
      />

      <div className="max-w-content mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-4">
        {error && (
          <Alert variant="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card>
          <CardBody>
            <div className="space-y-4">
              <Input
                label="제목 *"
                placeholder="예: 포탈 로그인 전면 장애"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <Textarea
                label="설명"
                rows={5}
                placeholder="증상, 재현 방법, 영향 범위 등"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="우선순위 *"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priority: e.target.value as Priority,
                    })
                  }
                  options={PRIORITY_OPTIONS}
                />
                <Select
                  label="접수 채널 *"
                  value={form.source_channel}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      source_channel: e.target.value as ChannelSource,
                    })
                  }
                  options={CHANNEL_OPTIONS}
                />
                <Input
                  label="채널 참조"
                  placeholder="Slack 메시지 URL / 이메일 Message-ID"
                  value={form.source_ref}
                  onChange={(e) =>
                    setForm({ ...form, source_ref: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="카테고리 L1"
                  placeholder="예: 인증/계정"
                  value={form.category_l1}
                  onChange={(e) =>
                    setForm({ ...form, category_l1: e.target.value })
                  }
                />
                <Input
                  label="카테고리 L2"
                  placeholder="예: SSO 로그인 실패"
                  value={form.category_l2}
                  onChange={(e) =>
                    setForm({ ...form, category_l2: e.target.value })
                  }
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-3">
              <h3 className="text-lg font-semibold">서비스 구분 및 고객/제품</h3>
              <p className="text-sm text-muted-foreground">
                내부요청이 아니라면 고객사·제품을 지정해야 합니다. 계약이
                선택되면 해당 SLA 티어의 우선순위 매트릭스로 타이머가 생성됩니다.
              </p>
            </div>
            <div className="space-y-4">
              <Select
                label="서비스 구분 *"
                value={form.service_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    service_type: e.target.value as RequestServiceType,
                  })
                }
                options={SERVICE_TYPE_OPTIONS}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label={`고객사${isInternal ? "" : " *"}`}
                  value={form.customer_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customer_id: e.target.value,
                      contract_id: "",
                    })
                  }
                  options={customerOptions}
                  helperText={isInternal ? "내부요청이면 선택 사항" : undefined}
                />
                <Select
                  label={`제품${isInternal ? "" : " *"}`}
                  value={form.product_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      product_id: e.target.value,
                      contract_id: "",
                    })
                  }
                  options={productOptions}
                  helperText={isInternal ? "내부요청이면 선택 사항" : undefined}
                />
              </div>

              <Select
                label="계약"
                value={form.contract_id}
                onChange={(e) =>
                  setForm({ ...form, contract_id: e.target.value })
                }
                options={contractOptions}
                helperText={
                  form.customer_id || form.product_id
                    ? "선택한 고객·제품과 연결된 활성 계약만 표시"
                    : "고객사/제품을 먼저 선택하면 연결된 계약이 필터됩니다"
                }
              />
            </div>
          </CardBody>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate("/tickets")}>
            취소
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleSubmit()}
            loading={saving}
          >
            접수
          </Button>
        </div>
      </div>
    </>
  );
}
