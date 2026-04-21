"""a004: 고객/제품/계약/SLA티어/스코프ACL 확장.

설계 문서 §4.1.8 ~ §4.1.14 / §4.3 (ACL) / §6 (SLA 2단 구조) 기준.

신규 테이블 7개 (모두 `itsm_` 접두사):
  - itsm_customer
  - itsm_customer_contact
  - itsm_product
  - itsm_sla_tier
  - itsm_contract
  - itsm_contract_product (association)
  - itsm_scope_grant

itsm_ticket 에 4컬럼 ALTER ADD:
  - service_type (NOT NULL DEFAULT 'internal' — 기존 로우 자동 백필)
  - customer_id / product_id / contract_id (NULL, FK)

SLA 티어 시드 4건: PLATINUM / GOLD / SILVER / BRONZE.

멱등: IF NOT EXISTS + ON CONFLICT DO NOTHING. 여러 번 실행해도 안전.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


STATEMENTS: list[str] = [
    # -------- 4.1.8 Customer --------
    """
    CREATE TABLE IF NOT EXISTS itsm_customer (
        id            VARCHAR(26) PRIMARY KEY,
        code          VARCHAR(50)  NOT NULL UNIQUE,
        name          VARCHAR(200) NOT NULL,
        service_type  VARCHAR(20)  NOT NULL,
        industry      VARCHAR(100),
        status        VARCHAR(20)  NOT NULL DEFAULT 'active',
        notes         TEXT,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_itsm_customer_service_type ON itsm_customer(service_type)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_customer_status ON itsm_customer(status)",

    # -------- 4.1.9 Customer Contact --------
    """
    CREATE TABLE IF NOT EXISTS itsm_customer_contact (
        id           VARCHAR(26) PRIMARY KEY,
        customer_id  VARCHAR(26)  NOT NULL
                     REFERENCES itsm_customer(id) ON DELETE CASCADE,
        name         VARCHAR(100) NOT NULL,
        email        VARCHAR(200),
        phone        VARCHAR(50),
        role_title   VARCHAR(100),
        is_primary   BOOLEAN      NOT NULL DEFAULT FALSE,
        notes        TEXT,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_itsm_customer_contact_customer ON itsm_customer_contact(customer_id)",

    # -------- 4.1.10 Product --------
    """
    CREATE TABLE IF NOT EXISTS itsm_product (
        id           VARCHAR(26) PRIMARY KEY,
        code         VARCHAR(50)  NOT NULL UNIQUE,
        name         VARCHAR(200) NOT NULL,
        description  TEXT,
        active       BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
    """,

    # -------- 4.1.11 SLA Tier --------
    """
    CREATE TABLE IF NOT EXISTS itsm_sla_tier (
        id              VARCHAR(26) PRIMARY KEY,
        code            VARCHAR(30)  NOT NULL UNIQUE,
        name            VARCHAR(100) NOT NULL,
        description     TEXT,
        priority_matrix JSONB        NOT NULL,
        business_hours  JSONB,
        active          BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
    """,

    # -------- 4.1.12 Contract --------
    """
    CREATE TABLE IF NOT EXISTS itsm_contract (
        id            VARCHAR(26) PRIMARY KEY,
        contract_no   VARCHAR(50)  NOT NULL UNIQUE,
        customer_id   VARCHAR(26)  NOT NULL REFERENCES itsm_customer(id),
        name          VARCHAR(200) NOT NULL,
        start_date    DATE,
        end_date      DATE,
        sla_tier_id   VARCHAR(26)  REFERENCES itsm_sla_tier(id),
        status        VARCHAR(20)  NOT NULL DEFAULT 'active',
        notes         TEXT,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_itsm_contract_customer ON itsm_contract(customer_id)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_contract_sla_tier ON itsm_contract(sla_tier_id)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_contract_status ON itsm_contract(status)",

    # -------- 4.1.13 Contract-Product (N:M) --------
    """
    CREATE TABLE IF NOT EXISTS itsm_contract_product (
        contract_id  VARCHAR(26) NOT NULL
                     REFERENCES itsm_contract(id) ON DELETE CASCADE,
        product_id   VARCHAR(26) NOT NULL
                     REFERENCES itsm_product(id),
        PRIMARY KEY (contract_id, product_id)
    )
    """,

    # -------- 4.1.14 Scope Grant (ACL) --------
    """
    CREATE TABLE IF NOT EXISTS itsm_scope_grant (
        id                   VARCHAR(26) PRIMARY KEY,
        permission_group_id  INTEGER      NOT NULL
                             REFERENCES permission_groups(id) ON DELETE CASCADE,
        service_type         VARCHAR(20),
        customer_id          VARCHAR(26)  REFERENCES itsm_customer(id),
        product_id           VARCHAR(26)  REFERENCES itsm_product(id),
        scope_level          VARCHAR(10)  NOT NULL DEFAULT 'read',
        granted_by           INTEGER      REFERENCES users(id),
        created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_itsm_scope_grant_tuple
            UNIQUE (permission_group_id, service_type, customer_id, product_id)
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_itsm_scope_grant_group ON itsm_scope_grant(permission_group_id)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_scope_grant_customer ON itsm_scope_grant(customer_id)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_scope_grant_product ON itsm_scope_grant(product_id)",

    # -------- 4.1.1 Ticket ALTER — service_type / customer / product / contract --------
    "ALTER TABLE itsm_ticket ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) NOT NULL DEFAULT 'internal'",
    "ALTER TABLE itsm_ticket ADD COLUMN IF NOT EXISTS customer_id VARCHAR(26) REFERENCES itsm_customer(id)",
    "ALTER TABLE itsm_ticket ADD COLUMN IF NOT EXISTS product_id VARCHAR(26) REFERENCES itsm_product(id)",
    "ALTER TABLE itsm_ticket ADD COLUMN IF NOT EXISTS contract_id VARCHAR(26) REFERENCES itsm_contract(id)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_ticket_service_type ON itsm_ticket(service_type)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_ticket_customer ON itsm_ticket(customer_id)",
    "CREATE INDEX IF NOT EXISTS ix_itsm_ticket_product ON itsm_ticket(product_id)",

    # DEFAULT 보정 — 이전 실행이 일부만 커밋되어 컬럼 DEFAULT가 누락된 테이블 복구
    "ALTER TABLE itsm_customer         ALTER COLUMN created_at SET DEFAULT NOW(), ALTER COLUMN updated_at SET DEFAULT NOW()",
    "ALTER TABLE itsm_customer_contact ALTER COLUMN created_at SET DEFAULT NOW(), ALTER COLUMN updated_at SET DEFAULT NOW()",
    "ALTER TABLE itsm_product          ALTER COLUMN created_at SET DEFAULT NOW(), ALTER COLUMN updated_at SET DEFAULT NOW()",
    "ALTER TABLE itsm_sla_tier         ALTER COLUMN created_at SET DEFAULT NOW(), ALTER COLUMN updated_at SET DEFAULT NOW()",
    "ALTER TABLE itsm_contract         ALTER COLUMN created_at SET DEFAULT NOW(), ALTER COLUMN updated_at SET DEFAULT NOW()",
    "ALTER TABLE itsm_scope_grant      ALTER COLUMN created_at SET DEFAULT NOW(), ALTER COLUMN updated_at SET DEFAULT NOW()",
]


# SLA 티어 시드 — 분 단위
# ULID 는 상수로 둔다 (재실행 멱등 보장). ON CONFLICT (code) DO NOTHING.
SEED_SLA_TIERS: list[tuple[str, str, str, str, str]] = [
    (
        "01HSLATIERPLATINUM00000000",
        "PLATINUM",
        "Platinum",
        "최상위 등급 — 24/7, 15분 응답 / 4시간 해결 (critical)",
        '{"critical":{"response":15,"resolution":240},'
        '"high":{"response":30,"resolution":480},'
        '"normal":{"response":60,"resolution":1440},'
        '"low":{"response":120,"resolution":2880}}',
    ),
    (
        "01HSLATIERGOLD000000000000",
        "GOLD",
        "Gold",
        "상위 등급 — 30분 응답 / 8시간 해결 (critical)",
        '{"critical":{"response":30,"resolution":480},'
        '"high":{"response":60,"resolution":960},'
        '"normal":{"response":120,"resolution":2880},'
        '"low":{"response":240,"resolution":5760}}',
    ),
    (
        "01HSLATIERSILVER0000000000",
        "SILVER",
        "Silver",
        "중급 — 60분 응답 / 24시간 해결 (critical)",
        '{"critical":{"response":60,"resolution":1440},'
        '"high":{"response":120,"resolution":2880},'
        '"normal":{"response":240,"resolution":5760},'
        '"low":{"response":480,"resolution":11520}}',
    ),
    (
        "01HSLATIERBRONZE0000000000",
        "BRONZE",
        "Bronze",
        "기본 — 120분 응답 / 48시간 해결 (critical)",
        '{"critical":{"response":120,"resolution":2880},'
        '"high":{"response":240,"resolution":5760},'
        '"normal":{"response":480,"resolution":11520},'
        '"low":{"response":960,"resolution":23040}}',
    ),
]


SEED_STATEMENT = """
INSERT INTO itsm_sla_tier
    (id, code, name, description, priority_matrix, active, created_at, updated_at)
VALUES
    (:id, :code, :name, :description, CAST(:priority_matrix AS JSONB), TRUE, NOW(), NOW())
ON CONFLICT (code) DO NOTHING
"""


def migrate(engine):
    with engine.connect() as conn:
        for stmt in STATEMENTS:
            conn.execute(text(stmt))

        for tier_id, code, name, description, matrix in SEED_SLA_TIERS:
            conn.execute(
                text(SEED_STATEMENT),
                {
                    "id": tier_id,
                    "code": code,
                    "name": name,
                    "description": description,
                    "priority_matrix": matrix,
                },
            )

        conn.commit()
    logger.info(
        "a004: customer/product/contract/sla_tier/scope_grant tables + "
        "ticket columns + SLA tier seed applied"
    )
