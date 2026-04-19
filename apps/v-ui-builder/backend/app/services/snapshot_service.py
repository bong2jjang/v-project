"""SnapshotService — 프로젝트 내 프리뷰 버전 스냅샷 관리.

- slug 발번: `snap-NNNN` 형식, 프로젝트 스코프 내 max+1.
- 타이틀: LLM Provider 에 짧은 요약을 요청해 자동 생성 (실패 시 fallback).
- 확정: project.current_snapshot_id 를 지정 스냅샷으로 설정 (해제는 None).
"""

from __future__ import annotations

import logging
import re
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.llm.base import ArtifactFile, BaseLLMProvider, ChatMessage
from app.llm.registry import get_provider
from app.models import UIBuilderMessage, UIBuilderProject, UIBuilderSnapshot

from .project_service import ProjectService

logger = logging.getLogger(__name__)

_SLUG_RE = re.compile(r"^snap-(\d+)$")
_TITLE_SYSTEM_PROMPT = (
    "당신은 한글 UI 제목을 짓는 도우미입니다. "
    "사용자 요청과 생성된 파일 목록을 보고 3~8 단어의 짧은 한글 제목 한 줄만 응답하세요. "
    "따옴표·마침표·불필요한 수식어 금지. 코드 펜스나 마크다운도 사용하지 마세요."
)


class SnapshotService:
    def __init__(self, db: Session):
        self.db = db
        self.projects = ProjectService(db)

    # ------------------------------------------------------------------ slug

    def next_slug(self, project_id: UUID) -> str:
        rows = (
            self.db.query(UIBuilderSnapshot.slug)
            .filter(UIBuilderSnapshot.project_id == project_id)
            .all()
        )
        max_n = 0
        for (slug,) in rows:
            m = _SLUG_RE.match(slug or "")
            if m:
                max_n = max(max_n, int(m.group(1)))
        return f"snap-{max_n + 1:04d}"

    # ----------------------------------------------------------------- title

    async def generate_title(
        self,
        provider: BaseLLMProvider,
        user_prompt: str,
        file_paths: list[str],
        model: str | None = None,
    ) -> str:
        """LLM 으로 한 줄 제목 생성. 실패 시 빈 문자열 반환."""
        files_hint = ", ".join(file_paths[:10]) if file_paths else "없음"
        user = (
            f"사용자 요청: {user_prompt.strip()[:500]}\n"
            f"생성된 파일: {files_hint}\n"
            "제목 한 줄만 작성."
        )
        buf: list[str] = []
        try:
            async for chunk in provider.stream(
                messages=[ChatMessage(role="user", content=user)],
                system_prompt=_TITLE_SYSTEM_PROMPT,
                file_context=[],
                model=model,
            ):
                if chunk.kind == "content" and chunk.delta:
                    buf.append(chunk.delta)
                elif chunk.kind == "done":
                    break
        except Exception as exc:  # noqa: BLE001
            logger.warning("snapshot title generation failed: %s", exc)
            return ""

        title = "".join(buf).strip().splitlines()[0] if buf else ""
        title = title.strip().strip("`\"'")
        return title[:200]

    # ---------------------------------------------------------------- create

    async def create(
        self,
        project: UIBuilderProject,
        user_prompt: str,
        files: dict[str, str],
        message_id: UUID | None,
    ) -> UIBuilderSnapshot:
        slug = self.next_slug(project.id)

        title = ""
        try:
            provider = get_provider(project.llm_provider)
            title = await self.generate_title(
                provider=provider,
                user_prompt=user_prompt,
                file_paths=list(files.keys()),
                model=project.llm_model,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("snapshot title provider error: %s", exc)

        if not title:
            title = f"스냅샷 {slug.split('-')[-1]}"

        snap = UIBuilderSnapshot(
            project_id=project.id,
            slug=slug,
            title=title,
            files=files,
            message_id=message_id,
        )
        self.db.add(snap)
        self.db.commit()
        self.db.refresh(snap)
        return snap

    # ----------------------------------------------------------------- list

    def list_for_project(
        self, project_id: UUID, user_id: int
    ) -> list[UIBuilderSnapshot]:
        self.projects.get_owned(project_id, user_id, expected_type="sandpack")
        return (
            self.db.query(UIBuilderSnapshot)
            .filter(UIBuilderSnapshot.project_id == project_id)
            .order_by(UIBuilderSnapshot.created_at.desc())
            .all()
        )

    def get_owned(self, snapshot_id: UUID, user_id: int) -> UIBuilderSnapshot:
        snap = (
            self.db.query(UIBuilderSnapshot)
            .filter(UIBuilderSnapshot.id == snapshot_id)
            .first()
        )
        if snap is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="snapshot not found"
            )
        self.projects.get_owned(snap.project_id, user_id, expected_type="sandpack")
        return snap

    def get_linked_messages(
        self, snap: UIBuilderSnapshot
    ) -> tuple[UIBuilderMessage | None, UIBuilderMessage | None]:
        """스냅샷이 가리키는 assistant 메시지 + 직전 user 메시지 반환."""
        if snap.message_id is None:
            return None, None
        assistant = (
            self.db.query(UIBuilderMessage)
            .filter(UIBuilderMessage.id == snap.message_id)
            .first()
        )
        if assistant is None:
            return None, None
        user_msg = (
            self.db.query(UIBuilderMessage)
            .filter(
                UIBuilderMessage.project_id == assistant.project_id,
                UIBuilderMessage.role == "user",
                UIBuilderMessage.created_at <= assistant.created_at,
                UIBuilderMessage.id != assistant.id,
            )
            .order_by(UIBuilderMessage.created_at.desc())
            .first()
        )
        return user_msg, assistant

    # ---------------------------------------------------------------- delete

    def delete(self, snapshot_id: UUID, user_id: int) -> UUID:
        """스냅샷 1건 삭제. 확정 스냅샷이면 project.current_snapshot_id 를 먼저 해제."""
        snap = self.get_owned(snapshot_id, user_id)
        project = self.projects.get_owned(snap.project_id, user_id, expected_type="sandpack")
        if project.current_snapshot_id == snap.id:
            project.current_snapshot_id = None
            self.db.flush()
        project_id = snap.project_id
        self.db.delete(snap)
        self.db.commit()
        return project_id

    # --------------------------------------------------------------- confirm

    def confirm(
        self, project_id: UUID, snapshot_id: UUID | None, user_id: int
    ) -> UIBuilderProject:
        project = self.projects.get_owned(project_id, user_id, expected_type="sandpack")
        if snapshot_id is None:
            project.current_snapshot_id = None
        else:
            snap = (
                self.db.query(UIBuilderSnapshot)
                .filter(
                    UIBuilderSnapshot.id == snapshot_id,
                    UIBuilderSnapshot.project_id == project_id,
                )
                .first()
            )
            if snap is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="snapshot not found in this project",
                )
            project.current_snapshot_id = snap.id
        self.db.commit()
        self.db.refresh(project)
        return project
