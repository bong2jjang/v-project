/**
 * v-itsm 통합 채널 설정 페이지.
 *
 * Slack / Teams / Email 3채널 자격증명 및 설정 관리.
 * 시크릿 필드는 "미설정/설정됨" 상태만 보여주고, 입력 시에만 서버로 전송 (write-only).
 */

import { useEffect, useState } from "react";
import { CheckCircle2, PlayCircle, RefreshCw, XCircle } from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Skeleton,
} from "../../components/ui";
import * as api from "../../lib/api/integrations";
import type {
  IntegrationChannel,
  IntegrationSettings,
  IntegrationSettingsUpdateInput,
  IntegrationTestResult,
} from "../../lib/api/itsmTypes";

interface FormState {
  // Slack
  slack_bot_token: string;
  slack_app_token: string;
  slack_signing_secret: string;
  slack_default_channel: string;

  // Teams
  teams_tenant_id: string;
  teams_app_id: string;
  teams_app_password: string;
  teams_team_id: string;
  teams_webhook_url: string;
  teams_default_channel_id: string;

  // Email
  email_smtp_host: string;
  email_smtp_port: string;
  email_from: string;
  email_smtp_user: string;
  email_smtp_password: string;
}

const EMPTY_FORM: FormState = {
  slack_bot_token: "",
  slack_app_token: "",
  slack_signing_secret: "",
  slack_default_channel: "",
  teams_tenant_id: "",
  teams_app_id: "",
  teams_app_password: "",
  teams_team_id: "",
  teams_webhook_url: "",
  teams_default_channel_id: "",
  email_smtp_host: "",
  email_smtp_port: "",
  email_from: "",
  email_smtp_user: "",
  email_smtp_password: "",
};

function SecretBadge({ isSet }: { isSet: boolean }) {
  return isSet ? (
    <Badge variant="success">설정됨</Badge>
  ) : (
    <Badge variant="default">미설정</Badge>
  );
}

function TestResultBadge({ result }: { result: IntegrationTestResult | null }) {
  if (!result) {
    return <span className="text-xs text-muted-foreground">테스트 이력 없음</span>;
  }
  return (
    <span className="flex items-center gap-1.5 text-xs">
      {result.ok ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <XCircle className="h-4 w-4 text-red-600" />
      )}
      <span className={result.ok ? "text-green-700" : "text-red-700"}>
        {result.message}
      </span>
      <span className="text-muted-foreground">
        · {new Date(result.tested_at).toLocaleString("ko-KR")}
      </span>
    </span>
  );
}

