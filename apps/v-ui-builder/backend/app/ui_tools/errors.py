"""도구 호출 오류 → 한 줄 한국어 요약.

Pydantic ValidationError 의 trace 를 그대로 SSE/채팅 본문에 올리면 사용자에게
의미가 전달되지 않는다. 자주 나오는 패턴(필수 인자 누락, 타입 불일치, 알 수 없는
도구 등) 을 짧은 한국어 한 줄로 정리하는 공용 헬퍼.
"""

from __future__ import annotations

from pydantic import ValidationError


_MAX_LEN = 300


def format_tool_error(err: BaseException | str | None) -> str:
    if err is None:
        return "알 수 없는 오류"

    if isinstance(err, ValidationError):
        parts: list[str] = []
        for e in err.errors():
            loc = ".".join(str(x) for x in (e.get("loc") or ())) or "?"
            etype = str(e.get("type") or "")
            msg = str(e.get("msg") or "").strip()
            if etype == "missing":
                parts.append(f"필수 인자 `{loc}` 누락")
            elif etype.startswith("type_error") or etype.endswith("_type"):
                parts.append(f"`{loc}` 타입 오류: {msg}")
            elif etype == "extra_forbidden":
                parts.append(f"허용되지 않은 인자 `{loc}`")
            else:
                parts.append(f"`{loc}` — {msg}" if msg else f"`{loc}` 검증 실패")
        if parts:
            return "; ".join(parts)[:_MAX_LEN]
        return (str(err).splitlines()[0])[:_MAX_LEN]

    if isinstance(err, BaseException):
        text = str(err).strip() or err.__class__.__name__
        return text.splitlines()[0][:_MAX_LEN]

    text = str(err).strip()
    return text.splitlines()[0][:_MAX_LEN] if text else "알 수 없는 오류"


__all__ = ["format_tool_error"]
