---
id: v-itsm-test-scenario
title: v-itsm v0.2 테스트 시나리오
sidebar_position: 2
---

# v-itsm v0.2 테스트 시나리오

v-itsm v0.2 (고객/제품/계약/SLA 티어/스코프 ACL 도입) 기능을 검증하기 위한
**시드 데이터 기반 end-to-end 시나리오**. 마이그레이션 `a006_test_seed.py` 가
본 문서의 가상 조직을 DB 에 넣어준다.

- 관련 설계: `docusaurus/docs/apps/v-itsm/design/V_ITSM_DESIGN.md`
- 시드 구현: `apps/v-itsm/backend/migrations/a006_test_seed.py`
- 접속: http://127.0.0.1:5182 (프런트) / http://127.0.0.1:8005/docs (API)

---

## 1. 가상 조직 개요

세 가지 고객 유형(온프레미스 / SaaS / 내부)을 커버하도록 의도적으로 배치했다.
각 고객사에는 대표 담당자 1명, 계약 1건, SLA 티어 1개가 묶여 있다.

| 고객사 코드 | 정식명 | 서비스 구분 | 업종 | 대표 담당자 | 계약 | SLA 티어 | 제품 |
|---|---|---|---|---|---|---|---|
| `ACME` | ACME 주식회사 | on_premise | 제조업 | 김대표 (대표이사) | `ACME-2026-001` | PLATINUM (24/7) | V-ITSM, V-PORTAL |
| `CLOUD-CO` | 클라우드컴퍼니 | saas | IT 서비스 | 이팀장 (플랫폼팀장) | `CLOUD-2026-001` | GOLD (업무시간 우선) | V-ITSM |
| `V-INTERNAL` | 내부(사내) | internal | 내부 | 박매니저 (IT지원 매니저) | `INTERNAL-2026-001` | BRONZE (베스트에포트) | V-BRIDGE |

**제품 카탈로그 (3건)**: `V-ITSM` / `V-PORTAL` / `V-BRIDGE` (모두 활성)

**샘플 스코프 grant (1건)**: SYSTEM_ADMIN 권한그룹(`permission_groups.id=1`) 에
전체 와일드카드 write. SYSTEM_ADMIN 은 본디 ACL 우회 대상이라 실효 의미는 없고,
**스코프 grant 리스트에 1행이 존재하는지 UI 확인용**.

---

## 2. 사전 준비

1. itsm 프로필 컨테이너 기동
   ```bash
   docker compose --profile itsm up -d --build
   ```
2. 마이그레이션 실행 (a006 포함)
   ```bash
   docker compose exec itsm-backend python -m v_platform.migrations.run_app_migrations --app v-itsm
   ```
3. DB 확인
   ```bash
   docker compose exec postgres psql -U vmsuser -d v_project -c \
     "SELECT code, service_type FROM itsm_customer ORDER BY code"
   docker compose exec postgres psql -U vmsuser -d v_project -c \
     "SELECT contract_no, sla_tier_id FROM itsm_contract"
   ```
   기대: 고객 3건 + 계약 3건 반환.

---

## 3. 시나리오 A — ACME (온프레미스 · Platinum)

### 전제
- 제조업 고객 ACME 가 v-itsm 과 v-platform-portal 을 **온프레미스**로 운영 중
- Platinum 계약으로 24/7 Critical 15분 / Resolution 240분 SLA

### 단계
1. SYSTEM_ADMIN 계정으로 로그인 → http://127.0.0.1:5182
2. **관리 > 고객사 관리** → `ACME` 클릭, 담당자 탭에서 김대표 확인
3. **관리 > 계약 관리** → `ACME-2026-001` 상세, 제품이 V-ITSM + V-PORTAL 2건인지 확인
4. **접수(intake)**:
   - service_type=`on_premise`
   - customer=`ACME`
   - product=`V-PORTAL`
   - contract=`ACME-2026-001`
   - priority=`critical`
   - 제목: "포탈 로그인 전면 장애"
5. 생성된 티켓의 SLA 응답 기한이 **현재 + 15분**, 해결 기한 **+240분** 으로 찍히는지 확인
6. 상세 페이지 헤더에서 고객/제품/계약/SLA 티어 메타데이터 4칩이 노출되는지 확인

### 기대
- Platinum 티어의 `priority_matrix.critical.response=15` 를 타이머가 채택
- `itsm_sla_timer` 에 response / resolution 두 건 생성

---

## 4. 시나리오 B — CLOUD-CO (SaaS · Gold)

### 전제
- SaaS 고객 CLOUD-CO 가 v-itsm **만** 구독 (V-PORTAL 미계약)
- Gold 계약 업무시간 우선 지원

