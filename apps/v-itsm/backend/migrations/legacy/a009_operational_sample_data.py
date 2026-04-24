"""a009: v-itsm 운영 시나리오 샘플 데이터 시드.

전체 페이지(티켓 리스트 / 상세 / Kanban / SLA 모니터 / KPI) 가 의미 있는
데이터로 렌더링되도록 운영 티켓과 부수 엔티티를 시드한다. 기본 고객/제품/
계약/스코프는 a006 에서 이미 시드되어 있으므로 본 마이그레이션은 다음만 추가한다:

  1. 파트너 고객 1건 (NEXT-CO) + 담당자 1건 (KPI 서비스구분 차트 4종 완성)
  2. 운영 티켓 18건 — 전 Loop 단계(intake/analyze/execute/verify/answer/closed)
     × 우선순위 4종 × service_type 4종을 골고루 분포
  3. Loop 전이 이력 — 각 티켓의 현재 단계에 도달한 경로
  4. SLA 타이머 — active / warning / breached / satisfied 각 상태 포함
  5. 배정 이력 — current_owner_id 가 있는 티켓에 primary assignment 1건
  6. 피드백 — closed 티켓 중 일부에 만족도 점수 기입 (reopen_ratio 산출용)

ID 생성은 고정된 26자 tag(ULID 호환 길이) 로 멱등성 확보. `ON CONFLICT` /
`NOT EXISTS` 조건으로 재실행 안전.

system_admin 사용자(`bong78@vms-solutions.com` 또는 role=`system_admin`)를
requester/owner/actor 로 참조한다. 사용자가 존재하지 않으면 NULL 로 저장되며,
테스트용이므로 문제 없음.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 유틸
# ---------------------------------------------------------------------------
def _id(tag: str) -> str:
    assert len(tag) <= 26, f"tag too long: {tag} ({len(tag)})"
    return tag.ljust(26, "0")


NOW = datetime.now(timezone.utc)


def _minutes_ago(m: int) -> datetime:
    return NOW - timedelta(minutes=m)


def _days_ago(d: int) -> datetime:
    return NOW - timedelta(days=d)


def _minutes_ahead(m: int) -> datetime:
    return NOW + timedelta(minutes=m)


# ---------------------------------------------------------------------------
# 추가 파트너 고객 (a006 에 없음)
# ---------------------------------------------------------------------------
PARTNER_CUSTOMER = {
    "id": _id("01HCUSTNEXTCO"),
    "code": "NEXT-CO",
    "name": "넥스트파트너스",
    "service_type": "partner",
    "industry": "협력사 SI",
    "status": "active",
    "notes": "협력사 요청 채널 (KPI 서비스구분 차트 4종 커버용).",
}

PARTNER_CONTACT = {
    "id": _id("01HCONTACT0NEXTCO"),
    "customer_code": "NEXT-CO",
    "name": "최상무",
    "email": "partner@next-co.example.com",
    "phone": "02-4000-0004",
    "role_title": "사업협력임원",
    "is_primary": True,
    "notes": "파트너사 대표 연락처.",
}


# ---------------------------------------------------------------------------
# 운영 티켓 18건
#
#   timer_state: active / warning / breached / satisfied / None
#   opened_min_ago: 접수부터 얼마나 지났는지(분)
#   due_min_ahead: response/resolution 만료까지 남은 분 (음수면 초과)
# ---------------------------------------------------------------------------
TICKETS = [
    # --- intake 단계 (4건) ---
    {
        "tag": "01HTK001INTAKE",
        "ticket_no": "ITSM-2026-0001",
        "title": "[접수] 로그인 SSO 간헐적 실패",
        "description": "ACME 운영팀에서 SSO 간헐 실패 보고. 재현 조건 확인 필요.",
        "source_channel": "slack",
        "priority": "high",
        "category_l1": "인증",
        "category_l2": "SSO",
        "current_stage": "intake",
        "service_type": "on_premise",
        "customer_code": "ACME",
        "product_code": "V-ITSM",
        "contract_no": "ACME-2026-001",
        "opened_min_ago": 20,
        "has_owner": False,
        "timer_state": "active",
        "due_response_min_ahead": 30,
        "due_resolution_min_ahead": 210,
    },
    {
        "tag": "01HTK002INTAKE",
        "ticket_no": "ITSM-2026-0002",
        "title": "[접수] 감사로그 조회 요청",
        "description": "내부 IT팀 요청 — 지난주 권한변경 감사로그 추출.",
        "source_channel": "web",
        "priority": "normal",
        "category_l1": "감사",
        "category_l2": "조회",
        "current_stage": "intake",
        "service_type": "internal",
        "customer_code": "V-INTERNAL",
        "product_code": None,
        "contract_no": "INTERNAL-2026-001",
        "opened_min_ago": 90,
        "has_owner": False,
        "timer_state": "warning",
        "due_response_min_ahead": 10,
        "due_resolution_min_ahead": 1200,
    },
    {
        "tag": "01HTK003INTAKE",
        "ticket_no": "ITSM-2026-0003",
        "title": "[접수] 파트너 API 키 재발급",
        "description": "NEXT-CO 연동용 API 키 만료 임박. 재발급 요청.",
        "source_channel": "email",
        "priority": "normal",
        "category_l1": "연동",
        "category_l2": "인증키",
        "current_stage": "intake",
        "service_type": "partner",
        "customer_code": "NEXT-CO",
        "product_code": "V-BRIDGE",
        "contract_no": None,
        "opened_min_ago": 240,
        "has_owner": False,
        "timer_state": "breached",
        "due_response_min_ahead": -60,
        "due_resolution_min_ahead": 720,
    },
    {
        "tag": "01HTK004INTAKE",
        "ticket_no": "ITSM-2026-0004",
        "title": "[접수] SaaS 대시보드 로딩 지연",
        "description": "CLOUD-CO 고객이 대시보드 페이지 진입 시 5초 이상 소요 보고.",
        "source_channel": "teams",
        "priority": "low",
        "category_l1": "성능",
        "category_l2": "프론트엔드",
        "current_stage": "intake",
        "service_type": "saas",
        "customer_code": "CLOUD-CO",
        "product_code": "V-ITSM",
        "contract_no": "CLOUD-2026-001",
        "opened_min_ago": 45,
        "has_owner": False,
        "timer_state": "active",
        "due_response_min_ahead": 195,
        "due_resolution_min_ahead": 2835,
    },
    # --- analyze 단계 (3건) ---
    {
        "tag": "01HTK005ANALYZE",
        "ticket_no": "ITSM-2026-0005",
        "title": "[분석] 월말 리포트 생성 실패",
        "description": "매월 1일 자동 리포트 생성 실패. 원인 분석 중.",
        "source_channel": "email",
        "priority": "critical",
        "category_l1": "데이터",
        "category_l2": "리포트",
        "current_stage": "analyze",
        "service_type": "on_premise",
        "customer_code": "ACME",
        "product_code": "V-ITSM",
        "contract_no": "ACME-2026-001",
        "opened_min_ago": 180,
        "has_owner": True,
        "timer_state": "warning",
        "due_response_min_ahead": -10,
        "due_resolution_min_ahead": 30,
    },
    {
        "tag": "01HTK006ANALYZE",
        "ticket_no": "ITSM-2026-0006",
        "title": "[분석] 포털 SSO Relay 리디렉션 오류",
        "description": "portal → itsm 진입 시 redirect loop 발생.",
        "source_channel": "slack",
        "priority": "high",
        "category_l1": "연동",
        "category_l2": "SSO",
        "current_stage": "analyze",
        "service_type": "internal",
        "customer_code": "V-INTERNAL",
        "product_code": "V-PORTAL",
        "contract_no": "INTERNAL-2026-001",
        "opened_min_ago": 420,
        "has_owner": True,
        "timer_state": "active",
        "due_response_min_ahead": 60,
        "due_resolution_min_ahead": 600,
    },
    {
        "tag": "01HTK007ANALYZE",
        "ticket_no": "ITSM-2026-0007",
        "title": "[분석] 채팅 브리지 Slack → Teams 지연",
        "description": "Slack 메시지가 Teams 채널로 전달되는데 2~3분 지연.",
        "source_channel": "slack",
        "priority": "normal",
        "category_l1": "브리지",
        "category_l2": "전송",
        "current_stage": "analyze",
        "service_type": "partner",
        "customer_code": "NEXT-CO",
        "product_code": "V-BRIDGE",
        "contract_no": None,
        "opened_min_ago": 720,
        "has_owner": True,
        "timer_state": "warning",
        "due_response_min_ahead": -20,
        "due_resolution_min_ahead": 120,
    },
    # --- execute 단계 (4건) ---
    {
        "tag": "01HTK008EXECUTE",
        "ticket_no": "ITSM-2026-0008",
        "title": "[실행] 감사로그 인덱스 최적화",
        "description": "audit_logs 테이블 조회 속도 개선을 위한 복합 인덱스 추가.",
        "source_channel": "web",
        "priority": "high",
        "category_l1": "DB",
        "category_l2": "인덱스",
        "current_stage": "execute",
        "service_type": "on_premise",
        "customer_code": "ACME",
        "product_code": "V-ITSM",
        "contract_no": "ACME-2026-001",
        "opened_min_ago": 1200,
        "has_owner": True,
        "timer_state": "active",
        "due_response_min_ahead": None,
        "due_resolution_min_ahead": 180,
    },
    {
        "tag": "01HTK009EXECUTE",
        "ticket_no": "ITSM-2026-0009",
        "title": "[실행] 알림 채널 Teams 추가",
        "description": "v-channel-bridge 경유 Teams 채널 알림 라우팅 추가.",
        "source_channel": "teams",
        "priority": "normal",
        "category_l1": "알림",
        "category_l2": "채널",
        "current_stage": "execute",
        "service_type": "saas",
        "customer_code": "CLOUD-CO",
        "product_code": "V-ITSM",
        "contract_no": "CLOUD-2026-001",
        "opened_min_ago": 2880,
        "has_owner": True,
        "timer_state": "breached",
        "due_response_min_ahead": None,
        "due_resolution_min_ahead": -120,
    },
    {
        "tag": "01HTK010EXECUTE",
        "ticket_no": "ITSM-2026-0010",
        "title": "[실행] 내부 스크립트 배치 재구성",
        "description": "야간 ETL 스크립트 실패율 감소를 위한 재시도 전략 반영.",
        "source_channel": "web",
        "priority": "low",
        "category_l1": "운영",
        "category_l2": "배치",
        "current_stage": "execute",
        "service_type": "internal",
        "customer_code": "V-INTERNAL",
        "product_code": None,
        "contract_no": "INTERNAL-2026-001",
        "opened_min_ago": 900,
        "has_owner": True,
        "timer_state": "active",
        "due_response_min_ahead": None,
        "due_resolution_min_ahead": 1500,
    },
    {
        "tag": "01HTK011EXECUTE",
        "ticket_no": "ITSM-2026-0011",
        "title": "[실행] 파트너 Webhook 재시도 큐",
        "description": "NEXT-CO Webhook 실패 시 DLQ + 재시도 주기 구성.",
        "source_channel": "email",
        "priority": "high",
        "category_l1": "연동",
        "category_l2": "Webhook",
        "current_stage": "execute",
        "service_type": "partner",
        "customer_code": "NEXT-CO",
        "product_code": "V-BRIDGE",
        "contract_no": None,
        "opened_min_ago": 1500,
        "has_owner": True,
        "timer_state": "warning",
        "due_response_min_ahead": None,
        "due_resolution_min_ahead": 45,
    },
    # --- verify 단계 (2건) ---
    {
        "tag": "01HTK012VERIFY",
        "ticket_no": "ITSM-2026-0012",
        "title": "[검증] 로그인 이상 탐지 룰 검증",
        "description": "비정상 로그인 탐지 룰 효과 검증 중.",
        "source_channel": "web",
        "priority": "high",
        "category_l1": "보안",
        "category_l2": "탐지",
        "current_stage": "verify",
        "service_type": "on_premise",
        "customer_code": "ACME",
        "product_code": "V-ITSM",
        "contract_no": "ACME-2026-001",
        "opened_min_ago": 2400,
        "has_owner": True,
        "timer_state": "active",
        "due_response_min_ahead": None,
        "due_resolution_min_ahead": 360,
    },
    {
        "tag": "01HTK013VERIFY",
        "ticket_no": "ITSM-2026-0013",
        "title": "[검증] 모바일 레이아웃 QA",
        "description": "모바일 해상도 변경 사항 QA 스모크 테스트.",
        "source_channel": "slack",
        "priority": "normal",
        "category_l1": "UI",
        "category_l2": "QA",
        "current_stage": "verify",
        "service_type": "saas",
        "customer_code": "CLOUD-CO",
        "product_code": "V-ITSM",
        "contract_no": "CLOUD-2026-001",
        "opened_min_ago": 1800,
        "has_owner": True,
        "timer_state": "active",
        "due_response_min_ahead": None,
        "due_resolution_min_ahead": 1200,
    },
    # --- answer 단계 (2건) ---
    {
        "tag": "01HTK014ANSWER",
        "ticket_no": "ITSM-2026-0014",
        "title": "[답변] 고객 대상 패치 공지",
        "description": "ACME 고객사에 2026-04 패치 반영 내용 공지.",
        "source_channel": "email",
        "priority": "normal",
        "category_l1": "커뮤니케이션",
        "category_l2": "공지",
        "current_stage": "answer",
        "service_type": "on_premise",
        "customer_code": "ACME",
        "product_code": "V-PORTAL",
        "contract_no": "ACME-2026-001",
        "opened_min_ago": 3600,
        "has_owner": True,
        "timer_state": "active",
        "due_response_min_ahead": None,
        "due_resolution_min_ahead": 480,
    },
    {
        "tag": "01HTK015ANSWER",
        "ticket_no": "ITSM-2026-0015",
        "title": "[답변] 내부 FAQ 업데이트",
        "description": "자주 묻는 문의 5건 FAQ 업데이트.",
        "source_channel": "web",
        "priority": "low",
        "category_l1": "지식",
        "category_l2": "FAQ",
        "current_stage": "answer",
        "service_type": "internal",
        "customer_code": "V-INTERNAL",
        "product_code": None,
        "contract_no": "INTERNAL-2026-001",
        "opened_min_ago": 1440,
        "has_owner": True,
        "timer_state": "active",
        "due_response_min_ahead": None,
        "due_resolution_min_ahead": 2160,
    },
    # --- closed 단계 (3건) ---
    {
        "tag": "01HTK016CLOSED",
        "ticket_no": "ITSM-2026-0016",
        "title": "[종료] 긴급 패치 적용 완료",
        "description": "보안 패치 적용 후 정상 동작 확인 완료.",
        "source_channel": "slack",
        "priority": "critical",
        "category_l1": "보안",
        "category_l2": "패치",
        "current_stage": "closed",
        "service_type": "on_premise",
        "customer_code": "ACME",
        "product_code": "V-ITSM",
        "contract_no": "ACME-2026-001",
        "opened_min_ago": 5760,
        "closed_min_ago": 180,
        "has_owner": True,
        "timer_state": "satisfied",
        "due_response_min_ahead": None,
        "due_resolution_min_ahead": None,
        "feedback_score": 5,
        "feedback_reopen": False,
    },
    {
        "tag": "01HTK017CLOSED",
        "ticket_no": "ITSM-2026-0017",
        "title": "[종료] 알림 설정 가이드 안내",
        "description": "CLOUD-CO 담당자에게 알림 설정 안내 완료.",
        "source_channel": "teams",
        "priority": "normal",
        "category_l1": "안내",
        "category_l2": "가이드",
        "current_stage": "closed",
        "service_type": "saas",
        "customer_code": "CLOUD-CO",
        "product_code": "V-ITSM",
        "contract_no": "CLOUD-2026-001",
        "opened_min_ago": 4320,
        "closed_min_ago": 90,
        "has_owner": True,
        "timer_state": "satisfied",
        "due_response_min_ahead": None,
        "due_resolution_min_ahead": None,
        "feedback_score": 4,
        "feedback_reopen": False,
    },
    {
        "tag": "01HTK018CLOSED",
        "ticket_no": "ITSM-2026-0018",
        "title": "[종료·재개] 리포트 누락건 재현 요청",
        "description": "이전 종료된 건이 고객 요청으로 재오픈되었다가 재종료됨.",
        "source_channel": "email",
        "priority": "high",
        "category_l1": "데이터",
        "category_l2": "리포트",
        "current_stage": "closed",
        "service_type": "partner",
        "customer_code": "NEXT-CO",
        "product_code": "V-BRIDGE",
        "contract_no": None,
        "opened_min_ago": 10080,
        "closed_min_ago": 60,
        "has_owner": True,
        "timer_state": "satisfied",
        "due_response_min_ahead": None,
        "due_resolution_min_ahead": None,
        "feedback_score": 3,
        "feedback_reopen": True,
        "reopened_count": 1,
    },
]


# Loop 순서: 현재 stage 에 도달하기 위한 경로
STAGE_ORDER = ["intake", "analyze", "execute", "verify", "answer", "closed"]


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

INSERT_TICKET = """
INSERT INTO itsm_ticket
    (id, ticket_no, title, description, source_channel, source_ref,
     priority, category_l1, category_l2, current_stage,
     service_type, customer_id, product_id, contract_id,
     requester_id, current_owner_id, sla_policy_id,
     opened_at, closed_at, reopened_count,
     created_at, updated_at)
