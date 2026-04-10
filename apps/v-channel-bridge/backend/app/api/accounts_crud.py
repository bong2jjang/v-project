"""Account CRUD API (DB 기반)

PostgreSQL 기반 Account 관리 API
기존 accounts.py (TOML 기반)를 대체
"""

import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db_session
from app.models import Account
from app.models.user import User
from app.schemas.account_crud import (
    AccountCreateRequest,
    AccountListResponse,
    AccountResponse,
    AccountUpdateRequest,
    MessageResponse,
    ValidationError,
)
from app.schemas.feature_catalog import FeatureCatalogResponse, build_catalog_response
from app.services.notification_service import NotificationService
from app.utils.auth import require_permission

router = APIRouter(prefix="/api/accounts-db", tags=["accounts-db"])
logger = logging.getLogger(__name__)


@router.get("/features/catalog", response_model=FeatureCatalogResponse)
async def get_feature_catalog(
    current_user: User = Depends(require_permission("integrations", "read")),
):
    """기능 카탈로그 조회

    플랫폼별 제공 가능한 기능 목록과 필요 권한 정보를 반환합니다.
    """
    return build_catalog_response()


async def validate_account(account: Account) -> tuple[bool, list[ValidationError]]:
    """Account 유효성 검증

    Token/Credentials 테스트 (실제 API 호출은 생략, 형식만 검증)

    Args:
        account: 검증할 Account

    Returns:
        tuple: (is_valid, errors)
    """
    errors = []

    if account.platform == "slack":
        # Slack Token 형식 검증 (복호화된 값 사용)
        try:
            token = account.token_decrypted
            if not token or not token.startswith("xoxb-"):
                errors.append(
                    ValidationError(
                        field="token",
                        message="Invalid Slack Bot Token format (must start with xoxb-)",
                    )
                )
        except Exception as e:
            errors.append(
                ValidationError(
                    field="token",
                    message=f"Failed to decrypt token: {str(e)}",
                )
            )

        # App Token 형식 검증 (선택사항, 복호화된 값 사용)
        try:
            app_token = account.app_token_decrypted
            if app_token and not app_token.startswith("xapp-"):
                errors.append(
                    ValidationError(
                        field="app_token",
                        message="Invalid Slack App Token format (must start with xapp-)",
                    )
                )
        except Exception as e:
            errors.append(
                ValidationError(
                    field="app_token",
                    message=f"Failed to decrypt app_token: {str(e)}",
                )
            )

    elif account.platform == "teams":
        # Teams 필수 필드 검증 (복호화된 값 사용)
        if not account.tenant_id_decrypted:
            errors.append(
                ValidationError(field="tenant_id", message="Tenant ID is required")
            )
        if not account.app_id_decrypted:
            errors.append(ValidationError(field="app_id", message="App ID is required"))
        if not account.app_password_decrypted:
            errors.append(
                ValidationError(
                    field="app_password", message="App Password is required"
                )
            )
        if not account.team_id_decrypted:
            errors.append(
                ValidationError(field="team_id", message="Team ID is required")
            )

    is_valid = len(errors) == 0
    return is_valid, errors


