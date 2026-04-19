"""ChatService — 대화 히스토리 조립 + LLM Provider 호출 + 메시지 영속화.

스트림 종료 시 artifact_* 이벤트로 파일이 만들어졌다면
SnapshotService.create 로 프로젝트 내부 스냅샷을 자동 저장하고
`snapshot_created` SSE 이벤트를 뒤에 이어서 내보낸다.
"""

from __future__ import annotations

import json
import logging
from typing import AsyncIterator
from uuid import UUID

from sqlalchemy.orm import Session

from app.llm.base import ArtifactFile, ChatMessage
from app.llm.registry import get_provider
from app.models import UIBuilderMessage, UIBuilderProject, UIBuilderSnapshot

from .project_service import ProjectService
from .snapshot_service import SnapshotService

_CONTEXT_FILE_MAX = 8000

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """당신은 React + TypeScript UI 컴포넌트를 작성하는 숙련된 프론트엔드 개발자입니다.

규칙:
1. 사용자가 요청한 UI 는 **Sandpack react-ts 템플릿**에서 바로 실행 가능해야 합니다.
2. 새 파일이나 수정 파일은 반드시 아래 형식의 코드 펜스로 감쌉니다:

   ```tsx file=/App.tsx
   ...전체 파일 내용...
   ```

   - 언어 태그(`tsx`/`ts`/`css`)는 파일 확장자에 맞춥니다.
   - `file=` 경로는 **루트 절대 경로**입니다. Sandpack react-ts 템플릿의 엔트리는
     `/index.tsx` 이며 기본 컴포넌트는 `/App.tsx` 입니다. `/src/...` 는 쓰지 마세요.
     허용 예: `/App.tsx`, `/components/Button.tsx`, `/styles.css`.
   - 한 블록 = 한 파일의 **전체 내용** (부분 수정 금지).

3. 펜스 밖 텍스트는 사용자에게 보여줄 간단한 설명만 씁니다 (3줄 이내).
4. 사용 가능한 npm 패키지 (미리 설치됨, 이 목록 외엔 import 금지):
   - `react`, `react-dom`
   - `recharts` — 차트/그래프
   - `lucide-react` — 아이콘
   - `clsx` — className 조합
   - `framer-motion` — 애니메이션
   - `date-fns` — 날짜 유틸
5. Tailwind 가 이미 적용되어 있다고 가정합니다.
"""


def _to_sse(event: str, data: dict) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode()


