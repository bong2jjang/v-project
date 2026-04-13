# API Client Documentation

VMS Channel Bridge API 클라이언트 라이브러리

## 목차

- [설치](#설치)
- [기본 사용법](#기본-사용법)
- [Bridge API](#bridge-api)
- [Config API](#config-api)
- [에러 처리](#에러-처리)
- [Zustand Store](#zustand-store)

## 설치

필요한 패키지들:

```bash
npm install axios zustand
```

## 기본 사용법

### 환경 변수 설정

`.env` 파일에 API URL 설정:

```env
VITE_API_URL=http://localhost:8000
```

### API 직접 호출

```typescript
import * as api from "@/lib/api";

// v-channel-bridge 상태 조회
const status = await api.getStatus();
console.log(status.running); // true/false

// 설정 조회
const config = await api.getConfig();
console.log(config.gateway);
```

### Zustand Store 사용 (권장)

```typescript
import { useBridgeStore, useConfigStore } from "@/store";

function MyComponent() {
  const { status, fetchStatus, start, stop } = useBridgeStore();
  const { config, fetchConfig } = useConfigStore();

  useEffect(() => {
    fetchStatus();
    fetchConfig();
  }, []);

  return (
    <div>
      <p>Status: {status?.running ? "Running" : "Stopped"}</p>
      <button onClick={() => start()}>Start</button>
      <button onClick={() => stop()}>Stop</button>
    </div>
  );
}
```

## Bridge API

### getStatus()

v-channel-bridge 컨테이너의 현재 상태 조회

```typescript
const status = await api.getStatus();
// {
//   running: true,
//   pid: 12345,
//   uptime: "2h 30m",
//   version: "1.26.0",
//   container_status: "running",
//   container_name: "vms-channel-bridge"
// }
```

### start(request?)

v-channel-bridge 시작

```typescript
// 기본 시작
await api.start();

// 강제 시작 (이미 실행 중이면 재시작)
await api.start({ force: true, timeout: 30 });
```

### stop(request?)

v-channel-bridge 중지

```typescript
// 기본 중지 (SIGTERM)
await api.stop();

// 강제 중지 (SIGKILL)
await api.stop({ force: true, timeout: 15 });
```

### restart(timeout?)

v-channel-bridge 재시작

```typescript
await api.restart();
await api.restart(60); // 60초 타임아웃
```

### getLogs(lines?)

로그 조회

```typescript
const response = await api.getLogs(100);
console.log(response.logs); // string[]
```

## Config API

### getConfig()

현재 설정 조회

```typescript
const config = await api.getConfig();
console.log(config.slack);
console.log(config.teams);
console.log(config.gateway);
```

### updateConfig(config, createBackup?)

설정 업데이트

```typescript
const newConfig = {
  general: { MediaServerUpload: "http://localhost:8080" },
  slack: { myslack: { Token: "xoxb-..." } },
  gateway: [
    {
      name: "slack-teams",
      enable: true,
      inout: [
        { account: "slack.myslack", channel: "general" },
        { account: "teams.myteams", channel: "19:xxx" },
      ],
    },
  ],
};

// 백업 생성 후 업데이트 (기본값)
const result = await api.updateConfig(newConfig);
console.log(result.backup_path);

// 백업 없이 업데이트
await api.updateConfig(newConfig, false);
```

### validateConfig(config?)

설정 검증

```typescript
// 현재 파일 검증
const validation = await api.validateConfig();

// 특정 설정 검증
const validation = await api.validateConfig(myConfig);

if (!validation.valid) {
  console.error("Validation errors:", validation.errors);
}
console.log("Warnings:", validation.warnings);
```

### createBackup()

백업 생성

```typescript
const result = await api.createBackup();
console.log("Backup created:", result.backup_path);
```

### listBackups()

백업 목록 조회

```typescript
const response = await api.listBackups();
response.backups.forEach((backup) => {
  console.log(backup.path, backup.timestamp);
});
```

### restoreConfig(backupPath)

설정 복원

```typescript
await api.restoreConfig("/path/to/backup.json");
```

## 에러 처리

### ApiClientError

모든 API 에러는 `ApiClientError` 클래스로 래핑됩니다.

```typescript
import { ApiClientError } from "@/lib/api";

try {
  await api.start();
} catch (error) {
  if (error instanceof ApiClientError) {
    console.error("Status:", error.status);
    console.error("User message:", error.getUserMessage());
    console.error("Detail:", error.detail);
  }
}
```

### 에러 타입별 메시지

| 에러 타입             | 사용자 메시지                      |
| --------------------- | ---------------------------------- |
| `already_running`     | "v-channel-bridge가 이미 실행 중입니다." |
| `not_running`         | "v-channel-bridge가 실행 중이 아닙니다." |
| `validation_failed`   | "설정 검증 실패: [상세 에러]"      |
| `backup_not_found`    | "백업 파일을 찾을 수 없습니다."    |
| `invalid_backup`      | "유효하지 않은 백업 파일입니다."   |
| `network_error`       | "서버에 연결할 수 없습니다."       |

## Zustand Store

### useBridgeStore

```typescript
import { useBridgeStore } from "@/store";

function Dashboard() {
  const {
    status,       // BridgeStatus | null
    logs,         // string[]
    isLoading,    // boolean
    error,        // string | null
    fetchStatus,  // () => Promise<void>
    start,        // (request?) => Promise<void>
    stop,         // (request?) => Promise<void>
    restart,      // (timeout?) => Promise<void>
    fetchLogs,    // (lines?) => Promise<void>
    clearError,   // () => void
    reset,        // () => void
  } = useBridgeStore();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <p>Running: {status?.running ? "Yes" : "No"}</p>
      <button onClick={() => start()}>Start</button>
      <button onClick={() => stop()}>Stop</button>
      <button onClick={() => restart()}>Restart</button>
    </div>
  );
}
```

### useConfigStore

```typescript
import { useConfigStore } from "@/store";

function Settings() {
  const {
    config,          // BridgeConfig | null
    validation,      // ValidationResult | null
    backups,         // BackupInfo[]
    isLoading,       // boolean
    error,           // string | null
    lastBackupPath,  // string | null
    fetchConfig,     // () => Promise<void>
    updateConfig,    // (config, createBackup?) => Promise<void>
    validateConfig,  // (config?) => Promise<boolean>
    createBackup,    // () => Promise<void>
    fetchBackups,    // () => Promise<void>
    restoreConfig,   // (backupPath) => Promise<void>
    clearError,      // () => void
    clearValidation, // () => void
    reset,           // () => void
  } = useConfigStore();

  const handleSave = async () => {
    try {
      await updateConfig(myConfig, true);
      alert("설정이 저장되었습니다!");
    } catch (error) {
      // 에러는 store.error에 자동으로 저장됨
    }
  };

  return (
    <div>
      {error && <div className="error">{error}</div>}
      {/* 설정 폼 */}
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
```

## 예제: 전체 워크플로우

```typescript
import { useBridgeStore, useConfigStore } from "@/store";

function FullWorkflow() {
  const bridge = useBridgeStore();
  const config = useConfigStore();

  const handleConfigChange = async (newConfig) => {
    try {
      // 1. 설정 검증
      const isValid = await config.validateConfig(newConfig);
      if (!isValid) {
        alert("설정이 유효하지 않습니다.");
        return;
      }

      // 2. 백업 생성 후 설정 업데이트
      await config.updateConfig(newConfig, true);

      // 3. v-channel-bridge 재시작
      await bridge.restart();

      // 4. 상태 확인
      await bridge.fetchStatus();

      alert("설정이 적용되었습니다!");
    } catch (error) {
      alert("설정 적용 실패");
    }
  };

  return <div>{/* UI */}</div>;
}
```

## TypeScript 타입

모든 타입은 `@/lib/api/types`에서 export됩니다:

```typescript
import type {
  BridgeStatus,
  BridgeControlResponse,
  BridgeConfig,
  ValidationResult,
  BackupInfo,
  // ... 등등
} from "@/lib/api/types";
```

## 개발 환경

개발 환경에서는 자동으로 API 요청/응답이 콘솔에 로깅됩니다:

```
[API] GET /api/bridge/status
[API] GET /api/bridge/status - 200 { running: true, ... }
```

프로덕션 환경에서는 로깅이 비활성화됩니다.
