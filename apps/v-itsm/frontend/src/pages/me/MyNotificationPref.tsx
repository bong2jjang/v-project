/**
 * v-itsm 사용자 개인 알림 설정 페이지.
 *
 * Slack/Teams 사용자 매핑, 이메일/Teams 채널 오버라이드, 채널·이벤트별 수신 여부,
 * 수신 전역 on/off, 방해금지 시간대(JSON) 설정.
 */

import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { ContentHeader } from "../../components/Layout";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Input,
  Select,
  Skeleton,
  Textarea,
} from "../../components/ui";
import * as api from "../../lib/api/meNotificationPref";
import type {
  UserNotificationPref,
  UserNotificationPrefUpdateInput,
} from "../../lib/api/itsmTypes";

const ALL_CHANNELS = ["slack", "teams", "email"] as const;
type ChannelCode = (typeof ALL_CHANNELS)[number];

interface FormState {
  slack_user_id: string;
  teams_user_id: string;
  teams_channel_override: string;
  email_override: string;
  channels_mode: "default" | "custom";
  channel_slack: boolean;
  channel_teams: boolean;
  channel_email: boolean;
  event_overrides_json: string;
  enabled: boolean;
  quiet_hours_json: string;
}

const ENABLED_OPTIONS = [
  { value: "true", label: "활성 (알림 수신)" },
  { value: "false", label: "비활성 (모든 알림 차단)" },
];

const CHANNELS_MODE_OPTIONS = [
  { value: "default", label: "기본값 사용 (정책에 따름)" },
  { value: "custom", label: "직접 선택" },
];

function toFormState(pref: UserNotificationPref): FormState {
  const channelsMode: FormState["channels_mode"] = pref.channels ? "custom" : "default";
  const chset = new Set(pref.channels ?? []);
  return {
    slack_user_id: pref.slack_user_id ?? "",
    teams_user_id: pref.teams_user_id ?? "",
    teams_channel_override: pref.teams_channel_override ?? "",
    email_override: pref.email_override ?? "",
    channels_mode: channelsMode,
    channel_slack: chset.has("slack"),
    channel_teams: chset.has("teams"),
    channel_email: chset.has("email"),
    event_overrides_json: pref.event_overrides
      ? JSON.stringify(pref.event_overrides, null, 2)
      : "",
    enabled: pref.enabled,
    quiet_hours_json: pref.quiet_hours
      ? JSON.stringify(pref.quiet_hours, null, 2)
      : "",
  };
}

function parseOptionalJson(
  text: string,
): { ok: true; value: Record<string, unknown> | null } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: null };
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: "객체 형태의 JSON 이어야 합니다." };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `JSON 파싱 실패: ${msg}` };
  }
}

