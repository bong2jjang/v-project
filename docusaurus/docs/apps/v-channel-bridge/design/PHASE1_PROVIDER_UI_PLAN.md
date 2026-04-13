---
sidebar_position: 10
title: "Phase 1: Provider 설정 UI 구현 계획"
description: Settings 페이지에 Provider 관리 기능 추가
---

# Phase 1: Provider 설정 UI 구현 계획

## 📋 개요

**목표**: Settings 페이지에 "Providers" 탭을 추가하여 Slack/Teams Provider를 UI에서 관리 가능하도록 구현

**작성일**: 2026-04-02
**우선순위**: 🔴 최우선
**예상 작업 시간**: 4-6시간
**담당**: VMS Channel Bridge Team

---

## 🎯 목표 및 배경

### 현재 문제점

1. **Provider 설정이 `.env` 파일에서만 가능**
   - Slack Bot Token, App Token 수동 설정
   - Teams Tenant ID, App ID, Password 수동 설정
   - 재시작 필요 (Docker restart)

2. **UI를 통한 Provider 관리 불가능**
   - 일반 사용자가 Provider 추가/수정/삭제 불가
   - 연결 상태 확인 불가
   - Token 유효성 검증 불가

3. **초기 설정 진입 장벽**
   - 개발자가 아닌 사용자는 `.env` 파일 편집 어려움
   - Docker 재시작 절차 복잡

### 개선 목표

- ✅ UI에서 Provider 추가/수정/삭제
- ✅ 연결 테스트 기능
- ✅ Token 마스킹 처리 (보안)
- ✅ 유효성 검증 (Token 형식)
- ✅ 실시간 연결 상태 표시

---

## 🏗️ 시스템 아키텍처

### Backend (이미 준비됨)

```
/api/accounts-db
├── GET    /                  # Provider 목록 조회
├── POST   /                  # Provider 추가
├── GET    /{id}              # Provider 상세 조회
├── PUT    /{id}              # Provider 수정
└── DELETE /{id}              # Provider 삭제
```

**DB 스키마** (`Account` 모델):
```python
class Account(Base):
    id: int
    name: str                # Provider 이름 (예: "slack-main")
    platform: str            # "slack" | "msteams"
    enabled: bool            # 활성화 여부
    is_valid: bool           # 유효성 검증 결과

    # Slack
    token: str               # Bot Token (xoxb-...)
    app_token: str           # App Token (xapp-...) - Socket Mode

    # Teams
    tenant_id: str
    app_id: str
    app_password: str
```

### Frontend (신규 구현)

```
Settings 페이지
└── Providers 탭 (신규)
    ├── ProviderList 컴포넌트
    │   ├── Provider 카드 (Slack, Teams)
    │   ├── 연결 상태 배지
    │   ├── [Edit] [Test] [Delete] 버튼
    │   └── [+ Add Provider] 버튼
    │
    └── ProviderModal 컴포넌트
        ├── Platform 선택 (Slack/Teams)
        ├── 입력 폼 (플랫폼별 필드)
        ├── 유효성 검증
        └── [Save] [Cancel] 버튼
```

---

## 📐 상세 설계

### 1. Frontend API 클라이언트

**파일**: `frontend/src/lib/api/providers.ts`

```typescript
export interface ProviderResponse {
  id: number;
  name: string;
  platform: "slack" | "msteams";
  enabled: boolean;
  is_valid: boolean;
  validation_errors?: string;

  // Slack
  token_masked?: string;
  app_token_masked?: string;

  // Teams
  tenant_id?: string;
  app_id?: string;

  created_at: string;
  updated_at: string;
}

export interface ProviderCreateRequest {
  name: string;
  platform: "slack" | "msteams";
  enabled?: boolean;

  // Slack
  token?: string;
  app_token?: string;

  // Teams
  tenant_id?: string;
  app_id?: string;
  app_password?: string;
}

export const providersApi = {
  async getProviders(): Promise<ProviderResponse[]>,
  async createProvider(data: ProviderCreateRequest): Promise<ProviderResponse>,
  async updateProvider(id: number, data: Partial<ProviderCreateRequest>): Promise<ProviderResponse>,
  async deleteProvider(id: number): Promise<void>,
  async testConnection(id: number): Promise<{ success: boolean; message: string }>,
};
```

