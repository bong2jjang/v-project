"""p032: 공통(shared) dashboard / help 메뉴 제거.

배경
----
v1 시절 p001 시드는 `dashboard`, `help` 를 공통(app_id=NULL) built_in 메뉴로
등록했다. 그러나 v-project 멀티앱 전환 이후 각 앱이 **자기 컨텍스트에 맞는
대시보드와 도움말**을 가져야 맞다는 결론에 도달했다. (예: 브리지는 채널
현황 대시보드, 포털은 런처 대시보드, ui-builder 는 프로젝트 목록 대시보드)

따라서 이 마이그레이션은 공통 dashboard/help 메뉴 행을 **제거**하고, 연결된
grants / user_permissions 는 FK CASCADE 로 자동 정리된다. 각 앱은 자체
마이그레이션에서 app_id 스코프의 대시보드/도움말 메뉴를 별도 등록한다.

또한 v-ui-builder 가 공통 dashboard 를 숨기려고 만들었던 `hide_shared`
마커 행(apps/v-ui-builder/backend/migrations/a006) 은 공통 dashboard 가
사라지면 더 이상 필요 없으므로 이 마이그레이션이 함께 제거한다.
(v-ui-builder a007 에서도 같은 행을 정리하도록 이중 안전망)

멱등성: DELETE 기반 — 이미 삭제된 경우 no-op.
"""

from __future__ import annotations

import logging

from sqlalchemy import text

logger = logging.getLogger(__name__)


def migrate(engine):
    with engine.connect() as conn:
        # 1) 공통 dashboard / help 메뉴 행 제거
        #    FK CASCADE 로 permission_group_grants / user_permissions 자동 정리.
        result = conn.execute(
            text(
                """
                DELETE FROM menu_items
                WHERE app_id IS NULL
                  AND menu_type = 'built_in'
                  AND permission_key IN ('dashboard', 'help')
                """
            )
        )
        removed_shared = result.rowcount or 0

        # 2) 공통 dashboard 를 숨기기 위해 존재하던 hide_shared 마커 행 제거.
        #    (대상 공통 행이 이미 사라졌으므로 마커도 불필요)
        result = conn.execute(
            text(
                """
                DELETE FROM menu_items
                WHERE menu_type = 'hide_shared'
                  AND permission_key IN ('dashboard', 'help')
                """
            )
        )
        removed_markers = result.rowcount or 0

        conn.commit()
        logger.info(
            "p032: removed shared dashboard/help rows=%d, hide_shared markers=%d",
            removed_shared,
            removed_markers,
        )
