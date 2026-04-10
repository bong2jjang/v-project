---
title: Claude Code 환경 최적화 및 Light-Zowe 마이그레이션 준비
date: 2026-03-30
authors: [vms-team]
tags: [claude-code, light-zowe, migration, skills, optimization]
---

# Claude Code 환경 최적화 및 Light-Zowe 마이그레이션 준비

**작업 날짜**: 2026-03-30
**작업 시간**: 약 4시간
**작업자**: VMS Chat Ops 팀 + Claude Code

## 작업 요약

Light-Zowe 아키텍처 마이그레이션을 위한 Claude Code 개발 환경을 전면 최적화했습니다. Skills 폴더 구조 도입, Commands 추가, 문서 정리 등을 통해 4주간의 마이그레이션 작업에 최적화된 환경을 구축했습니다.

<!-- truncate -->

## 주요 작업 내역

### 1. Git 저장소 재설정

**문제**: 원본 `vms-matterbridge` 저장소에 연결되어 있음
**해결**: 새 프로젝트 `vms-chat-ops` 저장소로 원격 변경

```bash
git remote set-url origin https://github.com/bong2jjang/vms-chat-ops.git
git remote -v  # 확인
```

**결과**: 원본 저장소에 영향 없이 새 저장소로 분리 완료

### 2. Light-Zowe 마이그레이션 계획 재작성

**파일**: `docusaurus/docs/developer-guide/ZOWE_CHAT_MIGRATION_PLAN.md`
**변경 사항**:
- 기존 8주 계획 → 4주 집중 계획으로 변경
- Light-Zowe 아키텍처 개념 상세 설명 추가
- Common Message Schema (Pydantic 모델) 전체 정의
- Provider Pattern 구현 예시 추가 (SlackProvider, TeamsProvider)
- Week별 구체적 작업 내역 및 bash 명령어 포함

**주요 개념**:
- **Common Message Schema**: 플랫폼 독립적 메시지 표현
- **Provider Pattern**: 플랫폼별 어댑터 (Slack Socket Mode, Teams Graph API)
- **Command Processor**: `/vms`, `/bridge` 명령어 처리
- **Dynamic Routing**: Redis 기반 동적 라우팅 룰

### 3. .claude 디렉토리 대규모 개선

#### 3.1 핵심 문서 업데이트

**CLAUDE.md**:
- Light-Zowe 아키텍처 설명 추가
- 마이그레이션 컨텍스트 추가
- 프로젝트 구조에 `backend/app/adapters/` 추가
- 환경 변수에 `SLACK_APP_TOKEN`, `BRIDGE_TYPE` 추가

**coding_conventions.md**:
- "Light-Zowe 아키텍처 규칙" 섹션 추가 (300+ 라인)
- Provider Pattern 인터페이스 정의
- Common Schema 변환 규칙
- async/await 규칙
- 에러 처리 패턴
- 테스트 작성 가이드

**dev_workflow.md**:
- "Light-Zowe 마이그레이션 워크플로우" 섹션 추가
- Week 1-4 단계별 작업 절차
- 백업 절차
- Rollback 절차

#### 3.2 새로운 Agent 및 Command 생성

**Agent**:
- `migration-helper.md` - Light-Zowe 마이그레이션 전문가 에이전트 (400+ 라인)
  - Provider 스캐폴딩 가이드
  - Common Schema 구현 예시
  - 주차별 작업 안내

**Command**:
- `migration_status.md` - 마이그레이션 진행 상황 확인
  - Week별 완료 여부 체크
  - Provider 구현 상태 확인
  - 배포 준비 상태 확인

#### 3.3 프로젝트 이름 통일

**대상 파일**:
- `agents/agent-coach.md`
- `agents/code-standards-enforcer.md`
- `agents/docker-expert.md` - 마이그레이션 전/후 아키텍처 설명 추가
- `agents/pr-update-expert.md`
- `commands/check_sync_status.md` - 전면 재작성 (Matterbridge vs Native Bridge 대응)
- `coding_conventions.md` - 스토어 참조 수정 (matterbridge.ts → bridge.ts)

**변경 내용**: "VMS Matterbridge" → "VMS Chat Ops"

### 4. Skills 폴더 구조 도입 ⭐

