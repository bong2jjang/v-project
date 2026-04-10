"""
메시지 형식 변환 유틸리티

Slack ↔ Teams 간 Markdown 형식을 변환하고 메시지 형태를 보존합니다.

작성일: 2026-04-03
"""

import re
from typing import Optional


def convert_slack_to_teams_markdown(text: str) -> str:
    """
    Slack Markdown 형식을 Teams Markdown 형식으로 변환

    변환 규칙:
    - *bold* → **bold**
    - _italic_ → *italic*
    - ~strikethrough~ → ~~strikethrough~~
    - 코드 블록(```)은 유지
    - 줄바꿈(\n)은 유지

    Args:
        text: Slack 메시지 텍스트

    Returns:
        Teams용으로 변환된 텍스트
    """
    if not text:
        return text

    # 코드 블록 임시 보호 (```)
    code_blocks = []
    code_block_pattern = r"```[\s\S]*?```"

    def save_code_block(match):
        code_blocks.append(match.group(0))
        return f"__CODE_BLOCK_{len(code_blocks) - 1}__"

    text = re.sub(code_block_pattern, save_code_block, text)

    # 인라인 코드 임시 보호 (`)
    inline_codes = []
    inline_code_pattern = r"`[^`]+`"

    def save_inline_code(match):
        inline_codes.append(match.group(0))
        return f"__INLINE_CODE_{len(inline_codes) - 1}__"

    text = re.sub(inline_code_pattern, save_inline_code, text)

    # Slack 형식 → Teams 형식 변환
    # *bold* → **bold**
    text = re.sub(r"(?<!\*)\*(?!\*)([^\*]+)\*(?!\*)", r"**\1**", text)

    # _italic_ → *italic*
    text = re.sub(r"(?<!_)_(?!_)([^_]+)_(?!_)", r"*\1*", text)

    # ~strikethrough~ → ~~strikethrough~~
    text = re.sub(r"(?<!~)~(?!~)([^~]+)~(?!~)", r"~~\1~~", text)

    # 코드 블록 복원
    for i, code_block in enumerate(code_blocks):
        text = text.replace(f"__CODE_BLOCK_{i}__", code_block)

    # 인라인 코드 복원
    for i, inline_code in enumerate(inline_codes):
        text = text.replace(f"__INLINE_CODE_{i}__", inline_code)

    return text


def convert_teams_to_slack_markdown(text: str) -> str:
    """
    Teams Markdown 형식을 Slack Markdown 형식으로 변환

    변환 규칙:
    - **bold** → *bold*
    - *italic* → _italic_
    - ~~strikethrough~~ → ~strikethrough~
    - 코드 블록(```)은 유지
    - 줄바꿈(\n)은 유지

    Args:
        text: Teams 메시지 텍스트

    Returns:
        Slack용으로 변환된 텍스트
    """
    if not text:
        return text

    # 코드 블록 임시 보호 (```)
    code_blocks = []
    code_block_pattern = r"```[\s\S]*?```"

    def save_code_block(match):
        code_blocks.append(match.group(0))
        return f"__CODE_BLOCK_{len(code_blocks) - 1}__"

    text = re.sub(code_block_pattern, save_code_block, text)

    # 인라인 코드 임시 보호 (`)
    inline_codes = []
    inline_code_pattern = r"`[^`]+`"

    def save_inline_code(match):
        inline_codes.append(match.group(0))
        return f"__INLINE_CODE_{len(inline_codes) - 1}__"

    text = re.sub(inline_code_pattern, save_inline_code, text)

    # Teams 형식 → Slack 형식 변환
    # **bold** → *bold*
    text = re.sub(r"\*\*([^\*]+)\*\*", r"*\1*", text)

    # *italic* → _italic_ (bold 변환 후)
    text = re.sub(r"(?<!\*)\*(?!\*)([^\*]+)\*(?!\*)", r"_\1_", text)

    # ~~strikethrough~~ → ~strikethrough~
    text = re.sub(r"~~([^~]+)~~", r"~\1~", text)

    # 코드 블록 복원
    for i, code_block in enumerate(code_blocks):
        text = text.replace(f"__CODE_BLOCK_{i}__", code_block)

    # 인라인 코드 복원
    for i, inline_code in enumerate(inline_codes):
        text = text.replace(f"__INLINE_CODE_{i}__", inline_code)

    return text


def convert_slack_mentions_to_text(text: str, user_map: Optional[dict] = None) -> str:
    """
    Slack 멘션을 일반 텍스트로 변환

    <@U123456> → @username
    <#C123456|channel-name> → #channel-name

    Args:
        text: Slack 메시지 텍스트
        user_map: 사용자 ID → 사용자명 매핑 (선택)

    Returns:
        멘션이 텍스트로 변환된 메시지
    """
    if not text:
        return text

    # 사용자 멘션: <@U123456> → @username
    if user_map:
        for user_id, username in user_map.items():
            text = text.replace(f"<@{user_id}>", f"@{username}")
    else:
        # 매핑이 없으면 ID 그대로 사용
        text = re.sub(r"<@([A-Z0-9]+)>", r"@\1", text)

    # 채널 멘션: <#C123456|channel-name> → #channel-name
    text = re.sub(r"<#[A-Z0-9]+\|([^>]+)>", r"#\1", text)

    # URL: <http://example.com> → http://example.com
    text = re.sub(r"<(https?://[^>]+)>", r"\1", text)

    return text


def preserve_newlines(text: str) -> str:
    """
    줄바꿈 보존 (이미 \n으로 되어 있으면 유지)

    Args:
        text: 메시지 텍스트

    Returns:
        줄바꿈이 보존된 텍스트
    """
    # 이미 \n으로 되어 있으면 그대로 반환
    return text


def detect_message_format(text: str) -> str:
    """
    메시지 형식 감지

    Args:
        text: 메시지 텍스트

    Returns:
        형식 타입: text, markdown, code
    """
    if not text:
        return "text"

    # 코드 블록이 있으면 code
    if "```" in text:
        return "code"

    # Markdown 형식이 있으면 markdown
    markdown_patterns = [
        r"\*\*[^\*]+\*\*",  # **bold**
        r"\*[^\*]+\*",  # *bold* or *italic*
        r"_[^_]+_",  # _italic_
        r"~~[^~]+~~",  # ~~strikethrough~~
        r"`[^`]+`",  # `code`
    ]

    for pattern in markdown_patterns:
        if re.search(pattern, text):
            return "markdown"

    return "text"
