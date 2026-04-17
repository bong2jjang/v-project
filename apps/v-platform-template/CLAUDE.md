# v-platform-template — Claude Code 앱 스코프 설정
<!-- scope: app:v-platform-template -->

이 문서는 `apps/v-platform-template/` 하위 작업에만 적용됩니다. 루트 `CLAUDE.md`와 `platform/CLAUDE.md`를 상위 컨텍스트로 함께 참조하세요.

## 1. 앱 정체성

- **역할**: 새 v-platform 앱을 시작할 때 복사해서 사용하는 **스캐폴딩 템플릿**. 플랫폼 공통 기능(인증/RBAC/감사/조직도/설정)이 모두 포함된 최소 구성.
- **주요 기능**:
  - PlatformApp 최소 진입점 (~30줄 `main.py`)
  - 플랫폼 페이지 100% 재사용 (Login, Settings, Admin...)
  - 앱 전용 Dashboard / Help 스텁
  - 앱별 맞춤 투어(useTour) / 도움말 / 알림 관리 예제
- **도메인 용어**: 앱 고유 도메인 없음. 새 앱 고유 용어는 복사 후 정의.
- **아키텍처 패턴**:
  - "얇은 앱" 레퍼런스 — 플랫폼만 활용하는 앱이 어떻게 구성되어야 하는지 본보기
  - 앱 라우터를 `register_app_routers()`로 붙이는 확장 포인트 데모

## 2. 기술 스택 특이사항

- 플랫폼 공통 스택만 사용. 추가 의존성 없음.
- 새 앱이 복사하여 시작하므로 **추가 의존성은 신중하게** — 복사 기준이 무거워지지 않도록.

## 3. 엔드포인트 및 포트

| 서비스 | 내부 포트 | 호스트 포트 | 비고 |
|---|---|---|---|
| Backend | 8000 | 8002 | FastAPI |
| Frontend | 5173 | 5174 | Vite |

## 4. 디렉터리 맵

```
apps/v-platform-template/
├── backend/
│   ├── app/
│   │   ├── main.py                  # PlatformApp 최소 구성
│   │   └── models/__init__.py       # 새 앱이 모델 추가할 위치
│   └── migrations/                  # a001_*.py 예시 (없으면 비어있음)
└── frontend/src/
    ├── pages/
    │   ├── Dashboard.tsx            # 앱 전용 대시보드 스텁
    │   ├── Help.tsx                 # 도움말 스텁
    │   └── admin/                   # 알림 관리 예제
    ├── hooks/useTour.ts             # 앱별 투어 예제
    ├── lib/tour/                    # 투어 스텝 정의
    └── App.tsx                      # 플랫폼 라우트 + 앱 라우트 구성 예제
```

## 5. 의존성

- **Platform 의존**: PlatformApp 전체.
- **공유 인프라**: 복사 후 새 앱이 필요에 따라 추가 (DB 테이블은 a*.py 마이그레이션으로).
- **외부 서비스**: 없음.

## 6. 작업 범위 가드레일

이 앱은 **템플릿**이므로 수정 원칙이 다른 앱과 다릅니다:

### ✅ 자유 수정 허용
- 복사 편의를 위한 주석/스텁 개선
- 새 앱이 공통으로 필요한 패턴 시연 (예: 모범 라우터 구조, 모범 투어 스텝)
- Dashboard/Help 페이지 리팩토링 — 단 "스캐폴딩에 적합한 최소 구조" 유지

### ⚠️ 사용자 승인 필요
- 기본 의존성 추가 (`requirements.txt`, `package.json`) — 템플릿이 무거워짐
- `main.py` 구조 변경 — 새 앱 시작 절차가 바뀜
- 앱별 투어/도움말 구조 변경 — 다른 앱들이 이 패턴을 복사했을 가능성

### ❌ 금지
- `platform/**` 직접 수정
- 타 앱 디렉터리 수정
- 템플릿에 프로덕션 전용 로직/시크릿 추가

### 교차 영향 사전 체크리스트
1. 변경이 "새 앱을 시작할 때 복사해도 합리적"인 수준인가?
2. 의존성 추가 시 새 앱에 필수가 아닌 패키지를 끌어들이지 않는가?
3. 포털(`v-platform-portal`)이 템플릿을 레퍼런스로 삼는 부분(투어/알림 관리 예제)과 일관성이 유지되는가?
4. 플랫폼 페이지 import 경로가 유효한가?
5. 템플릿 사용법 주석(`main.py` 상단)이 최신 상태인가?

## 7. 앱 고유 개발 워크플로우

```bash
# 템플릿 프로필로 기동
docker compose --profile template up -d --build

# 새 앱 시작 (템플릿 복사)
cp -r apps/v-platform-template apps/v-my-new-app
# → app_name, 포트, docker-compose.yml 엔트리 수정
```

**접속**: http://127.0.0.1:5174

## 8. 관련 문서 및 참조

- 공통 규칙: 루트 `CLAUDE.md`, `.claude/shared/coding_conventions.md`
- 플랫폼 규칙: `platform/CLAUDE.md` (새 앱 작성 규칙 포함)
- 아키텍처: `docusaurus/docs/apps/v-platform-template/`
- 새 앱 작성 가이드: `.claude/platform/CONVENTIONS.md` 의 "새 앱 작성 규칙" 섹션
