"""ChatService — 대화 히스토리 조립 + LLM Provider 호출 + 메시지 영속화."""

from __future__ import annotations

import json
from typing import AsyncIterator
from uuid import UUID

from sqlalchemy.orm import Session

from app.llm.base import ArtifactFile, ChatMessage
from app.llm.registry import get_provider
from app.models import UIBuilderMessage, UIBuilderProject

from .project_service import ProjectService


SYSTEM_PROMPT = """당신은 React + TypeScript UI 컴포넌트를 작성하는 숙련된 프론트엔드 개발자입니다.

규칙:
1. 사용자가 요청한 UI 는 **Sandpack react-ts 템플릿**에서 바로 실행 가능해야 합니다.
2. 새 파일이나 수정 파일은 반드시 아래 형식의 코드 펜스로 감쌉니다:

   ```tsx file=/src/App.tsx
   ...전체 파일 내용...
   ```

   - 언어 태그(`tsx`/`ts`/`css`)는 파일 확장자에 맞춥니다.
   - `file=` 경로는 반드시 `/src/...` 로 시작하는 절대 경로.
   - 한 블록 = 한 파일의 **전체 내용** (부분 수정 금지).

3. 펜스 밖 텍스트는 사용자에게 보여줄 간단한 설명만 씁니다 (3줄 이내).
4. 외부 npm 패키지는 import 하지 않습니다 (react / react-dom 만 허용).
5. Tailwind 가 이미 적용되어 있다고 가정합니다.
"""


def _to_sse(event: str, data: dict) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode()


class ChatService:
    def __init__(self, db: Session):
        self.db = db
        self.projects = ProjectService(db)

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

    async def stream(
        self,
        project_id: UUID,
        user_id: int,
        prompt: str,
        model: str | None = None,
    ) -> AsyncIterator[bytes]:
        project: UIBuilderProject = self.projects.get_owned(project_id, user_id)

        # 사용자 메시지 먼저 영속화
        user_msg = UIBuilderMessage(
            project_id=project.id, role="user", content=prompt
        )
        self.db.add(user_msg)
        self.db.commit()

        history = self._history(project.id)
        files = self._file_context(project.id, user_id)
        provider = get_provider(project.llm_provider)

        assistant_buf: list[str] = []
        try:
            async for chunk in provider.stream(
                messages=history,
                system_prompt=SYSTEM_PROMPT,
                file_context=files,
                model=model or project.llm_model,
            ):
                if chunk.kind == "content" and chunk.delta:
                    assistant_buf.append(chunk.delta)
                    yield _to_sse("content", {"delta": chunk.delta})
                elif chunk.kind == "artifact_start":
                    yield _to_sse("artifact_start", {"file_path": chunk.file_path})
                elif chunk.kind == "artifact_delta" and chunk.delta is not None:
                    assistant_buf.append(chunk.delta)
                    yield _to_sse(
                        "artifact_delta",
                        {"file_path": chunk.file_path, "delta": chunk.delta},
                    )
                elif chunk.kind == "artifact_end":
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

        yield _to_sse("done", {"message_id": str(assistant_msg.id)})
