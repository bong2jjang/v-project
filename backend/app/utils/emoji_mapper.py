"""Teams ↔ Slack 이모지 매핑

Teams는 6종 고정 리액션만 제공합니다:
like, heart, laugh, surprised, sad, angry

Slack은 커스텀 이모지를 포함한 수천 종의 이모지를 지원합니다.
매핑이 불가한 이모지는 텍스트 폴백으로 처리됩니다.
"""

# Teams 리액션 → Slack 이모지 (reactionType 문자열 기반)
TEAMS_TO_SLACK_EMOJI: dict[str, str] = {
    "like": "+1",
    "heart": "heart",
    "laugh": "joy",
    "surprised": "open_mouth",
    "sad": "cry",
    "angry": "angry",
}

# Teams 리액션 이모지 문자 → Slack 이모지 (Graph API가 이모지 문자를 반환하는 경우)
TEAMS_EMOJI_CHAR_TO_SLACK: dict[str, str] = {
    "👍": "+1",
    "❤️": "heart",
    "😆": "joy",
    "😮": "open_mouth",
    "😢": "cry",
    "😡": "angry",
    "👎": "-1",
}

# Slack 이모지 → Teams 리액션 (역방향)
SLACK_TO_TEAMS_EMOJI: dict[str, str] = {v: k for k, v in TEAMS_TO_SLACK_EMOJI.items()}
