/**
 * Configuration Management API
 *
 * matterbridge.toml 설정 파일 관리 API 메서드
 */

import { apiClient, get, post, put } from "./client";
import type {
  BackupListResponse,
  MatterbridgeConfig,
  MessageResponse,
  RestoreRequest,
  ValidationResult,
} from "./types";

/**
 * 현재 설정 조회
 */
export async function getConfig(): Promise<MatterbridgeConfig> {
  return get<MatterbridgeConfig>("/api/config/");
}

/**
 * 설정 업데이트
 *
 * @param config - 새로운 설정
 * @param createBackup - 백업 생성 여부 (기본값: true)
 * @returns 업데이트 결과 (백업 경로 포함)
 */
export async function updateConfig(
  config: MatterbridgeConfig,
  createBackup: boolean = true,
): Promise<MessageResponse> {
  return put<MessageResponse>("/api/config/", config, {
    params: { create_backup: createBackup },
  });
}

/**
 * 설정 검증
 *
 * @param config - 검증할 설정 (null이면 현재 파일 검증)
 * @returns 검증 결과
 */
export async function validateConfig(
  config: MatterbridgeConfig | null = null,
): Promise<ValidationResult> {
  return post<ValidationResult>("/api/config/validate", config);
}

/**
 * 백업 생성
 *
 * @returns 백업 파일 경로
 */
export async function createBackup(): Promise<MessageResponse> {
  return post<MessageResponse>("/api/config/backup");
}

/**
 * 백업 목록 조회
 *
 * @returns 백업 파일 목록
 */
export async function listBackups(): Promise<BackupListResponse> {
  return get<BackupListResponse>("/api/config/backups");
}

/**
 * 설정 복원
 *
 * @param backupPath - 복원할 백업 파일 경로
 * @returns 복원 결과
 */
export async function restoreConfig(
  backupPath: string,
): Promise<MessageResponse> {
  const request: RestoreRequest = { backup_path: backupPath };
  return post<MessageResponse>("/api/config/restore", request);
}

/**
 * 설정을 Pydantic 모델로 조회
 *
 * @returns 타입 안전한 설정 모델
 */
export async function getConfigModel(): Promise<MatterbridgeConfig> {
  return get<MatterbridgeConfig>("/api/config/model");
}

/**
 * 백업 파일 내용 조회
 *
 * @param backupPath - 백업 파일 경로
 * @returns 백업 파일의 TOML 내용 (파싱된 딕셔너리)
 */
export async function getBackupContent(
  backupPath: string,
): Promise<MatterbridgeConfig> {
  return get<MatterbridgeConfig>("/api/config/backups/content", {
    params: { backup_path: backupPath },
  });
}

/**
 * 백업 파일 삭제
 *
 * @param backupPath - 삭제할 백업 파일 경로
 * @returns 삭제 결과
 */
export async function deleteBackup(
  backupPath: string,
): Promise<MessageResponse> {
  // Axios DELETE with body (config.data 사용)
  const response = await apiClient.delete<MessageResponse>(
    "/api/config/backups",
    {
      data: { backup_path: backupPath },
    },
  );
  return response.data;
}

/**
 * Config API 전체 export
 */
export const configApi = {
  getConfig,
  updateConfig,
  validateConfig,
  createBackup,
  listBackups,
  restoreConfig,
  getConfigModel,
  getBackupContent,
  deleteBackup,
};
