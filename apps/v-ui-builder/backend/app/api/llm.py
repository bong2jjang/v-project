"""LLM Provider 메타 정보 및 자격증명 테스트 라우터."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from v_platform.models.user import User
from v_platform.utils.auth import get_current_user

from app.llm.registry import get_provider, list_providers
from app.schemas.chat import ProviderInfo


router = APIRouter(prefix="/api/llm", tags=["ui-builder:llm"])


_KNOWN_MODELS: dict[str, list[str]] = {
    "openai": ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
    "anthropic": ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
    "gemini": ["gemini-1.5-pro", "gemini-1.5-flash"],
}


@router.get("/providers", response_model=list[ProviderInfo])
async def get_providers(
    _: User = Depends(get_current_user),
) -> list[ProviderInfo]:
    result: list[ProviderInfo] = []
    for name in list_providers():
        try:
            provider = get_provider(name)
            available = await provider.validate_credentials()
        except Exception:
            available = False
        result.append(
            ProviderInfo(
                name=name,
                available=available,
                models=_KNOWN_MODELS.get(name, []),
            )
        )
    return result


@router.post("/test/{provider_name}")
async def test_provider(
    provider_name: str,
    _: User = Depends(get_current_user),
) -> dict:
    try:
        provider = get_provider(provider_name)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc

    ok = await provider.validate_credentials()
    return {"provider": provider_name, "available": ok}