@router.get("", response_model=AccountListResponse)
async def get_accounts(
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_permission("integrations", "read")),
):
    """Account 목록 조회 (DB 기반, 인증 필요)

    컨테이너 상태 무관하게 작동
    복호화 실패한 Account는 에러 메시지와 함께 포함
    """
    try:
        accounts = db.query(Account).order_by(Account.id).all()
        account_responses = []

        for acc in accounts:
            try:
                # 개별 Account 변환 시도
                account_responses.append(AccountResponse.from_orm_with_masking(acc))
            except Exception as e:
                # 복호화 실패 시 기본 정보만 포함
                logger.warning(
                    f"Failed to decrypt account {acc.name} (id={acc.id}): {e}"
                )
                # 에러 Account도 포함하되 is_valid=False, 토큰은 None으로 표시
                account_responses.append(
                    AccountResponse(
                        id=acc.id,
                        platform=acc.platform,
                        name=acc.name,
                        enabled=acc.enabled,
                        is_valid=False,
                        is_connected=False,
                        validation_errors=[
                            {
                                "field": "encryption",
                                "message": f"Decryption failed: {str(e)}",
                            }
                        ],
                        created_at=acc.created_at,
                        updated_at=acc.updated_at,
                    )
                )

        return {
            "accounts": account_responses,
            "total": len(account_responses),
        }
    except Exception as e:
        logger.error(f"Error getting accounts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_permission("integrations", "read")),
):
    """Account 상세 조회 (DB 기반, 인증 필요)

    복호화 실패 시 에러 메시지와 함께 반환
    """
    try:
        account = db.query(Account).filter(Account.id == account_id).first()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        try:
            return AccountResponse.from_orm_with_masking(account)
        except Exception as e:
            # 복호화 실패 시 기본 정보만 포함
            logger.warning(
                f"Failed to decrypt account {account.name} (id={account.id}): {e}"
            )
            return AccountResponse(
                id=account.id,
                platform=account.platform,
                name=account.name,
                enabled=account.enabled,
                is_valid=False,
                is_connected=False,
                validation_errors=[
                    {
                        "field": "encryption",
                        "message": f"Decryption failed: {str(e)}",
                    }
                ],
                created_at=account.created_at,
                updated_at=account.updated_at,
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting account {account_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=AccountResponse, status_code=201)
async def create_account(
    account_create: AccountCreateRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_permission("integrations", "write")),
):
    """Account 생성 (DB 기반, 인증 필요)

    유효성 검증 실패 시에도 저장하되 is_valid=False로 표시
    """
    try:
        # 플랫폼 검증
        if account_create.platform not in ["slack", "teams"]:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "invalid_platform",
                    "message": "Platform must be 'slack' or 'teams'",
                },
            )

        # 중복 체크
        existing = db.query(Account).filter(Account.name == account_create.name).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "account_exists",
                    "message": f"Account '{account_create.name}' already exists",
                },
            )

        # Account 객체 생성
        account = Account(
            platform=account_create.platform,
            name=account_create.name,
            enabled=account_create.enabled,
            created_by=current_user.id,
            updated_by=current_user.id,
        )

        # Slack 필드
        if account_create.platform == "slack":
            if not account_create.slack:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "missing_data",
                        "message": "Slack account data is required",
                    },
                )

            # 암호화 property 사용
            account.token_decrypted = account_create.slack.token
            account.app_token_decrypted = account_create.slack.app_token
            account.prefix_messages_with_nick = (
                account_create.slack.prefix_messages_with_nick
            )
            account.edit_suffix = account_create.slack.edit_suffix
            account.edit_disable = account_create.slack.edit_disable
            account.use_username = account_create.slack.use_username
            account.no_send_join_part = account_create.slack.no_send_join_part
            account.use_api = account_create.slack.use_api
            account.debug = account_create.slack.debug

        # Teams 필드
        elif account_create.platform == "teams":
            if not account_create.teams:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "missing_data",
                        "message": "Teams account data is required",
                    },
                )

            # 암호화 property 사용
            account.tenant_id_decrypted = account_create.teams.tenant_id
            account.app_id_decrypted = account_create.teams.app_id
            account.app_password_decrypted = account_create.teams.app_password
            account.team_id_decrypted = account_create.teams.team_id
            account.prefix_messages_with_nick = (
                account_create.teams.prefix_messages_with_nick
            )
            account.edit_suffix = account_create.teams.edit_suffix
            account.edit_disable = account_create.teams.edit_disable
            account.use_username = account_create.teams.use_username

        # enabled_features 설정
        if account_create.enabled_features is not None:
            if len(account_create.enabled_features) == 0:
                account.enabled_features = None  # NULL = 전체 활성화
            else:
                account.enabled_features = json.dumps(
                    account_create.enabled_features, ensure_ascii=False
                )

        # 유효성 검증
        is_valid, validation_errors = await validate_account(account)
        account.is_valid = is_valid

        if not is_valid:
            # 검증 실패 시 오류 저장
            account.validation_errors = json.dumps(
                [err.to_dict() for err in validation_errors], ensure_ascii=False
            )
            logger.warning(
                f"Account '{account.name}' created with validation errors: {account.validation_errors}"
            )

        # DB에 저장
        db.add(account)
        db.commit()
        db.refresh(account)

        logger.info(
            f"Account '{account.name}' created by user {current_user.username} "
            f"(valid={is_valid})"
        )

        # 성공 알림
        await NotificationService.notify_success(
            category="accounts",
            title="계정 추가됨",
            message=f"{account.platform.capitalize()} 계정 '{account.name}'이(가) 추가되었습니다.",
            source="accounts_crud_api",
            metadata={
                "platform": account.platform,
                "name": account.name,
                "id": account.id,
            },
        )

        return AccountResponse.from_orm_with_masking(account)

    except HTTPException:
        raise
    except IntegrityError as e:
        db.rollback()
        logger.error(f"IntegrityError creating account: {e}")
        raise HTTPException(
            status_code=400,
            detail={"error": "integrity_error", "message": str(e)},
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating account: {e}", exc_info=True)
        await NotificationService.notify_error(
            category="accounts",
            title="계정 추가 실패",
            message=f"계정 추가에 실패했습니다: {str(e)}",
            source="accounts_crud_api",
            metadata={"error": str(e)},
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    account_update: AccountUpdateRequest,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_permission("integrations", "write")),
):
    """Account 수정 (DB 기반, 인증 필요)

    유효성 재검증 수행
    """
    try:
        account = db.query(Account).filter(Account.id == account_id).first()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        # Slack 필드 업데이트
        if account.platform == "slack" and account_update.slack:
            if account_update.slack.token is not None:
                account.token_decrypted = account_update.slack.token
            if account_update.slack.app_token is not None:
                account.app_token_decrypted = account_update.slack.app_token
            if account_update.slack.prefix_messages_with_nick is not None:
                account.prefix_messages_with_nick = (
                    account_update.slack.prefix_messages_with_nick
                )
            if account_update.slack.edit_suffix is not None:
                account.edit_suffix = account_update.slack.edit_suffix
            if account_update.slack.edit_disable is not None:
                account.edit_disable = account_update.slack.edit_disable
            if account_update.slack.use_username is not None:
                account.use_username = account_update.slack.use_username
            if account_update.slack.no_send_join_part is not None:
                account.no_send_join_part = account_update.slack.no_send_join_part
            if account_update.slack.use_api is not None:
                account.use_api = account_update.slack.use_api
            if account_update.slack.debug is not None:
                account.debug = account_update.slack.debug

        # Teams 필드 업데이트
        elif account.platform == "teams" and account_update.teams:
            if account_update.teams.tenant_id is not None:
                account.tenant_id_decrypted = account_update.teams.tenant_id
            if account_update.teams.app_id is not None:
                account.app_id_decrypted = account_update.teams.app_id
            if account_update.teams.app_password is not None:
                account.app_password_decrypted = account_update.teams.app_password
            if account_update.teams.team_id is not None:
                account.team_id_decrypted = account_update.teams.team_id
            if account_update.teams.prefix_messages_with_nick is not None:
                account.prefix_messages_with_nick = (
                    account_update.teams.prefix_messages_with_nick
                )
            if account_update.teams.edit_suffix is not None:
                account.edit_suffix = account_update.teams.edit_suffix
            if account_update.teams.edit_disable is not None:
                account.edit_disable = account_update.teams.edit_disable
            if account_update.teams.use_username is not None:
                account.use_username = account_update.teams.use_username

        # enabled 업데이트
        if account_update.enabled is not None:
            account.enabled = account_update.enabled

        # enabled_features 업데이트
        # None이면 변경 없음, 빈 리스트([])면 초기화(전체 활성화로 리셋)
        if account_update.enabled_features is not None:
            if len(account_update.enabled_features) == 0:
                account.enabled_features = None  # NULL = 전체 활성화
            else:
                account.enabled_features = json.dumps(
                    account_update.enabled_features, ensure_ascii=False
                )

        account.updated_by = current_user.id

        # 유효성 재검증
        is_valid, validation_errors = await validate_account(account)
        account.is_valid = is_valid

        if not is_valid:
            account.validation_errors = json.dumps(
                [err.to_dict() for err in validation_errors], ensure_ascii=False
            )
        else:
            account.validation_errors = None

        db.commit()
        db.refresh(account)

        logger.info(
            f"Account '{account.name}' updated by user {current_user.username} "
            f"(valid={is_valid})"
        )

        # 성공 알림
        await NotificationService.notify_success(
            category="accounts",
            title="계정 수정됨",
            message=f"{account.platform.capitalize()} 계정 '{account.name}'이(가) 수정되었습니다.",
            source="accounts_crud_api",
            metadata={
                "platform": account.platform,
                "name": account.name,
                "id": account.id,
            },
        )

        return AccountResponse.from_orm_with_masking(account)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating account {account_id}: {e}", exc_info=True)
        await NotificationService.notify_error(
            category="accounts",
            title="계정 수정 실패",
            message=f"계정 수정에 실패했습니다: {str(e)}",
            source="accounts_crud_api",
            metadata={"error": str(e), "account_id": account_id},
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{account_id}", response_model=MessageResponse)
async def delete_account(
    account_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_permission("integrations", "write")),
):
    """Account 삭제 (DB 기반, 인증 필요)

    Gateway에서 사용 중인지 확인 후 삭제
    """
    try:
        account = db.query(Account).filter(Account.id == account_id).first()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        # Route 사용 여부 확인 (Redis 기반)
        account_ref = f"{account.platform}.{account.name}"
        try:
            from app.services.route_manager import RouteManager

            route_manager = RouteManager()
            all_routes = await route_manager.get_all_routes()
            usage_count = 0
            for route in all_routes:
                source_key = f"{route.get('source_platform', '')}.{route.get('source_channel', '')}"
                if account_ref in source_key:
                    usage_count += 1
                    continue
                for target in route.get("targets", []):
                    target_key = (
                        f"{target.get('platform', '')}.{target.get('channel', '')}"
                    )
                    if account_ref in target_key:
                        usage_count += 1
                        break
        except Exception as route_err:
            logger.warning(f"Could not check route usage: {route_err}")
            usage_count = 0

        if usage_count > 0:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "account_in_use",
                    "message": f"Account '{account.name}' is used by {usage_count} route(s)",
                },
            )

        # 삭제
        account_name = account.name
        account_platform = account.platform
        db.delete(account)
        db.commit()

        logger.info(f"Account '{account_name}' deleted by user {current_user.username}")

        # 성공 알림
        await NotificationService.notify_success(
            category="accounts",
            title="계정 삭제됨",
            message=f"{account_platform.capitalize()} 계정 '{account_name}'이(가) 삭제되었습니다.",
            source="accounts_crud_api",
            metadata={"platform": account_platform, "name": account_name},
        )

        return MessageResponse(message=f"Account '{account_name}' deleted successfully")

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting account {account_id}: {e}", exc_info=True)
        await NotificationService.notify_error(
            category="accounts",
            title="계정 삭제 실패",
            message=f"계정 삭제에 실패했습니다: {str(e)}",
            source="accounts_crud_api",
            metadata={"error": str(e), "account_id": account_id},
        )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{account_id}/validate", response_model=AccountResponse)
async def validate_account_endpoint(
    account_id: int,
    db: Session = Depends(get_db_session),
    current_user: User = Depends(require_permission("integrations", "write")),
):
    """Account 유효성 재검증 (DB 기반, 인증 필요)

    실시간으로 Token/Credentials 검증
    """
    try:
        account = db.query(Account).filter(Account.id == account_id).first()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")

        # 유효성 검증
        is_valid, validation_errors = await validate_account(account)
        account.is_valid = is_valid

        if not is_valid:
            account.validation_errors = json.dumps(
                [err.to_dict() for err in validation_errors], ensure_ascii=False
            )
        else:
            account.validation_errors = None

        account.updated_by = current_user.id
        db.commit()
        db.refresh(account)

        logger.info(
            f"Account '{account.name}' validated by user {current_user.username} "
            f"(valid={is_valid})"
        )

        return AccountResponse.from_orm_with_masking(account)

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error validating account {account_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
