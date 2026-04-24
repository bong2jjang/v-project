"""Migrate filesystem uploads (avatars + images) into uploaded_files table.

p029에서 생성한 uploaded_files 테이블로, 기존 파일시스템에 저장된
이미지/아바타를 일회성으로 이관합니다.

- 이 마이그레이션은 파일시스템 접근이 있는 backend에서만 실질적으로 동작합니다
  (bridge-backend에만 legacy volume이 마운트되어 있음). 다른 앱 backend에서는
  스캔 경로가 비어 있어 조용히 종료됩니다.
- URL 포맷을 유지하기 위해: 파일명 `{uuid}.{ext}` → DB id = `{uuid}` (확장자 제거)
  users.avatar_url 업데이트 — `/api/uploads/avatars/{uuid}.png` → `/api/uploads/avatars/{uuid}`
- 한 번 이관되면 uploaded_files 테이블에 이미 존재하는 id는 스킵(멱등).
"""

import logging
import os
import pathlib
from sqlalchemy import text

logger = logging.getLogger(__name__)


MIME_BY_EXT = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


def _import_dir(conn, root: pathlib.Path, purpose: str) -> tuple[int, int]:
    """root 디렉토리의 파일을 DB로 이관. (imported, skipped) 반환."""
    if not root.is_dir():
        return 0, 0

    imported = 0
    skipped = 0
    for entry in root.iterdir():
        if not entry.is_file():
            continue
        stem = entry.stem
        ext = entry.suffix.lower()
        mime = MIME_BY_EXT.get(ext)
        if not mime:
            continue

        existing = conn.execute(
            text("SELECT id FROM uploaded_files WHERE id = :id"),
            {"id": stem},
        ).fetchone()
        if existing:
            skipped += 1
            continue

        try:
            data = entry.read_bytes()
        except OSError as e:
            logger.warning(f"p030: failed to read {entry}: {e}")
            continue

        conn.execute(
            text(
                """
                INSERT INTO uploaded_files
                    (id, content, mime_type, size, purpose, uploaded_by, uploaded_at)
                VALUES
                    (:id, :content, :mime, :size, :purpose, NULL, NOW())
                """
            ),
            {
                "id": stem,
                "content": data,
                "mime": mime,
                "size": len(data),
                "purpose": purpose,
            },
        )
        imported += 1
    return imported, skipped


def _normalize_avatar_urls(conn) -> int:
    """users.avatar_url에 붙어 있는 확장자를 제거해 새 URL 형식으로 정규화."""
    rows = conn.execute(
        text(
            "SELECT id, avatar_url FROM users "
            "WHERE avatar_url LIKE '/api/uploads/avatars/%.%'"
        )
    ).fetchall()

    updated = 0
    for row in rows:
        url = row.avatar_url
        last = url.rsplit("/", 1)[-1]
        if "." not in last:
            continue
        stem = last.rsplit(".", 1)[0]
        new_url = f"/api/uploads/avatars/{stem}"
        conn.execute(
            text("UPDATE users SET avatar_url = :url WHERE id = :id"),
            {"url": new_url, "id": row.id},
        )
        updated += 1
    return updated


def migrate(engine):
    # uploaded_files 테이블 존재 확인 (p029 의존)
    with engine.connect() as conn:
        table = conn.execute(
            text(
                "SELECT 1 FROM information_schema.tables "
                "WHERE table_name = 'uploaded_files'"
            )
        ).fetchone()
        if not table:
            logger.warning("p030: uploaded_files table missing, skipping")
            return

    # 파일시스템 스캔 경로
    base = pathlib.Path(os.environ.get("DATABASE_DIR", "/app/data")) / "uploads"
    avatars_dir = base / "avatars"
    images_dir = base / "images"

    if not base.is_dir():
        logger.info("p030: no uploads directory, nothing to migrate")
        return

    with engine.connect() as conn:
        av_imp, av_skip = _import_dir(conn, avatars_dir, "avatar")
        im_imp, im_skip = _import_dir(conn, images_dir, "image")
        url_updated = _normalize_avatar_urls(conn)
        conn.commit()

    logger.info(
        f"p030: avatars imported={av_imp} skipped={av_skip}, "
        f"images imported={im_imp} skipped={im_skip}, "
        f"avatar_url normalized={url_updated}"
    )