**배경**: 반복되는 작업 패턴을 재사용 가능한 빌딩 블록으로 캡슐화

**생성된 Skills** (5개):

#### 4.1 scaffold-provider
- **역할**: Provider 기본 구조 자동 생성
- **생성물**: Provider 클래스, 단위 테스트, Mock 데이터
- **사용 시점**: Week 2 (Slack), Week 3 (Teams)

**템플릿 코드 포함**:
```python
class {Provider}Provider(BasePlatformProvider):
    async def connect(self) -> bool: ...
    async def send_message(self, message: CommonMessage) -> bool: ...
    def transform_to_common(self, raw_message: Dict) -> CommonMessage: ...
```

#### 4.2 validate-common-schema
- **역할**: CommonMessage 변환 검증
- **검증 항목**: 필수 필드, 타입, 양방향 변환, 크로스 플랫폼
- **사용 시점**: Provider 구현 중 지속적으로

**검증 항목**:
- Pydantic 모델 유효성
- Platform → Common → Platform 양방향 변환
- 테스트 코드 템플릿 제공

#### 4.3 add-route-rule
- **역할**: Redis 라우팅 룰 추가 (양방향 자동)
- **형식**: `route:{platform}:{channel}` → `{target}:{channel}`
- **사용 시점**: Week 2, 3 테스트 시, Week 4 프로덕션 설정

