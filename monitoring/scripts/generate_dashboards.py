"""
v-project 앱별 Grafana 대시보드 생성기.

각 앱에 대해 2개의 대시보드를 생성합니다:
  - {app}-overview.json : 메트릭 요약 (4 stat + 3~4 timeseries + 주요 엔드포인트)
  - {app}-logs.json     : 로그 분석 (볼륨/레벨/스트림)

모든 패널에 한국어 `description` 을 부여해 의미를 이해할 수 있게 합니다.
프로메테우스 라벨 모델:
  - job="v-platform-apps", app="<app-name>"
  - http_requests_total{method,endpoint,status}
  - http_request_duration_seconds_bucket{method,endpoint,le}
Loki 라벨:
  - container="v-project-{app}-backend" (예외: v-ui-builder-backend)
  - app 라벨은 promtail pipeline 이 JSON 로그에서 추출

사용: docker compose exec grafana(없음) — 호스트에서 직접 실행
  python monitoring/scripts/generate_dashboards.py
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# 앱 메타 — DNS targets 는 prometheus.yml 과 일치해야 함
APPS: list[dict[str, Any]] = [
    {
        "app": "v-channel-bridge",
        "title": "v-channel-bridge — Slack ↔ Teams 브리지",
        "container_regex": "v-project-bridge-.*",
        "domain_endpoints_regex": "/api/(messages|bridge|routes|channels).*",
        "domain_title": "브리지 메시지·라우팅 API",
    },
    {
        "app": "v-platform-portal",
        "title": "v-platform-portal — 통합 포털",
        "container_regex": "v-project-portal-.*",
        "domain_endpoints_regex": "/api/(apps|sso|relay).*",
        "domain_title": "포털 AppRegistry·SSO Relay API",
    },
    {
        "app": "v-platform-template",
        "title": "v-platform-template — 앱 스캐폴딩 템플릿",
        "container_regex": "v-project-template-.*",
        "domain_endpoints_regex": "/api/.*",
        "domain_title": "템플릿 API",
    },
    {
        "app": "v-ui-builder",
        "title": "v-ui-builder — AI UI 빌더",
        "container_regex": "v-ui-builder-.*",
        "domain_endpoints_regex": "/api/(chat|generate|llm|canvas).*",
        "domain_title": "AI Chat·UI 생성 API",
    },
    {
        "app": "v-itsm",
        "title": "v-itsm — 업무 루프 관리 (ITSM)",
        "container_regex": "v-project-itsm-.*",
        "domain_endpoints_regex": "/api/(tickets|sla|kpi|loops|transitions).*",
        "domain_title": "ITSM 티켓·SLA·Loop API",
    },
]

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "grafana" / "dashboards" / "app-specific"


def ds_prom() -> dict[str, str]:
    return {"type": "prometheus", "uid": "Prometheus"}


def ds_loki() -> dict[str, str]:
    return {"type": "loki", "uid": "Loki"}


def stat_panel(
    pid: int, x: int, y: int, w: int, h: int, *, title: str, desc: str, expr: str,
    unit: str = "none", thresholds: list[dict[str, Any]] | None = None,
    mappings: list[dict[str, Any]] | None = None, color_mode: str = "background",
) -> dict[str, Any]:
    return {
        "type": "stat",
        "id": pid,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "title": title,
        "description": desc,
        "datasource": ds_prom(),
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "thresholds"},
                "unit": unit,
                "mappings": mappings or [],
                "thresholds": {"mode": "absolute", "steps": thresholds or [{"color": "green", "value": None}]},
            }
        },
        "options": {
            "colorMode": color_mode,
            "graphMode": "area",
            "justifyMode": "center",
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "textMode": "auto",
        },
        "targets": [{"expr": expr, "instant": True, "refId": "A"}],
    }


def timeseries_panel(
    pid: int, x: int, y: int, w: int, h: int, *, title: str, desc: str,
    targets: list[dict[str, Any]], unit: str = "none",
    thresholds: list[dict[str, Any]] | None = None, stacked: bool = False,
) -> dict[str, Any]:
    custom = {
        "drawStyle": "line",
        "fillOpacity": 15,
        "lineWidth": 2,
        "showPoints": "never",
        "spanNulls": False,
    }
    if stacked:
        custom["stacking"] = {"mode": "normal", "group": "A"}
        custom["fillOpacity"] = 40
        custom["lineWidth"] = 1
    return {
        "type": "timeseries",
        "id": pid,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "title": title,
        "description": desc,
        "datasource": ds_prom(),
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "palette-classic"},
                "unit": unit,
                "custom": custom,
                "thresholds": {"mode": "absolute", "steps": thresholds or [{"color": "green", "value": None}]},
            }
        },
        "options": {
            "legend": {"displayMode": "table", "placement": "bottom", "calcs": ["mean", "max"]},
            "tooltip": {"mode": "multi", "sort": "desc"},
        },
        "targets": targets,
    }


def text_panel(pid: int, x: int, y: int, w: int, h: int, content: str) -> dict[str, Any]:
    return {
        "type": "text",
        "id": pid,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "options": {"mode": "markdown", "content": content},
    }


def logs_panel(
    pid: int, x: int, y: int, w: int, h: int, *, title: str, desc: str, expr: str,
) -> dict[str, Any]:
    return {
        "type": "logs",
        "id": pid,
        "gridPos": {"x": x, "y": y, "w": w, "h": h},
        "title": title,
        "description": desc,
        "datasource": ds_loki(),
        "options": {
            "dedupStrategy": "none",
            "enableLogDetails": True,
            "prettifyLogMessage": True,
            "showCommonLabels": False,
            "showLabels": True,
            "showTime": True,
            "sortOrder": "Descending",
            "wrapLogMessage": True,
        },
        "targets": [{"expr": expr, "refId": "A"}],
    }


def build_overview(meta: dict[str, Any]) -> dict[str, Any]:
    app = meta["app"]
    title = meta["title"]
    container_re = meta["container_regex"]
    domain_re = meta["domain_endpoints_regex"]
    domain_title = meta["domain_title"]

    panels: list[dict[str, Any]] = [
        text_panel(
            100, 0, 0, 24, 3,
            f"## {title}\n\n**대상 앱**: `app=\"{app}\"` · **컨테이너**: `{container_re}`\n\n상단 4개 카드는 SLO 핵심(생사/처리량/에러율/지연), 그 아래는 트래픽·도메인 엔드포인트·컨테이너 리소스, 최하단은 최근 에러/경고 로그. "
            "본격 로그 분석은 `{app}-logs` 대시보드 사용.",
        ),
        stat_panel(
            1, 0, 3, 6, 5,
            title="백엔드 상태",
            desc=f"Prometheus가 {app} /metrics 엔드포인트에 도달 가능한지. 1=UP, 0=DOWN. DOWN 상태 1분 지속 시 PlatformAppDown 알림.",
            expr=f"up{{job=\"v-platform-apps\",app=\"{app}\"}}",
            mappings=[{"type": "value", "options": {"0": {"color": "red", "text": "DOWN"}, "1": {"color": "green", "text": "UP"}}}],
            thresholds=[{"color": "red", "value": None}, {"color": "green", "value": 1}],
        ),
        stat_panel(
            2, 6, 3, 6, 5,
            title="API 처리량 (req/s)",
            desc="지난 1분 동안 초당 HTTP 요청 수. 트래픽 스파이크/드랍 탐지용.",
            expr=f"sum(rate(http_requests_total{{job=\"v-platform-apps\",app=\"{app}\"}}[1m]))",
            unit="reqps",
            color_mode="value",
        ),
        stat_panel(
            3, 12, 3, 6, 5,
            title="5xx 에러율 (%)",
            desc="5분 평균 기준 5xx/전체 응답 비율. 1% 초과 시 주의, 5% 초과 5분 지속 시 PlatformAppHighErrorRate 알림.",
            expr=(
                f"sum(rate(http_requests_total{{job=\"v-platform-apps\",app=\"{app}\",status=~\"5..\"}}[5m]))"
                f" / sum(rate(http_requests_total{{job=\"v-platform-apps\",app=\"{app}\"}}[5m])) * 100"
            ),
            unit="percent",
            thresholds=[
                {"color": "green", "value": None},
                {"color": "yellow", "value": 1},
                {"color": "red", "value": 5},
            ],
        ),
        stat_panel(
            4, 18, 3, 6, 5,
            title="P95 응답시간 (ms)",
            desc="5분 윈도 P95 지연. 사용자가 체감하는 느린 응답의 지표. 2000ms 초과 5분 지속 시 PlatformAppSlowResponse 알림.",
            expr=(
                "histogram_quantile(0.95, sum by (le) ("
                f"rate(http_request_duration_seconds_bucket{{job=\"v-platform-apps\",app=\"{app}\"}}[5m])"
                ")) * 1000"
            ),
            unit="ms",
            thresholds=[
                {"color": "green", "value": None},
                {"color": "yellow", "value": 500},
                {"color": "red", "value": 2000},
            ],
        ),
        timeseries_panel(
            5, 0, 8, 12, 8,
            title="HTTP 요청 처리량 (상위 엔드포인트)",
            desc=f"{app}의 엔드포인트별 초당 요청 수(상위 10개). 특정 엔드포인트 트래픽 쏠림이나 급감을 확인.",
            targets=[
                {
                    "expr": f"topk(10, sum by (endpoint) (rate(http_requests_total{{job=\"v-platform-apps\",app=\"{app}\"}}[5m])))",
                    "legendFormat": "{{endpoint}}",
                    "refId": "A",
                }
            ],
            unit="reqps",
        ),
        timeseries_panel(
            6, 12, 8, 12, 8,
            title="응답 상태코드 분포",
            desc="상태코드별 req/s 스택. 2xx 감소 + 5xx 증가는 장애 패턴.",
            targets=[
                {
                    "expr": f"sum by (status) (rate(http_requests_total{{job=\"v-platform-apps\",app=\"{app}\"}}[5m]))",
                    "legendFormat": "HTTP {{status}}",
                    "refId": "A",
                }
            ],
            unit="reqps",
            stacked=True,
        ),
        timeseries_panel(
            7, 0, 16, 12, 8,
            title=domain_title,
            desc=f"앱 주요 도메인 엔드포인트({domain_re}) 별 처리량. 핵심 비즈니스 호출의 건강 상태.",
            targets=[
                {
                    "expr": (
                        "sum by (endpoint, status) (rate(http_requests_total{"
                        f"job=\"v-platform-apps\",app=\"{app}\",endpoint=~\"{domain_re}\"}}[5m]))"
                    ),
                    "legendFormat": "{{endpoint}} [{{status}}]",
                    "refId": "A",
                }
            ],
            unit="reqps",
        ),
        timeseries_panel(
            8, 12, 16, 12, 8,
            title="응답시간 분포 (P50/P95/P99)",
            desc="요청 지연의 백분위 히스토그램. P50(중앙값) vs P95/P99 간 격차가 크면 tail latency 문제(느린 쿼리·외부 호출).",
            targets=[
                {
                    "expr": (
                        "histogram_quantile(0.50, sum by (le) (rate(http_request_duration_seconds_bucket{"
                        f"job=\"v-platform-apps\",app=\"{app}\"}}[5m]))) * 1000"
                    ),
                    "legendFormat": "P50",
                    "refId": "A",
                },
                {
                    "expr": (
                        "histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{"
                        f"job=\"v-platform-apps\",app=\"{app}\"}}[5m]))) * 1000"
                    ),
                    "legendFormat": "P95",
                    "refId": "B",
                },
                {
                    "expr": (
                        "histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{"
                        f"job=\"v-platform-apps\",app=\"{app}\"}}[5m]))) * 1000"
                    ),
                    "legendFormat": "P99",
                    "refId": "C",
                },
            ],
            unit="ms",
        ),
        timeseries_panel(
            9, 0, 24, 12, 8,
            title="컨테이너 CPU (%)",
            desc=f"{app} 관련 컨테이너({container_re})의 CPU 사용률. 지속 80% 초과 시 ContainerHighCPU 알림.",
            targets=[
                {
                    "expr": f"rate(container_cpu_usage_seconds_total{{name=~\"{container_re}\"}}[5m]) * 100",
                    "legendFormat": "{{name}}",
                    "refId": "A",
                }
            ],
            unit="percent",
            thresholds=[{"color": "green", "value": None}, {"color": "yellow", "value": 60}, {"color": "red", "value": 80}],
        ),
        timeseries_panel(
            10, 12, 24, 12, 8,
            title="컨테이너 메모리",
            desc=f"{app} 컨테이너 RSS 메모리. 지속 증가 패턴은 메모리 누수 의심.",
            targets=[
                {
                    "expr": f"container_memory_usage_bytes{{name=~\"{container_re}\"}}",
                    "legendFormat": "{{name}}",
                    "refId": "A",
                }
            ],
            unit="bytes",
            thresholds=[{"color": "green", "value": None}, {"color": "yellow", "value": 536870912}, {"color": "red", "value": 1073741824}],
        ),
        logs_panel(
            11, 0, 32, 24, 10,
            title="최근 에러·경고 로그",
            desc=f"{app} 컨테이너의 error/warning 로그. 본격 조사는 '{app} — 로그' 대시보드에서.",
            expr=(
                f"{{container=~\"{container_re}\"}} | json | level=~\"error|warning\" "
                "| line_format \"[{{.level}}] {{.event}} {{.message}}\""
            ),
        ),
    ]

    return {
        "annotations": {"list": [{"builtIn": 1, "datasource": {"type": "grafana", "uid": "-- Grafana --"}, "enable": True, "hide": True, "iconColor": "rgba(0, 211, 255, 1)", "name": "Annotations & Alerts", "type": "dashboard"}]},
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 1,
        "id": None,
        "links": [{"title": "← 통합 플랫폼 대시보드", "type": "link", "url": "/d/v-project-platform-overview", "icon": "dashboard", "tags": []}],
        "liveNow": False,
        "panels": panels,
        "refresh": "30s",
        "schemaVersion": 39,
        "style": "dark",
        "tags": ["v-project", app, "overview"],
        "templating": {"list": []},
        "time": {"from": "now-1h", "to": "now"},
        "timepicker": {},
        "timezone": "browser",
        "title": f"{app} — 시스템 개요",
        "uid": f"v-project-{app}-overview",
        "version": 2,
        "weekStart": "",
    }


def build_logs(meta: dict[str, Any]) -> dict[str, Any]:
    app = meta["app"]
    title = meta["title"]
    container_re = meta["container_regex"]

    panels: list[dict[str, Any]] = [
        text_panel(
            100, 0, 0, 24, 3,
            f"## {title} — 로그\n\n**컨테이너**: `{container_re}` · **레이블**: `level`, `event`, `service`, `container`\n\n상단 카드는 로그 볼륨·에러율, 중간은 레벨 분포, 하단은 필터 가능한 로그 스트림. "
            "템플릿 변수 `level`과 `search`로 실시간 필터 가능.",
        ),
        {
            "type": "stat",
            "id": 1,
            "gridPos": {"x": 0, "y": 3, "w": 8, "h": 5},
            "title": "로그 볼륨 (줄/초)",
            "description": "5분 평균 로그 유입 속도. 급격한 증가는 특정 오류 루프나 디버그 레벨 활성화 의심.",
            "datasource": ds_loki(),
            "fieldConfig": {"defaults": {"color": {"mode": "thresholds"}, "unit": "cps", "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}]}}},
            "options": {"colorMode": "value", "graphMode": "area", "reduceOptions": {"calcs": ["lastNotNull"], "fields": ""}, "textMode": "auto"},
            "targets": [{"expr": f"sum(rate({{container=~\"{container_re}\"}}[5m]))", "refId": "A"}],
        },
        {
            "type": "stat",
            "id": 2,
            "gridPos": {"x": 8, "y": 3, "w": 8, "h": 5},
            "title": "에러 로그 비율 (%)",
            "description": "5분 평균 error 레벨 로그 / 전체 로그 비율. 배포 직후 급증 여부 확인에 유용.",
            "datasource": ds_loki(),
            "fieldConfig": {"defaults": {"color": {"mode": "thresholds"}, "unit": "percent", "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "yellow", "value": 1}, {"color": "red", "value": 5}]}}},
            "options": {"colorMode": "background", "graphMode": "area", "reduceOptions": {"calcs": ["lastNotNull"], "fields": ""}, "textMode": "auto"},
            "targets": [
                {
                    "expr": (
                        f"sum(rate({{container=~\"{container_re}\"}} | json | level=\"error\" [5m]))"
                        f" / sum(rate({{container=~\"{container_re}\"}} | json [5m])) * 100"
                    ),
                    "refId": "A",
                }
            ],
        },
        {
            "type": "stat",
            "id": 3,
            "gridPos": {"x": 16, "y": 3, "w": 8, "h": 5},
            "title": "경고 로그 비율 (%)",
            "description": "5분 평균 warning 레벨 로그 / 전체 로그 비율. error 로 전환되기 전 선행 신호.",
            "datasource": ds_loki(),
            "fieldConfig": {"defaults": {"color": {"mode": "thresholds"}, "unit": "percent", "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}, {"color": "yellow", "value": 5}, {"color": "red", "value": 15}]}}},
            "options": {"colorMode": "background", "graphMode": "area", "reduceOptions": {"calcs": ["lastNotNull"], "fields": ""}, "textMode": "auto"},
            "targets": [
                {
                    "expr": (
                        f"sum(rate({{container=~\"{container_re}\"}} | json | level=\"warning\" [5m]))"
                        f" / sum(rate({{container=~\"{container_re}\"}} | json [5m])) * 100"
                    ),
                    "refId": "A",
                }
            ],
        },
        {
            "type": "timeseries",
            "id": 4,
            "gridPos": {"x": 0, "y": 8, "w": 24, "h": 7},
            "title": "레벨별 로그 유입률",
            "description": "시간당 레벨(error/warning/info/debug) 별 로그 유입 추이. 스파이크 시간을 특정하여 로그 스트림에서 조사.",
            "datasource": ds_loki(),
            "fieldConfig": {"defaults": {"color": {"mode": "palette-classic"}, "unit": "cps", "custom": {"drawStyle": "line", "fillOpacity": 40, "lineWidth": 1, "showPoints": "never", "stacking": {"mode": "normal", "group": "A"}}}},
            "options": {"legend": {"displayMode": "table", "placement": "bottom", "calcs": ["mean", "max"]}, "tooltip": {"mode": "multi", "sort": "desc"}},
            "targets": [
                {
                    "expr": f"sum by (level) (rate({{container=~\"{container_re}\"}} | json [5m]))",
                    "legendFormat": "{{level}}",
                    "refId": "A",
                }
            ],
        },
        logs_panel(
            5, 0, 15, 24, 13,
            title="필터된 로그 스트림",
            desc=f"템플릿 변수 $level·$search 로 실시간 필터. 기본은 error/warning 만 표시. 전체 레벨 보기는 $level 에 `info|debug` 추가.",
            expr=(
                f"{{container=~\"{container_re}\"}} | json | level=~\"$level\" "
                "|~ \"$search\" | line_format \"[{{.level}}] {{.event}} {{.message}}\""
            ),
        ),
    ]

    return {
        "annotations": {"list": [{"builtIn": 1, "datasource": {"type": "grafana", "uid": "-- Grafana --"}, "enable": True, "hide": True, "iconColor": "rgba(0, 211, 255, 1)", "name": "Annotations & Alerts", "type": "dashboard"}]},
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 1,
        "id": None,
        "links": [{"title": "← 앱 시스템 개요", "type": "link", "url": f"/d/v-project-{app}-overview", "icon": "dashboard", "tags": []}],
        "liveNow": False,
        "panels": panels,
        "refresh": "30s",
        "schemaVersion": 39,
        "style": "dark",
        "tags": ["v-project", app, "logs"],
        "templating": {
            "list": [
                {
                    "name": "level",
                    "label": "로그 레벨",
                    "type": "custom",
                    "current": {"text": "error|warning", "value": "error|warning", "selected": True},
                    "options": [
                        {"text": "error|warning", "value": "error|warning", "selected": True},
                        {"text": "error", "value": "error", "selected": False},
                        {"text": "warning", "value": "warning", "selected": False},
                        {"text": "info|error|warning", "value": "info|error|warning", "selected": False},
                        {"text": "debug|info|error|warning", "value": "debug|info|error|warning", "selected": False},
                    ],
                    "query": "error|warning,error,warning,info|error|warning,debug|info|error|warning",
                    "includeAll": False,
                    "multi": False,
                },
                {
                    "name": "search",
                    "label": "검색어 (정규식)",
                    "type": "textbox",
                    "current": {"text": "", "value": "", "selected": True},
                    "query": "",
                },
            ]
        },
        "time": {"from": "now-1h", "to": "now"},
        "timepicker": {},
        "timezone": "browser",
        "title": f"{app} — 로그",
        "uid": f"v-project-{app}-logs",
        "version": 2,
        "weekStart": "",
    }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    generated: list[str] = []
    for meta in APPS:
        app = meta["app"]
        overview = build_overview(meta)
        logs = build_logs(meta)
        (OUTPUT_DIR / f"{app}-overview.json").write_text(
            json.dumps(overview, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        (OUTPUT_DIR / f"{app}-logs.json").write_text(
            json.dumps(logs, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        generated.append(f"{app}-overview.json")
        generated.append(f"{app}-logs.json")
    print(f"[OK] {len(generated)} 파일 생성됨 → {OUTPUT_DIR}")
    for f in generated:
        print(f"  - {f}")


if __name__ == "__main__":
    main()
