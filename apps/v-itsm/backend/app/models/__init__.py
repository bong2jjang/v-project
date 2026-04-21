"""v-itsm SQLAlchemy 모델.

모든 모델은 `v_platform.models.base.Base` 를 공유하므로 import 만 해도
`init_db()` 에서 테이블 생성이 가능하지만, 스키마 생성은 마이그레이션
`a003_itsm_schema.py` / `a004_customer_product_contract_scope.py` 가 책임진다.
이 모듈은 ORM 접근용 re-export 만 담당.
"""

from app.models.ai import AISuggestion
from app.models.assignment import Assignment
from app.models.contract import Contract, ContractProduct
from app.models.customer import Customer, CustomerContact
from app.models.feedback import Feedback
from app.models.kpi import KPISnapshot
from app.models.loop import LoopTransition
from app.models.product import Product
from app.models.scope_grant import ScopeGrant
from app.models.sla import SLAPolicy, SLATimer
from app.models.sla_tier import SLATier
from app.models.ticket import Ticket

__all__ = [
    "Ticket",
    "LoopTransition",
    "SLAPolicy",
    "SLATimer",
    "SLATier",
    "Assignment",
    "Feedback",
    "AISuggestion",
    "KPISnapshot",
    "Customer",
    "CustomerContact",
    "Product",
    "Contract",
    "ContractProduct",
    "ScopeGrant",
]