SELECT :id, :ticket_no, :title, :description, :source_channel, NULL,
       :priority, :category_l1, :category_l2, :current_stage,
       :service_type,
       (SELECT id FROM itsm_customer WHERE code = :customer_code),
       (SELECT id FROM itsm_product  WHERE code = :product_code),
       (SELECT id FROM itsm_contract WHERE contract_no = :contract_no),
       (SELECT id FROM users WHERE email = 'bong78@vms-solutions.com' LIMIT 1),
       CASE WHEN :has_owner THEN
           (SELECT id FROM users WHERE email = 'bong78@vms-solutions.com' LIMIT 1)
       ELSE NULL END,
       NULL,
       :opened_at, :closed_at, :reopened_count,
       NOW(), NOW()
ON CONFLICT (ticket_no) DO NOTHING
"""

INSERT_TRANSITION = """
INSERT INTO itsm_loop_transition
    (id, ticket_id, from_stage, to_stage, action, actor_id, note, artifacts,
     transitioned_at)
SELECT :id, t.id, :from_stage, :to_stage, :action,
       (SELECT id FROM users WHERE email = 'bong78@vms-solutions.com' LIMIT 1),
       :note, NULL, :transitioned_at
FROM itsm_ticket t
WHERE t.ticket_no = :ticket_no
  AND NOT EXISTS (SELECT 1 FROM itsm_loop_transition WHERE id = :id)
