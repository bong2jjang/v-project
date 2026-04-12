"""
Organization Management API

회사 및 부서 CRUD
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, selectinload

from v_platform.core.database import get_db_session
from v_platform.models.company import Company
from v_platform.models.department import Department
from v_platform.models.user import User
from v_platform.utils.auth import require_system_admin, require_admin_or_above

router = APIRouter(tags=["organizations"])


# ── Schemas ──────────────────────────────────────────────────────────


class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: str = Field(..., min_length=1, max_length=50)
    is_active: bool = True


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    is_active: Optional[bool] = None


class CompanyResponse(BaseModel):
    id: int
    name: str
    code: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    parent_id: Optional[int] = None
    sort_order: int = 0


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    code: Optional[str] = Field(None, max_length=50)
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class DepartmentResponse(BaseModel):
    id: int
    company_id: int
    name: str
    code: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DepartmentTreeResponse(DepartmentResponse):
    children: list["DepartmentTreeResponse"] = []


# ── Company Endpoints ────────────────────────────────────────────────


@router.get("/api/organizations/companies", response_model=list[CompanyResponse])
async def list_companies(
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_admin_or_above()),
):
    """회사 목록 조회"""
    query = db.query(Company)
    if is_active is not None:
        query = query.filter(Company.is_active == is_active)
    return query.order_by(Company.name).all()


@router.post(
    "/api/organizations/companies",
    response_model=CompanyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_company(
    data: CompanyCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_system_admin()),
):
    """회사 생성 (system_admin 전용)"""
    if (
        db.query(Company)
        .filter((Company.name == data.name) | (Company.code == data.code))
        .first()
    ):
        raise HTTPException(
            400,
            "동일한 회사명 또는 코드가 이미 등록되어 있습니다. 다른 이름이나 코드를 사용해 주세요.",
        )

    company = Company(**data.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.put("/api/organizations/companies/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: int,
    data: CompanyUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_system_admin()),
):
    """회사 수정 (system_admin 전용)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(404, "회사를 찾을 수 없습니다")

    update_data = data.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(company, key, val)
    company.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(company)
    return company


@router.delete(
    "/api/organizations/companies/{company_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_company(
    company_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_system_admin()),
):
    """회사 삭제 (system_admin 전용)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(404, "회사를 찾을 수 없습니다")

    db.delete(company)
    db.commit()


# ── Department Endpoints ─────────────────────────────────────────────


def _build_dept_tree(
    departments: list[Department], parent_id: Optional[int] = None
) -> list[dict]:
    """부서 목록을 트리 구조로 변환"""
    tree = []
    for dept in departments:
        if dept.parent_id == parent_id:
            node = {
                "id": dept.id,
                "company_id": dept.company_id,
                "name": dept.name,
                "code": dept.code,
                "parent_id": dept.parent_id,
                "sort_order": dept.sort_order,
                "is_active": dept.is_active,
                "created_at": dept.created_at,
                "updated_at": dept.updated_at,
                "children": _build_dept_tree(departments, dept.id),
            }
            tree.append(node)
    tree.sort(key=lambda x: x["sort_order"])
    return tree


@router.get("/api/organizations/companies/{company_id}/departments")
async def list_departments(
    company_id: int,
    flat: bool = Query(False, description="트리 대신 플랫 목록 반환"),
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_admin_or_above()),
):
    """특정 회사의 부서 트리 조회"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(404, "회사를 찾을 수 없습니다")

    departments = (
        db.query(Department)
        .filter(Department.company_id == company_id)
        .order_by(Department.sort_order)
        .all()
    )

    if flat:
        return departments

    return _build_dept_tree(departments)


