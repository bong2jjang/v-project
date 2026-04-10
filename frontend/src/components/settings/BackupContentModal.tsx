/**
 * BackupContentModal 컴포넌트
 *
 * 백업 파일 내용을 보여주는 모달
 */

import { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { Alert } from "../ui/Alert";
import { getBackupContent } from "../../lib/api/config";
import type { MatterbridgeConfig } from "../../lib/api/types";

interface BackupContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  backupPath: string;
  backupTimestamp: string;
}

export function BackupContentModal({
  isOpen,
  onClose,
  backupPath,
  backupTimestamp,
}: BackupContentModalProps) {
  const [content, setContent] = useState<MatterbridgeConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setContent(null);
      setError(null);
      return;
    }

    const loadContent = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getBackupContent(backupPath);
        setContent(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load backup content",
        );
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [isOpen, backupPath]);

  const formatDate = (timestamp: string) =>
    new Date(timestamp).toLocaleString();

  const formatJson = (data: any) => {
    return JSON.stringify(data, null, 2);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="백업 내용 보기"
      size="xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Backup Info */}
        <div className="bg-surface-raised rounded-card p-3">
          <p className="text-body-sm font-mono text-content-primary">
            {backupPath.split(/[\\/]/).pop()}
          </p>
          <p className="text-body-sm text-content-secondary mt-1">
            {formatDate(backupTimestamp)}
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="danger">
            <p className="text-body-sm">{error}</p>
          </Alert>
        )}

        {/* Content Display */}
        {content && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-heading-sm text-content-primary">
                설정 내용
              </h4>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const text = formatJson(content);
                  navigator.clipboard.writeText(text);
                }}
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                }
              >
                Copy
              </Button>
            </div>

            {/* JSON Content with Syntax Highlighting */}
            <div className="bg-surface-raised rounded-card border border-line overflow-hidden">
              <pre className="p-4 overflow-x-auto text-xs font-mono text-content-primary max-h-96 overflow-y-auto">
                {formatJson(content)}
              </pre>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-line rounded-card p-3">
                <p className="text-body-sm text-content-secondary">Gateways</p>
                <p className="text-heading-md text-content-primary mt-1">
                  {content.gateway?.length || 0}
                </p>
              </div>
              <div className="border border-line rounded-card p-3">
                <p className="text-body-sm text-content-secondary">
                  Slack Accounts
                </p>
                <p className="text-heading-md text-content-primary mt-1">
                  {content.slack ? Object.keys(content.slack).length : 0}
                </p>
              </div>
              <div className="border border-line rounded-card p-3">
                <p className="text-body-sm text-content-secondary">
                  Teams Accounts
                </p>
                <p className="text-heading-md text-content-primary mt-1">
                  {content.teams ? Object.keys(content.teams).length : 0}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