"""

INSERT_ASSIGNMENT = """
INSERT INTO itsm_assignment
    (id, ticket_id, owner_id, role, assigned_at, released_at)
SELECT :id, t.id,
       (SELECT id FROM users WHERE email = 'bong78@vms-solutions.com' LIMIT 1),
       'primary', :assigned_at, NULL
FROM itsm_ticket t
WHERE t.ticket_no = :ticket_no
  AND NOT EXISTS (SELECT 1 FROM itsm_assignment WHERE id = :id)
  AND (SELECT id FROM users WHERE email = 'bong78@vms-solutions.com' LIMIT 1) IS NOT NULL
"""

INSERT_SLA_TIMER = """
INSERT INTO itsm_sla_timer
    (id, ticket_id, kind, due_at, warning_sent_at, breached_at, satisfied_at,
     created_at)
SELECT :id, t.id, :kind, :due_at, :warning_sent_at, :breached_at, :satisfied_at,
       :created_at
FROM itsm_ticket t
WHERE t.ticket_no = :ticket_no
ON CONFLICT (ticket_id, kind) DO NOTHING
"""

INSERT_FEEDBACK = """
INSERT INTO itsm_feedback
    (id, ticket_id, score, comment, reopen, submitted_by, submitted_at)
SELECT :id, t.id, :score, :comment, :reopen,
       (SELECT id FROM users WHERE email = 'bong78@vms-solutions.com' LIMIT 1),
       :submitted_at
