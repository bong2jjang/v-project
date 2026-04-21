"""a006: v-itsm v0.2 테스트 시드 데이터.

테스트 시나리오(`docusaurus/docs/apps/v-itsm/V_ITSM_TEST_SCENARIO.md`) 에 맞춘
고객사/고객담당자/제품/계약 기본 데이터. SLA 티어(PLATINUM/GOLD/SILVER/BRONZE)는
a004 에서 이미 시드되어 있으므로 여기서는 참조만.

시드 내용:
  - 고객사 3건: ACME(on_premise), CLOUD-CO(saas), V-INTERNAL(internal)
  - 고객 담당자 3건 (각 고객사당 1명, is_primary=TRUE)
  - 제품 3건: V-ITSM, V-PORTAL, V-BRIDGE
  - 계약 3건 + 계약-제품 매핑
  - 스코프 grant 1건(샘플): SYSTEM_ADMIN 그룹에 전체 와일드카드 write
    (SYSTEM_ADMIN 은 ACL 우회 대상이라 실질 의미는 없지만, 화면 확인용 1행)

멱등: ON CONFLICT (code/contract_no) DO NOTHING, FK 참조도 서브쿼리로 안전 처리.
재실행 안전.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


def _id(tag: str) -> str:
    """26자 고정 ID 생성(ULID 호환 길이). tag 뒤를 '0'으로 패딩.

    실제 ULID 가 아닌 고정 식별자로, 시드 멱등성 보장 목적.
    """
    assert len(tag) <= 26, f"tag too long: {tag} ({len(tag)})"
    return tag.ljust(26, "0")


# ---------------------------------------------------------------------------
# 고객사 (itsm_customer)
# ---------------------------------------------------------------------------
CUSTOMERS = [
    {
        "id": _id("01HCUSTACME"),
        "code": "ACME",
        "name": "ACME 주식회사",
        "service_type": "on_premise",
        "industry": "제조업",
        "status": "active",
        "notes": "온프레미스 주요 고객. 본사 서울.",
    },
    {
        "id": _id("01HCUSTCLOUDCO"),
        "code": "CLOUD-CO",
        "name": "클라우드컴퍼니",
        "service_type": "saas",
        "industry": "IT 서비스",
        "status": "active",
        "notes": "SaaS 다중 테넌트 이용 고객.",
    },
    {
        "id": _id("01HCUSTVINTERNAL"),
        "code": "V-INTERNAL",
        "name": "내부(사내)",
        "service_type": "internal",
        "industry": "내부",
        "status": "active",
        "notes": "내부요청(IT지원·인프라·사업부서 내부)용 가상 고객사.",
    },
]


# ---------------------------------------------------------------------------
# 고객 담당자 (itsm_customer_contact)
# ---------------------------------------------------------------------------
CONTACTS = [
    {
        "id": _id("01HCONTACT0ACME"),
        "customer_code": "ACME",
        "name": "김대표",
        "email": "ceo@acme.example.com",
        "phone": "02-1000-0001",
        "role_title": "대표이사",
        "is_primary": True,
        "notes": "에스컬레이션 1차 연락처.",
    },
    {
        "id": _id("01HCONTACT0CLOUDCO"),
        "customer_code": "CLOUD-CO",
        "name": "이팀장",
        "email": "leader@cloud-co.example.com",
        "phone": "02-2000-0002",
        "role_title": "플랫폼팀장",
        "is_primary": True,
        "notes": "SaaS 운영/장애 연락 창구.",
    },
    {
        "id": _id("01HCONTACT0VINTERNAL"),
        "customer_code": "V-INTERNAL",
        "name": "박매니저",
        "email": "pm@vms-solutions.com",
        "phone": "02-3000-0003",
        "role_title": "IT지원 매니저",
        "is_primary": True,
        "notes": "내부요청 접수/조율 담당.",
    },
]


# ---------------------------------------------------------------------------
# 제품 (itsm_product)
# ---------------------------------------------------------------------------
PRODUCTS = [
    {
        "id": _id("01HPRODVITSM"),
        "code": "V-ITSM",
        "name": "v-itsm 업무 루프",
        "description": "ITSM 기반 5단계 업무 루프 앱.",
        "active": True,
    },
    {
        "id": _id("01HPRODVPORTAL"),
        "code": "V-PORTAL",
        "name": "v-platform-portal",
        "description": "통합 앱 포탈.",
        "active": True,
    },
    {
        "id": _id("01HPRODVBRIDGE"),
        "code": "V-BRIDGE",
        "name": "v-channel-bridge",
        "description": "Slack ↔ Teams 메시지 브리지.",
        "active": True,
    },
]


# ---------------------------------------------------------------------------
# 계약 (itsm_contract) + 제품 매핑
# ---------------------------------------------------------------------------
CONTRACTS = [
    {
        "id": _id("01HCTRCACME2026001"),
        "contract_no": "ACME-2026-001",
        "customer_code": "ACME",
        "name": "ACME 2026년 연간 유지보수",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "sla_tier_code": "PLATINUM",
        "status": "active",
        "notes": "Platinum 등급 — 24/7 지원.",
        "product_codes": ["V-ITSM", "V-PORTAL"],
    },
    {
        "id": _id("01HCTRCCLOUDCO2026"),
        "contract_no": "CLOUD-2026-001",
        "customer_code": "CLOUD-CO",
        "name": "CLOUD-CO 2026년 SaaS 구독",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "sla_tier_code": "GOLD",
        "status": "active",
        "notes": "Gold 등급 — 업무시간 내 우선 지원.",
        "product_codes": ["V-ITSM"],
    },
    {
        "id": _id("01HCTRCINTERNAL2026"),
        "contract_no": "INTERNAL-2026-001",
        "customer_code": "V-INTERNAL",
        "name": "사내 내부요청 기본 계약",
        "start_date": "2026-01-01",
        "end_date": "2030-12-31",
        "sla_tier_code": "BRONZE",
        "status": "active",
        "notes": "내부요청용 기본 계약 (Bronze).",
        "product_codes": ["V-BRIDGE"],
    },
]


# ---------------------------------------------------------------------------
# SQL
# ---------------------------------------------------------------------------
INSERT_CUSTOMER = """
INSERT INTO itsm_customer
    (id, code, name, service_type, industry, status, notes, created_at, updated_at)
