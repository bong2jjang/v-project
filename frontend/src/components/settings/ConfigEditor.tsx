/**
 * ConfigEditor 컴포넌트
 *
 * Raw Config 편집 및 검증
 */

import { useState, useEffect } from "react";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Textarea";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { InfoBox } from "../ui/InfoBox";
import type { BridgeConfig, ValidationResult } from "../../lib/api/types";

interface ConfigEditorProps {
  config: BridgeConfig;
  onSave: (config: BridgeConfig) => Promise<void>;
  onValidate: (config: BridgeConfig) => Promise<ValidationResult>;
  isLoading: boolean;
}

export function ConfigEditor({
  config,
  onSave,
  onValidate,
  isLoading,
}: ConfigEditorProps) {
  const [configText, setConfigText] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfigText(JSON.stringify(config, null, 2));
    setHasChanges(false);
    setParseError(null);
    setValidation(null);
  }, [config]);

  const handleTextChange = (value: string) => {
    setConfigText(value);
    setHasChanges(true);
    setParseError(null);
    setValidation(null);
  };

  const handleValidate = async () => {
    setValidating(true);
    setParseError(null);
    setValidation(null);

    try {
      const parsed = JSON.parse(configText);
      const result = await onValidate(parsed);
      setValidation(result);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setParseError(`JSON 파싱 오류: ${error.message}`);
      } else {
        setParseError("검증에 실패했습니다");
      }
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setParseError(null);

    try {
      const parsed = JSON.parse(configText);
      const result = await onValidate(parsed);
      if (!result.valid) {
        setValidation(result);
        setSaving(false);
        return;
      }

      await onSave(parsed);
      setHasChanges(false);
      setValidation(null);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setParseError(`JSON 파싱 오류: ${error.message}`);
      } else {
        setParseError("저장에 실패했습니다");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfigText(JSON.stringify(config, null, 2));
    setHasChanges(false);
    setParseError(null);
    setValidation(null);
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(configText);
      setConfigText(JSON.stringify(parsed, null, 2));
      setParseError(null);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setParseError(`JSON 파싱 오류: ${error.message}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-heading-md text-content-primary">설정 편집</h3>
        <p className="text-body-base text-content-secondary mt-1">
          JSON 형식으로 설정을 편집합니다. 잘못된 설정은 v-channel-bridge 오류를
          유발할 수 있으니 주의하세요.
        </p>
      </div>

      {/* Parse Error */}
      {parseError && (
        <Alert variant="danger" onClose={() => setParseError(null)}>
          {parseError}
        </Alert>
      )}

      {/* Validation Result */}
      {validation && (
        <div
          className={`border rounded-card p-4 ${
            validation.valid
              ? "bg-status-success-light border-status-success-border"
              : "bg-status-danger-light border-status-danger-border"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {validation.valid ? (
              <>
                <svg
                  className="w-5 h-5 text-status-success"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-heading-sm text-status-success">
                  설정이 유효합니다
                </p>
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5 text-status-danger"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-heading-sm text-status-danger">
                  설정에 오류가 있습니다
                </p>
              </>
            )}
          </div>

          {validation.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-heading-sm text-status-danger mb-1">오류:</p>
              <ul className="list-disc list-inside space-y-1">
                {validation.errors.map((error, idx) => (
                  <li key={idx} className="text-body-sm text-status-danger">
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="mt-2">
              <p className="text-heading-sm text-status-warning mb-1">경고:</p>
              <ul className="list-disc list-inside space-y-1">
                {validation.warnings.map((warning, idx) => (
                  <li key={idx} className="text-body-sm text-status-warning">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      <div className="relative">
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
          {hasChanges && <Badge variant="warning">수정됨</Badge>}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleFormat}
            icon={
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16m-7 6h7"
                />
              </svg>
            }
          >
            Format
          </Button>
        </div>
        <Textarea
          value={configText}
          onChange={(e) => handleTextChange(e.target.value)}
          rows={20}
          className="font-mono text-xs"
          placeholder="JSON 형식의 설정..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!hasChanges || validating || isLoading}
            icon={
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
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
            }
          >
            Save
          </Button>
          <Button
            variant="secondary"
            onClick={handleValidate}
            loading={validating}
            disabled={!hasChanges || saving || isLoading}
            icon={
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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          >
            Validate
          </Button>
          <Button
            variant="ghost"
            onClick={handleReset}
            disabled={!hasChanges || saving || validating}
          >
            Reset
          </Button>
        </div>

        <div className="text-body-sm text-content-tertiary">
          {configText.split("\n").length}줄, {configText.length}자
        </div>
      </div>

      {/* Warning */}
      <InfoBox variant="warning" title="고급 사용자 전용">
        <p className="text-body-sm">
          Raw 설정 편집은 JSON 형식과 v-channel-bridge 설정 구조에 대한 이해가
          필요합니다. 잘못된 설정은 v-channel-bridge 오류를 유발할 수 있습니다. 변경
          전 반드시 백업을 생성하세요.
        </p>
      </InfoBox>

      {/* Format Info */}
      <div className="bg-surface-raised border border-line rounded-card p-4">
        <h4 className="text-heading-sm text-content-primary mb-2">설정 구조</h4>
        <div className="text-body-sm font-mono text-content-secondary space-y-1">
          <p>{"{"}</p>
          <p className="ml-4">
            "general": {"{"} "MediaServerUpload": "...", ... {"}"},
          </p>
          <p className="ml-4">
            "slack": {"{"} "계정이름": {"{"} "Token": "...", ... {"}"} {"}"},
          </p>
          <p className="ml-4">
            "teams": {"{"} "계정이름": {"{"} "TenantID": "...", ... {"}"} {"}"},
          </p>
          <p className="ml-4">
            "gateway": [{"{"} "name": "...", "inout": [...] {"}"}]
          </p>
          <p>{"}"}</p>
        </div>
      </div>
    </div>
  );
}