**기능**:
- 입력 형식 검증 (Slack: #channel, Teams: 일반 문자열)
- 중복 확인
- 양방향 룰 자동 생성
- Redis 저장 및 검증

#### 4.4 backup-config
- **역할**: 전체 설정 백업
- **백업 대상**: .env, docker-compose.yml, DB, Redis
- **사용 시점**: 마이그레이션 전, 배포 전

**백업 구조**:
```
backups/{timestamp}/
├── env/.env
├── docker/docker-compose*.yml
├── database/full_backup.sql.gz
├── redis/dump.rdb + routes.json
└── matterbridge/matterbridge.toml
```

#### 4.5 cleanup-matterbridge
- **역할**: Matterbridge 완전 제거
- **정리 대상**: 컨테이너, 이미지, 설정, 환경 변수
- **사용 시점**: Week 4 마이그레이션 완료 후

**정리 절차**:
1. 사전 조건 확인 (BRIDGE_TYPE=native, Provider 정상)
2. 컨테이너/이미지 제거
3. docker-compose.yml 업데이트
4. 설정 파일 백업 후 제거
5. 환경 변수 업데이트
6. 검증

### 5. Commands 추가 (3개) ⭐

#### 5.1 provider-health
- **역할**: Provider 연결 상태 빠른 확인 (5-10초)
- **확인 항목**:
  - Slack Socket Mode 연결
  - Teams Graph API 연결
  - Redis 라우팅 상태
  - Backend 서비스 상태

**사용 예시**:
```bash
/provider-health

# 출력
✅ Slack Provider (Socket Mode): 연결됨
✅ Teams Provider (Graph API): 연결됨
✅ Redis (Dynamic Routing): 정상 - 3개 룰
```

#### 5.2 test-provider
- **역할**: Provider 단위 테스트 및 검증
- **테스트 항목**:
  - Provider 초기화
  - CommonMessage 변환 (양방향)
  - 연결 테스트 (Socket Mode, Graph API)
  - E2E 통합 테스트

**사용 예시**:
```bash
/test-provider slack

# 워크플로우
1. 단위 테스트 실행 (pytest)
2. CommonMessage 변환 검증 (validate-common-schema skill 호출)
3. Socket Mode 연결 테스트
4. 샘플 메시지 송수신
```

#### 5.3 deploy-check
- **역할**: 배포 전 체크리스트 자동 검증
- **검증 항목** (10개 카테고리):
  1. 환경 변수 (10개 필수 변수)
  2. Provider 설정
  3. DB 마이그레이션
  4. Redis 라우팅 룰
  5. Matterbridge 제거 확인
  6. 컨테이너 헬스체크
  7. 로그 확인
  8. 보안 설정 (SECRET_KEY 강도, CORS)
  9. 백업 존재 여부
  10. 리소스 제한

**사용 예시**:
```bash
/deploy-check

# 출력
✅ 통과: 8개
⚠️  경고: 2개
❌ 실패: 0개

권장 조치사항:
1. .env 파일 권한 변경: chmod 600 .env
2. Slack Socket Mode 수동 확인 필요
```

### 6. Self-Correction Loop 검토

**문서**: `docusaurus/docs/design/SELF_CORRECTION_LOOP_REVIEW.md`

**결론**:
- ✅ `validate-common-schema` skill에만 제한적 적용 권장
- ✅ Interactive 모드 (사용자 승인 필수)
- ✅ 최대 3-5회 재시도 제한
- ❌ 전체 자동화는 위험성이 있어 보류

**향후 계획**:
- Phase 1: Week 1 완료 후 시범 적용
- Phase 2: 1주일 효과 측정
- Phase 3: 성공 시 다른 Skills로 확장

### 7. 문서 저장 규칙 설정

**규칙**:
- 작업 이력: `docusaurus/blog/work-history/YYYY-MM-DD-{title}.md`
- 설계 문서: `docusaurus/docs/design/`
- 개발자 가이드: `docusaurus/docs/developer-guide/`
- 관리자 가이드: `docusaurus/docs/admin-guide/`
- API 문서: `docusaurus/docs/api/`

**적용**:
- `.claude/documentation-rules.md` 생성 (예정)
- `CLAUDE.md`에 규칙 추가 (예정)

## 최종 .claude 디렉토리 구조

```
.claude/
├── agents/           (5개) - 복잡한 자율 워크플로우
│   ├── agent-coach.md
│   ├── code-standards-enforcer.md
│   ├── docker-expert.md
│   ├── migration-helper.md ⭐ NEW
│   └── pr-update-expert.md
├── commands/         (9개) - 사용자 진입점
│   ├── check_sync_status.md (전면 재작성)
│   ├── deploy_check.md ⭐ NEW
│   ├── docker_troubleshoot.md
│   ├── enforce_standards.md
│   ├── gh_issue_solve.md
│   ├── migration_status.md ⭐ NEW
│   ├── provider_health.md ⭐ NEW
│   ├── test_provider.md ⭐ NEW
│   └── write_pr_summary.md
├── skills/           (5개) - 재사용 가능한 빌딩 블록 ⭐ NEW
│   ├── add-route-rule.md
│   ├── backup-config.md
│   ├── cleanup-matterbridge.md
│   ├── scaffold-provider.md
│   └── validate-common-schema.md
├── coding_conventions.md (Light-Zowe 규칙 추가)
└── dev_workflow.md (마이그레이션 워크플로우 추가)

총 21개 파일
```

## 워크플로우 통합

### Week 1: Common Schema
```
migration-helper agent
  → scaffold-provider skill (schema 템플릿)
  → validate-common-schema skill (검증)
```

### Week 2: Slack Provider
```
migration-helper agent
  → scaffold-provider skill (SlackProvider 생성)

/test-provider slack
  → validate-common-schema skill (변환 검증)

수동: add-route-rule skill (테스트 라우팅)
```

### Week 3: Teams Provider
```
migration-helper agent
  → scaffold-provider skill (TeamsProvider 생성)

/test-provider teams
  → validate-common-schema skill (변환 검증)

수동: add-route-rule skill (양방향 라우팅)
```

### Week 4: 배포
```
backup-config skill (필수!)
  ↓
/deploy-check command (검증)
  ↓
배포 성공 → 1주일 테스트
  ↓
cleanup-matterbridge skill (Matterbridge 제거)
```

## 개선 효과

### Before (Skills 도입 전)
- Agents: 5개
- Commands: 6개
- 총: 13개 파일
- 반복 작업 수동 처리
- Provider 개발 시 매번 템플릿 복사
- 라우팅 룰 추가 시 형식 오류 빈번

### After (Skills 도입 후)
- Agents: 5개
- Commands: 9개 (+3)
- Skills: 5개 (NEW!)
- 총: 21개 파일
- 반복 작업 자동화
- Provider 스캐폴딩 자동
- 라우팅 룰 형식 자동 검증

### 정량적 효과 (예상)
- Provider 개발 시간: 30분 → 10분 (3배 단축)
- 라우팅 룰 추가 시간: 5분 → 1분 (5배 단축)
- 테스트 검증 시간: 15분 → 5분 (3배 단축)
- 배포 전 체크 시간: 20분 → 3분 (7배 단축)

## 다음 단계

### 즉시 시작 가능
1. **Week 1: Common Schema 구현**
   - `migration-helper` agent 활용
   - `scaffold-provider` skill로 기본 구조 생성
   - `validate-common-schema` skill로 검증

2. **문서 저장 규칙 완성**
   - `.claude/documentation-rules.md` 작성
   - `CLAUDE.md`에 규칙 추가

### 향후 검토 사항
1. **Self-Correction Loop 시범 적용**
   - Week 1 완료 후
   - `validate-common-schema`에만 제한적 적용
   - 1주일 효과 측정

2. **추가 Skills 검토**
   - `test-socket-mode` - Slack Socket Mode 전용 테스트
   - `test-graph-api` - Teams Graph API 전용 테스트
   - `verify-env-vars` - 환경 변수 검증

## 파일 변경 사항

### 생성된 파일 (14개)
- `docusaurus/docs/developer-guide/ZOWE_CHAT_MIGRATION_PLAN.md` (재작성)
- `docusaurus/docs/design/SELF_CORRECTION_LOOP_REVIEW.md`
- `docusaurus/blog/work-history/2026-03-30-claude-code-optimization.md`
- `.claude/agents/migration-helper.md`
- `.claude/commands/migration_status.md`
- `.claude/commands/provider_health.md`
- `.claude/commands/test_provider.md`
- `.claude/commands/deploy_check.md`
- `.claude/skills/scaffold-provider.md`
- `.claude/skills/validate-common-schema.md`
- `.claude/skills/add-route-rule.md`
- `.claude/skills/backup-config.md`
- `.claude/skills/cleanup-matterbridge.md`
- `.claude/documentation-rules.md` (예정)

### 수정된 파일 (10개)
- `CLAUDE.md`
- `.claude/coding_conventions.md`
- `.claude/dev_workflow.md`
- `.claude/agents/agent-coach.md`
- `.claude/agents/code-standards-enforcer.md`
- `.claude/agents/docker-expert.md`
- `.claude/agents/pr-update-expert.md`
- `.claude/commands/check_sync_status.md` (전면 재작성)
- Git 원격 저장소 설정
- 프로젝트 이름 통일

## 참고 자료

- Light-Zowe 마이그레이션 계획: `docs/developer-guide/ZOWE_CHAT_MIGRATION_PLAN.md`
- Self-Correction Loop 검토: `docs/design/SELF_CORRECTION_LOOP_REVIEW.md`
- .claude 디렉토리: `.claude/`
  - Agents: `.claude/agents/`
  - Commands: `.claude/commands/`
  - Skills: `.claude/skills/`
- 코딩 규칙: `.claude/coding_conventions.md`
- 개발 워크플로우: `.claude/dev_workflow.md`

## 작업 회고

### 잘된 점
- Skills 폴더 구조 도입으로 재사용성 대폭 향상
- 문서화가 체계적으로 정리됨
- Light-Zowe 마이그레이션에 최적화된 환경 구축
- 프로젝트 이름 통일로 일관성 확보

### 개선이 필요한 점
- Self-Correction Loop는 실제 적용 후 평가 필요
- 문서 저장 규칙 설정 완료 필요
- Skills 간 의존성 관리 방법 고민 필요

### 배운 점
- Skills는 Agents/Commands보다 더 작은 재사용 단위
- Interactive Self-Correction이 Fully-automatic보다 안전
- 문서화 규칙을 사전에 정하는 것이 중요

## 작업 소요 시간

| 작업 | 소요 시간 |
|------|-----------|
| Git 저장소 재설정 | 10분 |
| 마이그레이션 계획 재작성 | 60분 |
| .claude 디렉토리 개선 | 90분 |
| Skills 폴더 구성 | 60분 |
| Commands 추가 | 40분 |
| Self-Correction Loop 검토 | 30분 |
| 문서화 | 30분 |
| **총계** | **약 5시간 20분** |

---

**다음 작업**: Week 1 Common Schema 구현 시작
**담당자**: VMS Chat Ops 팀
**우선순위**: 높음