VALUES
    (:id, :code, :name, :service_type, :industry, :status, :notes, NOW(), NOW())
ON CONFLICT (code) DO NOTHING
"""

INSERT_CONTACT = """
INSERT INTO itsm_customer_contact
    (id, customer_id, name, email, phone, role_title, is_primary, notes,
     created_at, updated_at)
SELECT :id, c.id, :name, :email, :phone, :role_title, :is_primary, :notes,
       NOW(), NOW()
FROM itsm_customer c
WHERE c.code = :customer_code
  AND NOT EXISTS (
      SELECT 1 FROM itsm_customer_contact
      WHERE customer_id = c.id AND email = :email
  )
"""

INSERT_PRODUCT = """
INSERT INTO itsm_product
    (id, code, name, description, active, created_at, updated_at)
VALUES
    (:id, :code, :name, :description, :active, NOW(), NOW())
ON CONFLICT (code) DO NOTHING
"""

INSERT_CONTRACT = """
INSERT INTO itsm_contract
    (id, contract_no, customer_id, name, start_date, end_date,
     sla_tier_id, status, notes, created_at, updated_at)
SELECT :id, :contract_no, c.id, :name, CAST(:start_date AS DATE), CAST(:end_date AS DATE),
       t.id, :status, :notes, NOW(), NOW()
FROM itsm_customer c
LEFT JOIN itsm_sla_tier t ON t.code = :sla_tier_code
WHERE c.code = :customer_code
ON CONFLICT (contract_no) DO NOTHING
"""

INSERT_CONTRACT_PRODUCT = """
INSERT INTO itsm_contract_product (contract_id, product_id)
SELECT ct.id, p.id
FROM itsm_contract ct
JOIN itsm_product p ON p.code = :product_code
WHERE ct.contract_no = :contract_no
ON CONFLICT DO NOTHING
"""

INSERT_SCOPE_GRANT_SAMPLE = """
INSERT INTO itsm_scope_grant
    (id, permission_group_id, service_type, customer_id, product_id,
     scope_level, granted_by, created_at, updated_at)
SELECT :id, pg.id, NULL, NULL, NULL, 'write', NULL, NOW(), NOW()
FROM permission_groups pg
WHERE pg.id = 1
ON CONFLICT (permission_group_id, service_type, customer_id, product_id)
DO NOTHING
"""


def migrate(engine):
    with engine.connect() as conn:
        for row in CUSTOMERS:
            conn.execute(text(INSERT_CUSTOMER), row)

        for row in CONTACTS:
            conn.execute(
                text(INSERT_CONTACT),
                {
                    "id": row["id"],
                    "customer_code": row["customer_code"],
                    "name": row["name"],
                    "email": row["email"],
                    "phone": row["phone"],
                    "role_title": row["role_title"],
                    "is_primary": row["is_primary"],
                    "notes": row["notes"],
                },
            )

        for row in PRODUCTS:
            conn.execute(text(INSERT_PRODUCT), row)

        for row in CONTRACTS:
            conn.execute(
                text(INSERT_CONTRACT),
                {
                    "id": row["id"],
                    "contract_no": row["contract_no"],
                    "customer_code": row["customer_code"],
                    "name": row["name"],
                    "start_date": row["start_date"],
                    "end_date": row["end_date"],
                    "sla_tier_code": row["sla_tier_code"],
                    "status": row["status"],
                    "notes": row["notes"],
                },
            )
            for code in row["product_codes"]:
                conn.execute(
                    text(INSERT_CONTRACT_PRODUCT),
                    {"contract_no": row["contract_no"], "product_code": code},
                )

        conn.execute(
            text(INSERT_SCOPE_GRANT_SAMPLE),
            {"id": _id("01HSCOPEGRANTSAMPLE")},
        )

        conn.commit()
        logger.info(
            "a006: test seed applied — 3 customers / 3 contacts / 3 products / "
            "3 contracts / 1 sample scope grant"
        )