export default function Integrations() {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<IntegrationChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  async function fetchSettings() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getIntegrationSettings();
      setSettings(res);
      setForm({
        ...EMPTY_FORM,
        slack_default_channel: res.slack_default_channel ?? "",
        teams_tenant_id: res.teams_tenant_id ?? "",
        teams_app_id: res.teams_app_id ?? "",
        teams_team_id: res.teams_team_id ?? "",
        teams_default_channel_id: res.teams_default_channel_id ?? "",
        email_smtp_host: res.email_smtp_host ?? "",
        email_smtp_port: res.email_smtp_port ? String(res.email_smtp_port) : "",
        email_from: res.email_from ?? "",
        email_smtp_user: res.email_smtp_user ?? "",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`설정 조회 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchSettings();
  }, []);

  function buildPayload(): IntegrationSettingsUpdateInput {
    const payload: IntegrationSettingsUpdateInput = {};
    // 시크릿: 빈 문자열이면 변경 없음, 값이 있으면 반영
    if (form.slack_bot_token) payload.slack_bot_token = form.slack_bot_token;
    if (form.slack_app_token) payload.slack_app_token = form.slack_app_token;
    if (form.slack_signing_secret)
      payload.slack_signing_secret = form.slack_signing_secret;
    if (form.teams_app_password)
      payload.teams_app_password = form.teams_app_password;
    if (form.teams_webhook_url)
      payload.teams_webhook_url = form.teams_webhook_url;
    if (form.email_smtp_password)
      payload.email_smtp_password = form.email_smtp_password;

    // 일반 필드: 현재 값과 비교해 변경된 것만
    if (settings) {
      if (form.slack_default_channel !== (settings.slack_default_channel ?? ""))
        payload.slack_default_channel = form.slack_default_channel || null;
      if (form.teams_tenant_id !== (settings.teams_tenant_id ?? ""))
        payload.teams_tenant_id = form.teams_tenant_id || null;
      if (form.teams_app_id !== (settings.teams_app_id ?? ""))
        payload.teams_app_id = form.teams_app_id || null;
      if (form.teams_team_id !== (settings.teams_team_id ?? ""))
        payload.teams_team_id = form.teams_team_id || null;
      if (
        form.teams_default_channel_id !== (settings.teams_default_channel_id ?? "")
      )
        payload.teams_default_channel_id = form.teams_default_channel_id || null;
      if (form.email_smtp_host !== (settings.email_smtp_host ?? ""))
        payload.email_smtp_host = form.email_smtp_host || null;
      const currentPort = settings.email_smtp_port
        ? String(settings.email_smtp_port)
        : "";
      if (form.email_smtp_port !== currentPort) {
        payload.email_smtp_port = form.email_smtp_port
          ? Number(form.email_smtp_port)
          : null;
      }
      if (form.email_from !== (settings.email_from ?? ""))
        payload.email_from = form.email_from || null;
      if (form.email_smtp_user !== (settings.email_smtp_user ?? ""))
        payload.email_smtp_user = form.email_smtp_user || null;
    }
    return payload;
  }

  async function handleSave() {
    const payload = buildPayload();
    if (Object.keys(payload).length === 0) {
      setError("변경된 항목이 없습니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateIntegrationSettings(payload);
      setSettings(updated);
      setForm((f) => ({
        ...f,
        slack_bot_token: "",
        slack_app_token: "",
        slack_signing_secret: "",
        teams_app_password: "",
        teams_webhook_url: "",
        email_smtp_password: "",
      }));
      setSuccess("통합 설정이 저장되었습니다.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`저장 실패: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(channel: IntegrationChannel) {
    setTesting(channel);
    setError(null);
    try {
      const result = await api.testIntegration(channel);
      if (result.ok) {
        setSuccess(`${channel} 테스트 성공: ${result.message}`);
      } else {
        setError(`${channel} 테스트 실패: ${result.message}`);
      }
      await fetchSettings();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`${channel} 테스트 오류: ${msg}`);
    } finally {
      setTesting(null);
    }
  }

  if (loading && !settings) {
    return (
      <>
        <ContentHeader title="통합 채널 설정" description="Slack / Teams / Email" />
        <div className="max-w-content mx-auto px-3 sm:px-6 lg:px-8 py-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <ContentHeader
        title="통합 채널 설정"
        description="Slack / Teams / Email 자격증명 (시크릿은 write-only)"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void fetchSettings()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              새로고침
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
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

        {/* Slack */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Slack</h3>
              <div className="flex items-center gap-3">
                <TestResultBadge result={settings?.slack_last_test ?? null} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleTest("slack")}
                  disabled={testing !== null}
                >
                  <PlayCircle className="h-4 w-4 mr-1" />
                  {testing === "slack" ? "테스트 중..." : "연결 테스트"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">Bot Token</label>
                  <SecretBadge isSet={settings?.slack_bot_token_set ?? false} />
                </div>
                <Input
                  type="password"
                  placeholder="xoxb-... (입력 시에만 업데이트)"
                  value={form.slack_bot_token}
                  onChange={(e) =>
                    setForm({ ...form, slack_bot_token: e.target.value })
                  }
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">App Token</label>
                  <SecretBadge isSet={settings?.slack_app_token_set ?? false} />
                </div>
                <Input
                  type="password"
                  placeholder="xapp-..."
                  value={form.slack_app_token}
                  onChange={(e) =>
                    setForm({ ...form, slack_app_token: e.target.value })
                  }
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">Signing Secret</label>
                  <SecretBadge
                    isSet={settings?.slack_signing_secret_set ?? false}
                  />
                </div>
                <Input
                  type="password"
                  value={form.slack_signing_secret}
                  onChange={(e) =>
                    setForm({ ...form, slack_signing_secret: e.target.value })
                  }
                />
              </div>
              <Input
                label="기본 채널"
                placeholder="#itsm-alerts"
                value={form.slack_default_channel}
                onChange={(e) =>
                  setForm({ ...form, slack_default_channel: e.target.value })
                }
              />
            </div>
          </CardBody>
        </Card>

        {/* Teams */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Microsoft Teams</h3>
              <div className="flex items-center gap-3">
                <TestResultBadge result={settings?.teams_last_test ?? null} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleTest("teams")}
                  disabled={testing !== null}
                >
                  <PlayCircle className="h-4 w-4 mr-1" />
                  {testing === "teams" ? "테스트 중..." : "연결 테스트"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Tenant ID"
                value={form.teams_tenant_id}
                onChange={(e) =>
                  setForm({ ...form, teams_tenant_id: e.target.value })
                }
              />
              <Input
                label="App ID"
                value={form.teams_app_id}
                onChange={(e) =>
                  setForm({ ...form, teams_app_id: e.target.value })
                }
              />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">App Password</label>
                  <SecretBadge
                    isSet={settings?.teams_app_password_set ?? false}
                  />
                </div>
                <Input
                  type="password"
                  value={form.teams_app_password}
                  onChange={(e) =>
                    setForm({ ...form, teams_app_password: e.target.value })
                  }
                />
              </div>
              <Input
                label="Team ID"
                value={form.teams_team_id}
                onChange={(e) =>
                  setForm({ ...form, teams_team_id: e.target.value })
                }
              />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">
                    Webhook URL (fallback)
                  </label>
                  <SecretBadge isSet={settings?.teams_webhook_url_set ?? false} />
                </div>
                <Input
                  type="password"
                  placeholder="Power Automate 등"
                  value={form.teams_webhook_url}
                  onChange={(e) =>
                    setForm({ ...form, teams_webhook_url: e.target.value })
                  }
                />
              </div>
              <Input
                label="기본 채널 ID"
                value={form.teams_default_channel_id}
                onChange={(e) =>
                  setForm({ ...form, teams_default_channel_id: e.target.value })
                }
              />
            </div>
          </CardBody>
        </Card>

        {/* Email */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Email (SMTP)</h3>
              <div className="flex items-center gap-3">
                <TestResultBadge result={settings?.email_last_test ?? null} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleTest("email")}
                  disabled={testing !== null}
                >
                  <PlayCircle className="h-4 w-4 mr-1" />
                  {testing === "email" ? "테스트 중..." : "연결 테스트"}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="SMTP Host"
                placeholder="smtp.example.com"
                value={form.email_smtp_host}
                onChange={(e) =>
                  setForm({ ...form, email_smtp_host: e.target.value })
                }
              />
              <Input
                label="SMTP Port"
                type="number"
                placeholder="587"
                value={form.email_smtp_port}
                onChange={(e) =>
                  setForm({ ...form, email_smtp_port: e.target.value })
                }
              />
              <Input
                label="From Address"
                placeholder="noreply@vms-solutions.com"
                value={form.email_from}
                onChange={(e) => setForm({ ...form, email_from: e.target.value })}
              />
              <Input
                label="SMTP User"
                value={form.email_smtp_user}
                onChange={(e) =>
                  setForm({ ...form, email_smtp_user: e.target.value })
                }
              />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium">SMTP Password</label>
                  <SecretBadge
                    isSet={settings?.email_smtp_password_set ?? false}
                  />
                </div>
                <Input
                  type="password"
                  value={form.email_smtp_password}
                  onChange={(e) =>
                    setForm({ ...form, email_smtp_password: e.target.value })
                  }
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {settings?.updated_at && (
          <p className="text-xs text-muted-foreground">
            최근 수정: {new Date(settings.updated_at).toLocaleString("ko-KR")} (user
            #{settings.updated_by ?? "-"})
          </p>
        )}
      </div>
    </>
  );
}