@router.post(
    "/api/organizations/companies/{company_id}/departments",
    response_model=DepartmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_department(
    company_id: int,
    data: DepartmentCreate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_system_admin()),
):
    """부서 생성 (system_admin 전용)"""
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(404, "회사를 찾을 수 없습니다")

    existing = (
        db.query(Department)
        .filter(Department.company_id == company_id, Department.name == data.name)
        .first()
    )
    if existing:
        raise HTTPException(
            400,
            "같은 회사 내에 동일한 부서명이 이미 등록되어 있습니다. 다른 이름을 사용해 주세요.",
        )

    dept = Department(company_id=company_id, **data.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept


@router.put(
    "/api/organizations/departments/{dept_id}", response_model=DepartmentResponse
)
async def update_department(
    dept_id: int,
    data: DepartmentUpdate,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_system_admin()),
):
    """부서 수정 (system_admin 전용)"""
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(404, "부서를 찾을 수 없습니다")

    update_data = data.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(dept, key, val)
    dept.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(dept)
    return dept


@router.delete(
    "/api/organizations/departments/{dept_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_department(
    dept_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_system_admin()),
):
    """부서 삭제 (system_admin 전용)"""
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(404, "부서를 찾을 수 없습니다")

    db.delete(dept)
    db.commit()


# ── Org Tree Endpoint ───────────────────────────────────────────────


class OrgUserBrief(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


class OrgDeptNode(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    users: list[OrgUserBrief] = []
    children: list["OrgDeptNode"] = []


class OrgCompanyNode(BaseModel):
    id: int
    name: str
    code: str
    is_active: bool
    departments: list[OrgDeptNode] = []
    unassigned_users: list[OrgUserBrief] = []


class OrgTreeResponse(BaseModel):
    companies: list[OrgCompanyNode] = []
    unassigned_users: list[OrgUserBrief] = []
    total_users: int = 0


def _build_org_dept_tree(
    departments: list[Department],
    dept_users: dict[int, list],
    parent_id: Optional[int] = None,
) -> list[dict]:
    """부서 트리 + 사용자 배치 (sort_order 기준 정렬)"""
    tree = []
    for dept in departments:
        if dept.parent_id == parent_id:
            node = {
                "id": dept.id,
                "name": dept.name,
                "code": dept.code,
                "sort_order": dept.sort_order or 0,
                "users": dept_users.get(dept.id, []),
                "children": _build_org_dept_tree(departments, dept_users, dept.id),
            }
            tree.append(node)
    tree.sort(key=lambda x: x.get("sort_order", 0))
    return tree


@router.get("/api/organizations/tree", response_model=OrgTreeResponse)
async def get_org_tree(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_admin_or_above()),
):
    """조직도 트리 조회 — 회사 > 부서 > 사용자 계층 구조"""
    companies = db.query(Company).order_by(Company.name).all()
    all_departments = db.query(Department).order_by(Department.sort_order).all()
    all_users = (
        db.query(User)
        .options(selectinload(User.company), selectinload(User.department))
        .filter(User.is_active == True)  # noqa: E712
        .order_by(User.username)
        .all()
    )

    # 부서별, 회사별 사용자 분류
    dept_users: dict[int, list] = {}
    company_no_dept: dict[int, list] = {}
    no_company: list = []

    for u in all_users:
        brief = {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
            "is_active": u.is_active,
        }
        if u.department_id:
            dept_users.setdefault(u.department_id, []).append(brief)
        elif u.company_id:
            company_no_dept.setdefault(u.company_id, []).append(brief)
        else:
            no_company.append(brief)

    # 회사별 부서 분류
    company_depts: dict[int, list] = {}
    for dept in all_departments:
        company_depts.setdefault(dept.company_id, []).append(dept)

    result_companies = []
    for c in companies:
        depts = company_depts.get(c.id, [])
        dept_tree = _build_org_dept_tree(depts, dept_users)
        result_companies.append(
            {
                "id": c.id,
                "name": c.name,
                "code": c.code,
                "is_active": c.is_active,
                "departments": dept_tree,
                "unassigned_users": company_no_dept.get(c.id, []),
            }
        )

    return OrgTreeResponse(
        companies=result_companies,
        unassigned_users=no_company,
        total_users=len(all_users),
    )