### 2. Frontend Store

**파일**: `frontend/src/store/providers.ts`

```typescript
interface ProvidersState {
  providers: ProviderResponse[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchProviders: () => Promise<void>;
  addProvider: (data: ProviderCreateRequest) => Promise<void>;
  updateProvider: (id: number, data: Partial<ProviderCreateRequest>) => Promise<void>;
  deleteProvider: (id: number) => Promise<void>;
  testConnection: (id: number) => Promise<{ success: boolean; message: string }>;
  clearError: () => void;
}

export const useProvidersStore = create<ProvidersState>(...);
```

### 3. ProviderList 컴포넌트

**파일**: `frontend/src/components/settings/ProviderList.tsx`

```tsx
export function ProviderList() {
  const { providers, fetchProviders, deleteProvider, testConnection } = useProvidersStore();
  const [editingProvider, setEditingProvider] = useState<ProviderResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Slack Provider 카드 */}
      <ProviderCard
        provider={slackProvider}
        onEdit={(p) => { setEditingProvider(p); setIsModalOpen(true); }}
        onTest={(p) => testConnection(p.id)}
        onDelete={(p) => deleteProvider(p.id)}
      />

      {/* Teams Provider 카드 */}
      <ProviderCard
        provider={teamsProvider}
        onEdit={(p) => { setEditingProvider(p); setIsModalOpen(true); }}
        onTest={(p) => testConnection(p.id)}
        onDelete={(p) => deleteProvider(p.id)}
      />

      {/* Add Provider 버튼 */}
      <Button onClick={() => { setEditingProvider(null); setIsModalOpen(true); }}>
        + Add Provider
      </Button>

      {/* Provider Modal */}
      <ProviderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        provider={editingProvider}
      />
    </div>
  );
}
```

### 4. ProviderCard 컴포넌트

**파일**: `frontend/src/components/settings/ProviderCard.tsx`

```tsx
interface ProviderCardProps {
  provider: ProviderResponse | null;
  onEdit: (provider: ProviderResponse) => void;
  onTest: (provider: ProviderResponse) => void;
  onDelete: (provider: ProviderResponse) => void;
}

export function ProviderCard({ provider, onEdit, onTest, onDelete }: ProviderCardProps) {
  if (!provider) {
    return (
      <Card>
        <CardBody>
          <div className="text-center py-4">
            <p className="text-content-secondary">Not configured</p>
            <Button onClick={() => onEdit(null)}>Configure</Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlatformIcon platform={provider.platform} />
            <CardTitle>{provider.name}</CardTitle>
          </div>
          <Badge variant={provider.is_valid && provider.enabled ? "success" : "danger"} dot>
            {provider.is_valid && provider.enabled ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </CardHeader>
      <CardBody>
        {/* Token 정보 (마스킹) */}
        {provider.platform === "slack" && (
          <div className="space-y-2">
            <div className="text-sm">
              <span className="text-content-secondary">Bot Token:</span>
              <code className="ml-2 text-content-primary">{provider.token_masked}</code>
            </div>
            <div className="text-sm">
              <span className="text-content-secondary">App Token:</span>
              <code className="ml-2 text-content-primary">{provider.app_token_masked}</code>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button size="sm" onClick={() => onEdit(provider)}>Edit</Button>
          <Button size="sm" variant="secondary" onClick={() => onTest(provider)}>
            Test Connection
          </Button>
          <Button size="sm" variant="danger" onClick={() => onDelete(provider)}>
            Delete
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
```

### 5. ProviderModal 컴포넌트

**파일**: `frontend/src/components/settings/ProviderModal.tsx`