### 단계
1. **관리 > 스코프 권한 관리** → 비-SYSTEM_ADMIN 권한그룹(예: `MEMBER`) 에
   `service_type=saas, customer=CLOUD-CO, product=V-ITSM, scope_level=write`
   grant 1건 등록
2. CLOUD-CO 의 MEMBER 소속 사용자로 재로그인 (또는 SYSTEM_ADMIN 이 대리 접수)
3. **접수**:
   - service_type=`saas`
   - customer=`CLOUD-CO`
   - product=`V-ITSM`
   - priority=`high`
4. 같은 사용자로 **V-PORTAL** 을 선택해 접수 시도 → **403**
   (스코프 밖 제품이기 때문)
5. 같은 사용자로 목록 조회 → ACME/V-INTERNAL 티켓이 **보이지 않는지** 확인

### 기대
- 스코프 grant 가 고객·제품 교집합으로 동작
- 목록 쿼리에 `access_control.apply_scope_to_query` WHERE 주입 확인

---

## 5. 시나리오 C — V-INTERNAL (내부요청 · Bronze)

### 전제
- `service_type=internal` 일 때 `customer_id`/`product_id` 는 NULL 허용
  (설계 D3). 다만 시드에서는 추적성을 위해 `V-INTERNAL` 고객사를 남겨둠.

### 단계
1. **접수**:
   - service_type=`internal`
   - customer=`V-INTERNAL` **또는** NULL
   - product=`V-BRIDGE` **또는** NULL
   - priority=`normal`
   - 제목: "사내 Slack 권한 재설정 요청"
2. Bronze 티어 priority_matrix 기준 응답 480분 / 해결 2880분 찍히는지 확인
3. 해당 티켓을 CLOUD-CO MEMBER 로 조회 시 보이지 않는지 재확인
   (스코프 `service_type=internal` 이 없으므로)

### 기대
- 내부요청이 customer/product NULL 로도 접수 가능
- Bronze 티어 타이머 적용

---

## 6. 시나리오 D — SLA 티어 UI 편집

Platinum 의 `critical.response` 를 일시 조정해 UI 편집 경로를 검증한다.

1. **관리 > SLA 티어 관리** → PLATINUM 수정
2. priority_matrix JSON 편집기에서 `critical.response` 를 15 → 10 으로 변경, 저장
3. 시나리오 A 를 다시 수행 → 응답 기한이 **+10분** 으로 반영되는지 확인
4. 원복 (15 로 되돌리기)

### 기대
- 티어 편집이 계약 → 티켓 타이머 산출에 즉시 반영

---

## 7. 회귀 체크리스트

| 항목 | 방법 | 통과 기준 |
|---|---|---|
| 멱등 마이그레이션 | `run_app_migrations --app v-itsm` 두 번 실행 | 에러 없이 동일 결과 |
| 고객/제품/계약/SLA/스코프 UI 레이아웃 | 5개 페이지 모두 `max-w-content` 레이아웃 적용 여부 | 좌우 여백·정렬 일관 |
| 고객 등록 오류 메시지 | 필수값 누락으로 등록 시도 | 사유가 Alert 안에 **실제 텍스트로 표시** (빈 Alert 금지) |
| 계약/스코프 참조 데이터 조회 | 페이지 진입 직후 로딩 상태 | `API request failed` 없이 고객/제품/SLA 티어 리스트 노출 |
| 스코프 외 403 | 시나리오 B-4 | 403 + 메시지 "접근 권한이 없습니다" |

---

## 8. 시드 데이터 초기화 / 재시드

a006 은 `ON CONFLICT DO NOTHING` 과 `NOT EXISTS` 로 멱등성이 보장된다. 재시드가
필요하면 테스트 DB 에서만 수동 삭제 후 재실행:

```bash
docker compose exec postgres psql -U vmsuser -d v_project <<SQL
DELETE FROM itsm_contract_product;
DELETE FROM itsm_contract        WHERE contract_no LIKE ANY (ARRAY['ACME-%', 'CLOUD-%', 'INTERNAL-%']);
DELETE FROM itsm_customer_contact WHERE email LIKE '%@acme.example.com' OR email LIKE '%@cloud-co.example.com' OR email='pm@vms-solutions.com';
DELETE FROM itsm_customer        WHERE code IN ('ACME','CLOUD-CO','V-INTERNAL');
DELETE FROM itsm_product         WHERE code IN ('V-ITSM','V-PORTAL','V-BRIDGE');
SQL

docker compose exec itsm-backend python -m v_platform.migrations.run_app_migrations --app v-itsm
```

> **주의**: 운영 DB 에는 사용하지 말 것. 테스트/개발 환경 전용.
