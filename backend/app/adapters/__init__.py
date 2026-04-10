"""
Platform Adapters for Light-Zowe Architecture

Provider Pattern을 통한 플랫폼별 어댑터 구현.
"""

from app.adapters.base import BasePlatformProvider
from app.adapters.slack_provider import SlackProvider
from app.adapters.teams_provider import TeamsProvider

__all__ = ["BasePlatformProvider", "SlackProvider", "TeamsProvider"]
