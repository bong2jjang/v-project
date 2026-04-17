---
name: sync-docs
description: 코드 변경 기반 증분 문서 갱신 — git diff로 변경분만 분석하여 관련 Docusaurus 문서를 자동 업데이트
---

# 증분 문서 갱신 스킬

마지막 동기화 이후 변경된 코드를 분석하여 관련 Docusaurus 문서를 자동으로 갱신합니다.

## 실행 흐름

### Phase 1: 변경분 수집

1. `.claude/docs-sync-marker` 파일에서 마지막 동기화 커밋 해시를 읽는다
2. `git diff <marker-commit>..HEAD --name-status`로 변경된 파일 목록을 가져온다
3. `docusaurus/` 하위 파일 변경은 제외한다 (문서 자체 변경은 분석 대상이 아님)
4. 변경이 없으면 "문서 갱신 불필요 — 코드 변경 없음"을 출력하고 종료한다

### Phase 2: 영향 분석

1. `.claude/doc-mapping.json`을 읽어 소스→문서 매핑 규칙을 로드한다
2. 변경된 파일 경로를 매핑 규칙과 대조하여 갱신이 필요한 문서 목록을 산출한다
3. 매핑에 해당하지 않는 파일은 건너뛴다
4. 각 대상 문서에 대해 어떤 소스 파일이 변경되었는지 그룹화한다

### Phase 3: 문서 갱신

각 대상 문서에 대해 순차적으로:

1. 대상 문서를 Read로 읽는다
2. 관련 변경 소스 파일들을 Read로 읽는다 (변경 부분 위주)
3. `git diff <marker-commit>..HEAD -- <source-file>` 로 실제 diff를 확인한다
4. 변경의 의미를 파악하여 문서를 갱신한다:
   - **새 기능 추가**: 해당 섹션에 기능 설명 추가
   - **API 변경**: 엔드포인트, 파라미터, 응답 형식 업데이트
   - **설정 변경**: 환경 변수, 설정 옵션 업데이트
   - **구조 변경**: 아키텍처 다이어그램/설명 업데이트
   - **버그 수정**: 문서에 반영할 동작 변경이 있는 경우만
5. Edit 도구로 문서를 수정한다

### Phase 4: 마커 갱신

1. 모든 문서 갱신이 완료되면 현재 HEAD 커밋 해시를 `.claude/docs-sync-marker`에 기록한다
2. 갱신 결과를 요약 출력한다:
   - 분석한 소스 파일 수
   - 갱신한 문서 파일 수
   - 각 문서별 변경 요약 (1줄)

## 문서 갱신 원칙

### 해야 하는 것
- 기존 문서의 톤과 구조를 유지하며 갱신
- 한국어로 작성 (기존 문서가 한국어인 경우)
- 코드 예시가 있다면 현재 코드에 맞게 업데이트
- 새로 추가된 환경 변수, API 엔드포인트, 설정 옵션 반영
- Docusaurus 마크다운 형식 준수 (frontmatter, admonitions 등)

### 하지 않아야 하는 것
- 문서 전체를 다시 쓰지 않는다 — 변경된 부분만 갱신
- 추측으로 문서를 쓰지 않는다 — 코드에서 확인된 사실만 반영
- design/ 하위 설계 문서는 갱신하지 않는다 — 설계 문서는 별도 관리
- blog/work-history/ 하위 작업 이력은 건드리지 않는다

## 매핑 규칙 (`doc-mapping.json`) 구조

```json
{
  "mappings": [
    {
      "source_pattern": "apps/v-channel-bridge/backend/app/adapters/**",
      "docs": ["developer-guide/ARCHITECTURE.md", "admin-guide/TEAMS_SETUP.md"],
      "description": "Provider 어댑터 변경"
    }
  ]
}
```

- `source_pattern`: glob 패턴 (파일 경로 매칭)
- `docs`: 갱신 대상 문서 목록 (docusaurus/docs/ 기준 상대 경로)
- `description`: 매핑 설명 (로깅용)

## 인자

- `--dry-run` (선택): 실제 갱신 없이 어떤 문서가 갱신될지만 출력
- `--force` (선택): 마커 무시하고 특정 커밋 범위 지정 (예: `--force abc1234..def5678`)
- `--scope` (선택): 특정 매핑 카테고리만 실행 (예: `--scope api`)

## 사용 예시

```
# 기본 실행: 마지막 동기화 이후 변경분 갱신
/sync-docs

# 드라이런: 갱신 대상만 확인
/sync-docs --dry-run

# 특정 범위만 갱신
/sync-docs --force d7a0de03..HEAD
```

## 오류 처리

- 마커 파일이 없으면: 최근 10개 커밋 범위로 실행하고 경고 출력
- 마커의 커밋이 히스토리에 없으면: `git merge-base` 로 공통 조상 찾아서 사용
- 매핑에 지정된 문서가 존재하지 않으면: 해당 문서는 건너뛰고 경고 출력
- 변경이 너무 많으면 (50개 파일 이상): 사용자에게 범위 축소를 제안