FROM itsm_ticket t
WHERE t.ticket_no = :ticket_no
  AND NOT EXISTS (SELECT 1 FROM itsm_feedback WHERE id = :id)
"""


# ---------------------------------------------------------------------------
# 런처
# ---------------------------------------------------------------------------
def _timer_fields(state: str, due_at: datetime) -> dict:
    """타이머 상태별 warning/breached/satisfied 컬럼 채움."""
    if state == "active":
        return {"warning_sent_at": None, "breached_at": None, "satisfied_at": None}
    if state == "warning":
        return {"warning_sent_at": _minutes_ago(15), "breached_at": None, "satisfied_at": None}
    if state == "breached":
        return {
            "warning_sent_at": _minutes_ago(120),
            "breached_at": _minutes_ago(30),
            "satisfied_at": None,
        }
    if state == "satisfied":
        return {
            "warning_sent_at": None,
            "breached_at": None,
            "satisfied_at": _minutes_ago(30),
        }
    raise ValueError(f"unknown timer_state: {state}")


def migrate(engine):
    with engine.connect() as conn:
        # 1) 파트너 고객 + 담당자
        conn.execute(text(INSERT_CUSTOMER), PARTNER_CUSTOMER)
        conn.execute(text(INSERT_CONTACT), PARTNER_CONTACT)

        # 2) 티켓
        for tk in TICKETS:
            opened_at = _minutes_ago(tk["opened_min_ago"])
            closed_at = (
                _minutes_ago(tk["closed_min_ago"]) if tk.get("closed_min_ago") else None
            )
            conn.execute(
                text(INSERT_TICKET),
                {
                    "id": _id(tk["tag"]),
                    "ticket_no": tk["ticket_no"],
                    "title": tk["title"],
                    "description": tk["description"],
                    "source_channel": tk["source_channel"],
                    "priority": tk["priority"],
                    "category_l1": tk["category_l1"],
                    "category_l2": tk["category_l2"],
                    "current_stage": tk["current_stage"],
                    "service_type": tk["service_type"],
                    "customer_code": tk["customer_code"],
                    "product_code": tk["product_code"],
                    "contract_no": tk["contract_no"],
                    "has_owner": tk["has_owner"],
                    "opened_at": opened_at,
                    "closed_at": closed_at,
                    "reopened_count": tk.get("reopened_count", 0),
                },
            )

            # 3) Loop 전이 이력 — intake → 현재 단계
            current_idx = STAGE_ORDER.index(tk["current_stage"])
            # intake 는 전이 없음 (시작점). 그 외 단계는 각 단계 사이 advance 전이 추가
            base_ts = opened_at
            for i in range(current_idx):
                from_stage = STAGE_ORDER[i]
                to_stage = STAGE_ORDER[i + 1]
                # 단계 사이 균등 분포
                total_min = tk["opened_min_ago"] - (
                    tk.get("closed_min_ago", 0) if to_stage == "closed" else 0
                )
                step_min = max(1, total_min // max(1, current_idx))
                base_ts = base_ts + timedelta(minutes=step_min)
                conn.execute(
                    text(INSERT_TRANSITION),
                    {
                        "id": _id(f"{tk['tag']}TR{i}"),
                        "ticket_no": tk["ticket_no"],
                        "from_stage": from_stage,
                        "to_stage": to_stage,
                        "action": "advance",
                        "note": f"{from_stage} → {to_stage} 전이 (seed)",
                        "transitioned_at": base_ts,
                    },
                )

            # 재오픈된 티켓: 추가 reopen 전이 1건
            if tk.get("reopened_count", 0) > 0 and tk["current_stage"] == "closed":
                # closed → intake(재오픈) → ... → closed 경로 중 reopen 한 번만 기록
                conn.execute(
                    text(INSERT_TRANSITION),
                    {
                        "id": _id(f"{tk['tag']}TRRE"),
                        "ticket_no": tk["ticket_no"],
                        "from_stage": "closed",
                        "to_stage": "intake",
                        "action": "reopen",
                        "note": "고객 재요청으로 재오픈 (seed)",
                        "transitioned_at": _minutes_ago(tk["opened_min_ago"] // 2),
                    },
                )

            # 4) 배정 (owner 존재 티켓만)
            if tk["has_owner"]:
                conn.execute(
                    text(INSERT_ASSIGNMENT),
                    {
                        "id": _id(f"{tk['tag']}AS"),
                        "ticket_no": tk["ticket_no"],
                        "assigned_at": opened_at + timedelta(minutes=5),
                    },
                )

            # 5) SLA 타이머
            state = tk["timer_state"]
            if state is not None:
                # response (due_response_min_ahead 가 지정된 티켓만)
                if tk["due_response_min_ahead"] is not None:
                    due_at = _minutes_ahead(tk["due_response_min_ahead"])
                    tf = _timer_fields(state, due_at)
                    conn.execute(
                        text(INSERT_SLA_TIMER),
                        {
                            "id": _id(f"{tk['tag']}SLRP"),
                            "ticket_no": tk["ticket_no"],
                            "kind": "response",
                            "due_at": due_at,
                            "warning_sent_at": tf["warning_sent_at"],
                            "breached_at": tf["breached_at"],
                            "satisfied_at": tf["satisfied_at"],
                            "created_at": opened_at,
                        },
                    )

                # resolution
                if tk["due_resolution_min_ahead"] is not None:
                    due_at = _minutes_ahead(tk["due_resolution_min_ahead"])
                    # closed 티켓의 resolution 은 satisfied
                    res_state = "satisfied" if tk["current_stage"] == "closed" else state
                    tf = _timer_fields(res_state, due_at)
                    conn.execute(
                        text(INSERT_SLA_TIMER),
                        {
                            "id": _id(f"{tk['tag']}SLRS"),
                            "ticket_no": tk["ticket_no"],
                            "kind": "resolution",
                            "due_at": due_at,
                            "warning_sent_at": tf["warning_sent_at"],
                            "breached_at": tf["breached_at"],
                            "satisfied_at": tf["satisfied_at"],
                            "created_at": opened_at,
                        },
                    )

                # closed 티켓은 resolution 미지정 시 satisfied 타이머 1건 추가
                if (
                    tk["current_stage"] == "closed"
                    and tk["due_resolution_min_ahead"] is None
                ):
                    due_at = closed_at or _minutes_ago(30)
                    conn.execute(
                        text(INSERT_SLA_TIMER),
                        {
                            "id": _id(f"{tk['tag']}SLRSC"),
                            "ticket_no": tk["ticket_no"],
                            "kind": "resolution",
                            "due_at": due_at,
                            "warning_sent_at": None,
                            "breached_at": None,
                            "satisfied_at": closed_at or _minutes_ago(30),
                            "created_at": opened_at,
                        },
                    )

            # 6) 피드백 (closed + 점수 지정 티켓)
            if tk["current_stage"] == "closed" and tk.get("feedback_score") is not None:
                conn.execute(
                    text(INSERT_FEEDBACK),
                    {
                        "id": _id(f"{tk['tag']}FB"),
                        "ticket_no": tk["ticket_no"],
                        "score": tk["feedback_score"],
                        "comment": (
                            "신속 대응 감사합니다."
                            if tk["feedback_score"] >= 4
                            else "처리는 되었으나 지연이 아쉬움."
                        ),
                        "reopen": tk["feedback_reopen"],
                        "submitted_at": closed_at or _minutes_ago(10),
                    },
                )

        conn.commit()
        logger.info(
            "a009: operational sample seed — +1 partner customer, "
            "%d tickets (all loop stages), transitions/timers/assignments/feedback",
            len(TICKETS),
        )