```tsx
interface ProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider?: ProviderResponse | null;
}

export function ProviderModal({ isOpen, onClose, provider }: ProviderModalProps) {
  const [platform, setPlatform] = useState<"slack" | "msteams">(provider?.platform || "slack");
  const [formData, setFormData] = useState<ProviderCreateRequest>({
    name: provider?.name || "",
    platform: platform,
    enabled: provider?.enabled ?? true,
    // ... 기타 필드
  });

  const handleSave = async () => {
    if (provider) {
      await updateProvider(provider.id, formData);
    } else {
      await addProvider(formData);
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={provider ? "Edit Provider" : "Add Provider"}>
      <ModalBody>
        {/* Platform 선택 (신규 추가 시에만) */}
        {!provider && (
          <Select
            label="Platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as "slack" | "msteams")}
            options={[
              { value: "slack", label: "Slack" },
              { value: "msteams", label: "Microsoft Teams" },
            ]}
          />
        )}

        {/* Provider 이름 */}
        <Input
          label="Provider Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., slack-main"
        />

        {/* Slack 필드 */}
        {platform === "slack" && (
          <>
            <Input
              label="Bot Token"
              type="password"
              value={formData.token}
              onChange={(e) => setFormData({ ...formData, token: e.target.value })}
              placeholder="xoxb-..."
            />
            <Input
              label="App Token (Socket Mode)"
              type="password"
              value={formData.app_token}
              onChange={(e) => setFormData({ ...formData, app_token: e.target.value })}
              placeholder="xapp-..."
            />
          </>
        )}

        {/* Teams 필드 */}
        {platform === "msteams" && (
          <>
            <Input
              label="Tenant ID"
              value={formData.tenant_id}
              onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
              placeholder="your-tenant-id"
            />
            <Input
              label="App ID"
              value={formData.app_id}
              onChange={(e) => setFormData({ ...formData, app_id: e.target.value })}
              placeholder="your-app-id"
            />
            <Input
              label="App Password"
              type="password"
              value={formData.app_password}
              onChange={(e) => setFormData({ ...formData, app_password: e.target.value })}
              placeholder="your-app-password"
            />
          </>
        )}

        {/* 활성화 체크박스 */}
        <label>
          <input
            type="checkbox"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
          />
          Enabled
        </label>
      </ModalBody>

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </ModalFooter>
    </Modal>
  );
}
```

### 6. Settings 페이지 통합

**파일**: `frontend/src/pages/Settings.tsx` (수정)

```tsx
// Providers 탭 추가
<TabsTrigger
  value="providers"
  icon={<ProvidersIcon />}
>
  Providers
</TabsTrigger>

{/* Providers Tab Content */}
<TabsContent value="providers">
  <ProviderList />
</TabsContent>
```

---

## 🔧 Backend 수정 사항

### 1. Connection Test 엔드포인트 추가

**파일**: `backend/app/api/accounts_crud.py` (추가)

```python
@router.post("/{account_id}/test", response_model=dict)
async def test_account_connection(
    account_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Account 연결 테스트"""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Provider로 연결 테스트
    if account.platform == "slack":
        # Slack API 호출 테스트
        try:
            from slack_sdk import WebClient
            client = WebClient(token=account.token)
            response = client.auth_test()
            return {"success": True, "message": f"Connected as {response['user']}"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    elif account.platform == "msteams":
        # Teams API 호출 테스트
        # ... (구현)
        pass

    return {"success": False, "message": "Unknown platform"}
```

### 2. Backend main.py에 라우터 등록 확인

**파일**: `backend/app/main.py`

```python
from app.api.accounts_crud import router as accounts_crud_router

app.include_router(accounts_crud_router)
```

---

## 📋 구현 체크리스트

### Backend

- [x] `/api/accounts-db` 엔드포인트 확인 (이미 구현됨)
- [ ] `/api/accounts-db/{id}/test` 연결 테스트 엔드포인트 추가
- [ ] Token 마스킹 처리 확인 (`AccountResponse.from_orm_with_masking`)
- [ ] 유효성 검증 로직 확인 (`validate_account`)

### Frontend - API & Store

