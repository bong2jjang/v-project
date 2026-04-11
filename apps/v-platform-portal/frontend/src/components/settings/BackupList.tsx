/**
 * BackupList 컴포넌트
 *
 * 백업 목록 표시 및 관리
 */

import { useState } from "react";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Alert } from "../ui/Alert";
import { InfoBox } from "../ui/InfoBox";
import { EmptyState } from "../ui/EmptyState";
import { Modal, ModalFooter } from "../ui/Modal";
import { BackupContentModal } from "./BackupContentModal";
import { deleteBackup } from "../../lib/api/config";
import type { BackupInfo } from "../../lib/api/types";

interface BackupListProps {
  backups: BackupInfo[];
  onRestore: (backupPath: string) => Promise<void>;
  onCreateBackup: () => Promise<void>;
  onBackupDeleted: () => void;
  isLoading: boolean;
}

export function BackupList({
  backups,
  onRestore,
  onCreateBackup,
  onBackupDeleted,
  isLoading,
}: BackupListProps) {
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BackupInfo | null>(null);
  const [viewingBackup, setViewingBackup] = useState<BackupInfo | null>(null);
  const [deletingBackup, setDeletingBackup] = useState<BackupInfo | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleRestore = async (backup: BackupInfo) => {
    setRestoring(backup.path);
    try {
      await onRestore(backup.path);
      setConfirmRestore(null);
    } catch {
      // Error handled by parent
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (backup: BackupInfo) => {
    setDeleteError(null);
    try {
      await deleteBackup(backup.path);
      setDeletingBackup(null);
      onBackupDeleted();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete backup",
      );
    }
  };

  const formatDate = (timestamp: string) =>
    new Date(timestamp).toLocaleString();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-heading-md text-content-primary">설정 백업</h3>
          <p className="text-body-base text-content-secondary mt-1">
            설정 백업을 관리하고 이전 버전으로 복원할 수 있습니다
          </p>
        </div>
        <Button
          variant="primary"
          onClick={onCreateBackup}
          loading={isLoading}
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
          백업 생성
        </Button>
      </div>

      {/* Backup List */}
      {backups.length === 0 ? (
        <div className="bg-surface-raised rounded-card border-2 border-dashed border-line-heavy py-4">
          <EmptyState
            icon={
              <svg
                className="w-12 h-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
            }
            title="백업이 없습니다"
            description="첫 번째 백업을 생성하여 시작하세요"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {backups.map((backup, index) => (
            <div
              key={index}
              className="border border-line rounded-card p-4 hover:bg-surface-raised transition-colors duration-normal"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-8 w-8 text-brand-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-base font-medium text-content-primary text-truncate">
                      {backup.path.split(/[\\/]/).pop()}
                    </p>
                    <p className="text-body-sm text-content-secondary">
                      {formatDate(backup.timestamp)}
                    </p>
                  </div>
                  <Badge variant="info">
                    {index === 0 ? "최신" : `#${backups.length - index}`}
                  </Badge>
                </div>

                <div className="ml-4 flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setViewingBackup(backup)}
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    }
                  >
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setConfirmRestore(backup)}
                    loading={restoring === backup.path}
                    disabled={restoring !== null}
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
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    }
                  >
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setDeletingBackup(backup)}
                    disabled={restoring !== null}
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Backup Content Viewer */}
      {viewingBackup && (
        <BackupContentModal
          isOpen={true}
          onClose={() => setViewingBackup(null)}
          backupPath={viewingBackup.path}
          backupTimestamp={viewingBackup.timestamp}
        />
      )}

      {/* Restore Confirmation */}
      {confirmRestore && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmRestore(null)}
          title="설정 복원"
          size="sm"
          footer={
            <ModalFooter
              onCancel={() => setConfirmRestore(null)}
              onConfirm={() => handleRestore(confirmRestore)}
              cancelText="취소"
              confirmText="복원"
              confirmVariant="primary"
              loading={restoring === confirmRestore.path}
            />
          }
        >
          <div className="space-y-4">
            <p className="text-body-base text-content-secondary">
              이 백업으로 설정을 복원하시겠습니까?
            </p>
            <div className="bg-surface-raised rounded-card p-3">
              <p className="text-body-sm font-mono text-content-primary">
                {confirmRestore.path.split(/[\\/]/).pop()}
              </p>
              <p className="text-body-sm text-content-secondary mt-1">
                {formatDate(confirmRestore.timestamp)}
              </p>
            </div>
            <Alert variant="warning">
              <p className="text-body-sm">
                현재 설정이 이 백업으로 대체됩니다. 먼저 현재 설정의 백업을
                생성하는 것을 권장합니다.
              </p>
            </Alert>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      {deletingBackup && (
        <Modal
          isOpen={true}
          onClose={() => {
            setDeletingBackup(null);
            setDeleteError(null);
          }}
          title="백업 삭제"
          size="sm"
          footer={
            <ModalFooter
              onCancel={() => {
                setDeletingBackup(null);
                setDeleteError(null);
              }}
              onConfirm={() => handleDelete(deletingBackup)}
              cancelText="취소"
              confirmText="삭제"
              confirmVariant="danger"
            />
          }
        >
          <div className="space-y-4">
            <p className="text-body-base text-content-secondary">
              이 백업 파일을 삭제하시겠습니까?
            </p>
            <div className="bg-surface-raised rounded-card p-3">
              <p className="text-body-sm font-mono text-content-primary">
                {deletingBackup.path.split(/[\\/]/).pop()}
              </p>
              <p className="text-body-sm text-content-secondary mt-1">
                {formatDate(deletingBackup.timestamp)}
              </p>
            </div>
            {deleteError && (
              <Alert variant="danger">
                <p className="text-body-sm">{deleteError}</p>
              </Alert>
            )}
            <Alert variant="warning">
              <p className="text-body-sm">
                이 작업은 되돌릴 수 없습니다. 백업 파일이 영구적으로 삭제됩니다.
              </p>
            </Alert>
          </div>
        </Modal>
      )}

      {/* Info */}
      <InfoBox variant="tip" title="백업 안내">
        <ul className="list-disc list-inside space-y-1 text-body-sm">
          <li>설정 업데이트 시 자동으로 백업이 생성됩니다</li>
          <li>언제든지 수동으로 백업을 생성할 수 있습니다</li>
          <li>백업에는 일반 설정, 계정, Route 정보가 모두 포함됩니다</li>
          <li>복원 시 백업 설정으로 v-channel-bridge가 재시작됩니다</li>
        </ul>
      </InfoBox>
    </div>
  );
}