export default function MyNotificationPref() {
  const [pref, setPref] = useState<UserNotificationPref | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function fetchPref() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getMyNotificationPref();
      setPref(res);
      setForm(toFormState(res));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`알림 설정 조회 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchPref();
  }, []);

  async function handleSave() {
    if (!form) return;

    const eventOverrides = parseOptionalJson(form.event_overrides_json);
    if (!eventOverrides.ok) {
      setError(`이벤트별 수신 설정: ${eventOverrides.error}`);
      return;
    }
    const quietHours = parseOptionalJson(form.quiet_hours_json);
    if (!quietHours.ok) {
      setError(`방해금지 시간대: ${quietHours.error}`);
      return;
    }

    let channels: string[] | null = null;
    if (form.channels_mode === "custom") {
      const picked: ChannelCode[] = [];
      if (form.channel_slack) picked.push("slack");
      if (form.channel_teams) picked.push("teams");
      if (form.channel_email) picked.push("email");
      channels = picked;
    }

    const payload: UserNotificationPrefUpdateInput = {
      slack_user_id: form.slack_user_id.trim() || null,
      teams_user_id: form.teams_user_id.trim() || null,
      teams_channel_override: form.teams_channel_override.trim() || null,
      email_override: form.email_override.trim() || null,
      channels,
      event_overrides: eventOverrides.value,
      enabled: form.enabled,
      quiet_hours: quietHours.value,
    };

    setSaving(true);
    setError(null);
    try {
      const res = await api.updateMyNotificationPref(payload);
      setPref(res);
      setForm(toFormState(res));
      setSuccess("알림 설정이 저장되었습니다.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`저장 실패: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ContentHeader
        title="내 알림 설정"
        description="Slack/Teams 사용자 매핑, 채널 오버라이드, 수신 여부를 직접 관리합니다."
        actions={
          <Button variant="secondary" onClick={() => void fetchPref()}>
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

        {loading || !form ? (
          <Card>
            <CardBody>
              <Skeleton className="h-64 w-full" />
            </CardBody>
          </Card>
        ) : (
          <>
            <Card>
              <CardBody>
                <h3 className="text-heading-sm mb-3">외부 계정 매핑</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Input
                    label="Slack 사용자 ID"
                    placeholder="U12345678"
                    value={form.slack_user_id}
                    onChange={(e) =>
                      setForm({ ...form, slack_user_id: e.target.value })
                    }
                    helperText="Slack 워크스페이스의 user_id (U… 로 시작)"
                  />
                  <Input
                    label="Teams 사용자 ID (AAD Object ID)"
                    placeholder="xxxxxxxx-xxxx-..."
                    value={form.teams_user_id}
                    onChange={(e) =>
                      setForm({ ...form, teams_user_id: e.target.value })
                    }
                    helperText="Microsoft Entra ID 의 Object ID"
                  />
                  <Input
                    label="Teams 채널 오버라이드"
                    placeholder="19:xxxxxx@thread.tacv2"
                    value={form.teams_channel_override}
                    onChange={(e) =>
                      setForm({ ...form, teams_channel_override: e.target.value })
                    }
                    helperText="개인 알림 대신 특정 채널로 전달"
                  />
                  <Input
                    label="이메일 오버라이드"
                    type="email"
                    placeholder="me@example.com"
                    value={form.email_override}
                    onChange={(e) =>
                      setForm({ ...form, email_override: e.target.value })
                    }
                    helperText="비우면 계정 이메일 사용"
                  />
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="text-heading-sm mb-3">수신 채널</h3>
                <Select
                  label="채널 선택 방식"
                  value={form.channels_mode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      channels_mode: e.target.value as FormState["channels_mode"],
                    })
                  }
                  options={CHANNELS_MODE_OPTIONS}
                />
                {form.channels_mode === "custom" && (
                  <div className="flex flex-wrap gap-4 mt-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.channel_slack}
                        onChange={(e) =>
                          setForm({ ...form, channel_slack: e.target.checked })
                        }
                      />
                      Slack
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.channel_teams}
                        onChange={(e) =>
                          setForm({ ...form, channel_teams: e.target.checked })
                        }
                      />
                      Teams
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.channel_email}
                        onChange={(e) =>
                          setForm({ ...form, channel_email: e.target.checked })
                        }
                      />
                      Email
                    </label>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="text-heading-sm mb-3">수신 여부 & 고급 설정</h3>
                <div className="space-y-3">
                  <Select
                    label="전역 수신 여부"
                    value={form.enabled ? "true" : "false"}
                    onChange={(e) =>
                      setForm({ ...form, enabled: e.target.value === "true" })
                    }
                    options={ENABLED_OPTIONS}
                    helperText="비활성화 시 모든 이벤트 알림을 받지 않습니다."
                  />
                  <Textarea
                    label="이벤트별 수신 오버라이드 (JSON, 선택)"
                    rows={5}
                    placeholder='{"sla_warning": false, "loop_transition": true}'
                    value={form.event_overrides_json}
                    onChange={(e) =>
                      setForm({ ...form, event_overrides_json: e.target.value })
                    }
                    helperText="이벤트 이름별 boolean. 비우면 기본값."
                  />
                  <Textarea
                    label="방해금지 시간대 (JSON, 선택)"
                    rows={5}
                    placeholder='{"timezone":"Asia/Seoul","weekday":[{"start":"22:00","end":"08:00"}]}'
                    value={form.quiet_hours_json}
                    onChange={(e) =>
                      setForm({ ...form, quiet_hours_json: e.target.value })
                    }
                    helperText="설정된 시간대의 알림은 대기 큐에 쌓입니다."
                  />
                </div>
              </CardBody>
            </Card>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              {pref && (
                <div>
                  최종 업데이트: {new Date(pref.updated_at).toLocaleString("ko-KR")}
                </div>
              )}
              <Button
                variant="primary"
                onClick={() => void handleSave()}
                loading={saving}
              >
                <Save className="h-4 w-4 mr-1" />
                저장
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