- [ ] `lib/api/providers.ts` 작성
- [ ] `store/providers.ts` 작성

### Frontend - Components

- [ ] `components/settings/ProviderList.tsx` 작성
- [ ] `components/settings/ProviderCard.tsx` 작성
- [ ] `components/settings/ProviderModal.tsx` 작성
- [ ] `components/ui/PlatformIcon.tsx` 작성 (있으면 재사용)

### Frontend - Integration

- [ ] `pages/Settings.tsx`에 Providers 탭 추가
- [ ] 권한 확인 (관리자만 접근 가능하도록)

### Testing

- [ ] Provider 추가 테스트
- [ ] Provider 수정 테스트
- [ ] Provider 삭제 테스트
- [ ] 연결 테스트 기능 확인
- [ ] Token 마스킹 확인
- [ ] 유효성 검증 확인

---

## 🎨 UI/UX 가이드

### 디자인 원칙

1. **직관적인 상태 표시**
   - 🟢 Connected (is_valid=true, enabled=true)
   - 🔴 Disconnected (is_valid=false 또는 enabled=false)
   - ⚠️ Warning (유효성 검증 실패)

2. **보안 우선**
   - Token은 항상 마스킹 (`xoxb-****...****1234`)
   - Password 필드는 `type="password"`

3. **명확한 액션**
   - [Edit]: Provider 수정
   - [Test Connection]: 연결 테스트 (즉시 피드백)
   - [Delete]: Provider 삭제 (확인 다이얼로그)

### 색상 및 아이콘

- Slack: 🟣 `#4A154B` (Purple)
- Teams: 🔵 `#464EB8` (Blue)
- Connected: 🟢 Green badge
- Disconnected: 🔴 Red badge

---

## 🚀 배포 및 테스트 계획

### 1. 로컬 테스트

```bash
# Backend
docker compose restart backend

# Frontend
docker compose restart frontend

# 접속
http://localhost:5173/settings
→ Providers 탭 클릭
→ Add Provider 클릭
→ Slack Provider 추가
```

### 2. 테스트 시나리오

#### Scenario 1: Slack Provider 추가
1. Settings > Providers 탭 이동
2. [+ Add Provider] 클릭
3. Platform: Slack 선택
4. Name: "slack-main" 입력
5. Bot Token: `xoxb-...` 입력
6. App Token: `xapp-...` 입력
7. [Save] 클릭
8. 카드에 🟢 Connected 표시 확인

#### Scenario 2: 연결 테스트
1. Provider 카드에서 [Test Connection] 클릭
2. Toast 메시지 표시:
   - 성공: "✅ Connected as @bot_name"
   - 실패: "❌ Invalid token"

#### Scenario 3: Provider 수정
1. [Edit] 클릭
2. Token 수정
3. [Save] 클릭
4. 상태 업데이트 확인

#### Scenario 4: Provider 삭제
1. [Delete] 클릭
2. 확인 다이얼로그 표시
3. [Confirm] 클릭
4. Provider 제거 확인

---

## 📊 성공 기준

### 기능적 요구사항
- ✅ UI에서 Provider 추가 가능
- ✅ UI에서 Provider 수정 가능
- ✅ UI에서 Provider 삭제 가능
- ✅ 연결 테스트 기능 작동
- ✅ Token 마스킹 처리됨
- ✅ 유효성 검증 작동

### 비기능적 요구사항
- ✅ 응답 시간 < 1초 (연결 테스트 제외)
- ✅ Token은 HTTPS로만 전송
- ✅ 관리자만 접근 가능
- ✅ 에러 메시지 명확하게 표시

---

## 🔄 Next Steps (Phase 2)

Phase 1 완료 후:

1. **Light-Zowe Route 관리 UI** (Channels 페이지)
2. **채널 자동 완성 기능**
3. **초기 설정 마법사**

---

**문서 버전**: 1.0
**최종 업데이트**: 2026-04-02
**작성자**: VMS Channel Bridge Team
**상태**: 🚧 구현 진행 중