class ChatService:
    def __init__(self, db: Session):
        self.db = db
        self.projects = ProjectService(db)
        self.snapshots = SnapshotService(db)

    def _history(self, project_id: UUID) -> list[ChatMessage]:
        rows = (
            self.db.query(UIBuilderMessage)
            .filter(UIBuilderMessage.project_id == project_id)
            .order_by(UIBuilderMessage.created_at.asc())
            .all()
        )
        return [ChatMessage(role=r.role, content=r.content) for r in rows]

    def _file_context(self, project_id: UUID, user_id: int) -> list[ArtifactFile]:
        latest = self.projects.latest_artifacts(project_id, user_id)
        return [ArtifactFile(file_path=a.file_path, content=a.content) for a in latest]

    def _load_context_snapshots(
        self, ids: list[UUID], project_id: UUID
    ) -> list[UIBuilderSnapshot]:
        if not ids:
            return []
        rows = (
            self.db.query(UIBuilderSnapshot)
            .filter(
                UIBuilderSnapshot.id.in_(ids),
                UIBuilderSnapshot.project_id == project_id,
            )
            .order_by(UIBuilderSnapshot.created_at.asc())
            .all()
        )
        return rows

    def _context_block(self, snaps: list[UIBuilderSnapshot]) -> str:
        if not snaps:
            return ""
        lines: list[str] = [
            "",
            "---",
            "# 참고 스냅샷 (사용자가 첨부한 과거 버전 — 참조용)",
            "아래 파일들은 현재 작업 중인 파일이 아니라, 사용자가 맥락으로 제공한 과거 스냅샷입니다.",
            "요청에 필요한 부분만 참고하고, 요청이 없으면 이 파일들을 그대로 다시 출력하지 마세요.",
            "",
        ]
        for s in snaps:
            lines.append(f"## [{s.slug}] {s.title}")
            for path, content in (s.files or {}).items():
                trimmed = content[:_CONTEXT_FILE_MAX]
                if len(content) > _CONTEXT_FILE_MAX:
                    trimmed += "\n... (잘림)"
                lines.append(f"### {path}")
                lines.append("```")
                lines.append(trimmed.rstrip())
                lines.append("```")
            lines.append("")
        return "\n".join(lines)

    async def stream(
        self,
        project_id: UUID,
        user_id: int,
        prompt: str,
        model: str | None = None,
        context_snapshot_ids: list[UUID] | None = None,
    ) -> AsyncIterator[bytes]:
        project: UIBuilderProject = self.projects.get_owned(project_id, user_id)

        # 사용자 메시지 먼저 영속화
        user_msg = UIBuilderMessage(
            project_id=project.id, role="user", content=prompt
        )
        self.db.add(user_msg)
        self.db.commit()

        history = self._history(project.id)
        files_ctx = self._file_context(project.id, user_id)
        context_snaps = self._load_context_snapshots(
            context_snapshot_ids or [], project.id
        )
        system_prompt = SYSTEM_PROMPT + self._context_block(context_snaps)
        provider = get_provider(project.llm_provider)

        # 스냅샷 구성용 — 기존 파일을 기반으로 이번 턴의 변경사항을 덮어쓴다.
        snapshot_files: dict[str, str] = {f.file_path: f.content for f in files_ctx}
        streamed_paths: set[str] = set()
        artifact_bufs: dict[str, list[str]] = {}

        assistant_buf: list[str] = []
        try:
            async for chunk in provider.stream(
                messages=history,
                system_prompt=system_prompt,
                file_context=files_ctx,
                model=model or project.llm_model,
            ):
                # content 스트림은 이미 펜스 포함 원본을 담고 있으므로
                # assistant_buf 누적은 content 한 곳에서만 수행한다.
                if chunk.kind == "content" and chunk.delta:
                    assistant_buf.append(chunk.delta)
                    yield _to_sse("content", {"delta": chunk.delta})
                elif chunk.kind == "artifact_start" and chunk.file_path:
                    streamed_paths.add(chunk.file_path)
                    artifact_bufs[chunk.file_path] = []
                    yield _to_sse("artifact_start", {"file_path": chunk.file_path})
                elif (
                    chunk.kind == "artifact_delta"
                    and chunk.file_path
                    and chunk.delta is not None
                ):
                    artifact_bufs.setdefault(chunk.file_path, []).append(chunk.delta)
                    yield _to_sse(
                        "artifact_delta",
                        {"file_path": chunk.file_path, "delta": chunk.delta},
                    )
                elif chunk.kind == "artifact_end" and chunk.file_path:
                    body = "".join(artifact_bufs.get(chunk.file_path, []))
                    # 말미 개행 한 개 정리 (펜스 닫힘 라인 전 개행 흡수)
                    snapshot_files[chunk.file_path] = body.rstrip("\n") + "\n"
                    yield _to_sse("artifact_end", {"file_path": chunk.file_path})
                elif chunk.kind == "done":
                    break
        except Exception as exc:
            yield _to_sse("error", {"message": str(exc)})
            return

        # assistant 메시지 영속화
        assistant_content = "".join(assistant_buf)
        assistant_msg = UIBuilderMessage(
            project_id=project.id,
            role="assistant",
            content=assistant_content,
        )
        self.db.add(assistant_msg)
        self.db.commit()
        self.db.refresh(assistant_msg)

        # 이번 턴에 새/변경된 파일이 있으면 스냅샷 자동 생성
        if streamed_paths and snapshot_files:
            try:
                snap = await self.snapshots.create(
                    project=project,
                    user_prompt=prompt,
                    files=snapshot_files,
                    message_id=assistant_msg.id,
                )
                yield _to_sse(
                    "snapshot_created",
                    {
                        "id": str(snap.id),
                        "slug": snap.slug,
                        "title": snap.title,
                        "created_at": snap.created_at.isoformat(),
                    },
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("auto snapshot failed: %s", exc)

        yield _to_sse("done", {"message_id": str(assistant_msg.id)})
