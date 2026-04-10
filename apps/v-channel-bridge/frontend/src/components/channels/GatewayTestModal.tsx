/**
 * GatewayTestModal 컴포넌트
 *
 * Gateway 테스트 메시지 전송 모달
 */

import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import type { GatewayConfig } from "../../lib/api/types";
import {
  testGateway,
  type GatewayTestResponse,
} from "../../lib/api/gateway_test";

interface GatewayTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  gateway: GatewayConfig;
}

export function GatewayTestModal({
  isOpen,
  onClose,
  gateway,
}: GatewayTestModalProps) {
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<GatewayTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Gateway의 채널 목록 (account만 추출)
  const channels = gateway.inout.map((inout) => ({
    account: inout.account,
    channel: inout.channel,
  }));

  const handleTest = async () => {
    if (!selectedChannel) {
      setError("채널을 선택해주세요.");
      return;
    }

    setTesting(true);
    setError(null);
    setResult(null);

    try {
      // selectedChannel은 이제 channel ID (예: C0APBT4G4UC)
      // 해당 channel의 account를 찾아야 함
      const selectedChannelData = channels.find(
        (ch) => ch.channel === selectedChannel,
      );
      if (!selectedChannelData) {
        setError("선택한 채널 정보를 찾을 수 없습니다.");
        setTesting(false);
        return;
      }

      const response = await testGateway(gateway.name, {
        target_channel: selectedChannelData.account,
        channel_id: selectedChannel, // 선택한 channel ID 전달
        message: customMessage || undefined,
      });

      console.log("[GatewayTestModal] API Response:", response);
      console.log("[GatewayTestModal] Platform:", response.platform);
      console.log("[GatewayTestModal] Sent To:", response.sent_to);
      console.log("[GatewayTestModal] Sent At:", response.sent_at);
      console.log("[GatewayTestModal] Sent At type:", typeof response.sent_at);

      setResult(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "테스트 메시지 전송 중 오류가 발생했습니다.",
      );
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    setSelectedChannel("");
    setCustomMessage("");
    setResult(null);
    setError(null);
    onClose();
  };

  const handleRetry = () => {
    setResult(null);
    setError(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Gateway 테스트 메시지 전송"
      size="sm"
      footer={
        result ? (
          <>
            <Button variant="secondary" onClick={handleRetry}>
              다시 테스트
            </Button>
            <Button variant="primary" onClick={handleClose}>
              닫기
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={handleClose}
              disabled={testing}
            >
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleTest}
              disabled={testing || !selectedChannel}
              loading={testing}
              icon={
                !testing && (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                )
              }
            >
              {testing ? "전송 중..." : "테스트 메시지 전송"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {/* 안내 메시지 */}
        <div className="p-3 bg-status-info-light border border-status-info-border rounded-card">
          <p className="text-body-sm text-content-primary">
            선택한 채널에 테스트 메시지를 전송합니다. 메시지는{" "}
            <code className="px-1 py-0.5 bg-surface-raised rounded text-xs font-mono">
              [VMS-TEST-]
            </code>{" "}
            접두사로 시작하므로 다른 채널로 전파되지 않습니다.
          </p>
        </div>

        {/* 채널 선택 */}
        <div>
          <label className="block text-label-md text-content-primary mb-2">
            테스트할 채널 선택
          </label>
          <select
            value={selectedChannel}
            onChange={(e) => {
              console.log(
                "[GatewayTestModal] Channel selected:",
                e.target.value,
              );
              setSelectedChannel(e.target.value);
            }}
            className="w-full px-3 py-2 border border-line rounded-input bg-white dark:bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            disabled={testing || !!result}
          >
            <option value="">채널을 선택하세요</option>
            {channels.map((ch) => {
              const platform = ch.account.split(".")[0];
              const platformLabel =
                platform === "slack"
                  ? "Slack"
                  : platform === "teams"
                    ? "Teams"
                    : platform;
              return (
                <option key={ch.channel} value={ch.channel}>
                  [{platformLabel}] {ch.account} → 채널 ID: {ch.channel}
                </option>
              );
            })}
          </select>
        </div>

        {/* 사용자 정의 메시지 (선택사항) */}
        <div>
          <label className="block text-label-md text-content-primary mb-2">
            사용자 정의 메시지 (선택사항)
          </label>
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="비워두면 기본 메시지가 전송됩니다."
            rows={3}
            className="w-full px-3 py-2 border border-line rounded-input bg-white dark:bg-surface-card text-content-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
            disabled={testing || !!result}
          />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* 테스트 결과 */}
        {result && (
          <div className="p-4 bg-status-success-light border border-status-success-border rounded-card">
            <div className="flex items-start gap-3 mb-3">
              <svg
                className="w-6 h-6 text-status-success flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-content-primary mb-2">
                  테스트 메시지 전송 완료
                </h4>
                <dl className="space-y-1 text-sm">
                  <div>
                    <dt className="text-content-secondary inline">플랫폼:</dt>{" "}
                    <dd className="text-content-primary inline capitalize">
                      {result.platform}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-content-secondary inline">
                      전송 대상:
                    </dt>{" "}
                    <dd className="text-content-primary inline font-mono text-xs">
                      {result.sent_to}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-content-secondary inline">상태:</dt>{" "}
                    <dd className="text-content-primary inline">
                      {result.delivery_status === "delivered"
                        ? "✅ 전송 완료"
                        : "📤 전송됨"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-content-secondary inline">
                      전송 시각:
                    </dt>{" "}
                    <dd className="text-content-primary inline">
                      {new Date(result.sent_at).toLocaleString("ko-KR")}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-status-success-border">
              <p className="text-xs text-content-secondary mb-1">
                전송한 메시지:
              </p>
              <p className="text-sm text-content-primary font-mono bg-surface-raised p-2 rounded">
                {result.message}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
