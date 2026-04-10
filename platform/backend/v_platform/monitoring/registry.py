"""App metrics registry — allows apps to register custom Prometheus metrics."""

from typing import Any

_app_metrics: list[Any] = []


def register_app_metrics(*metrics):
    """Register app-specific Prometheus metrics.

    Usage:
        from v_platform.monitoring import register_app_metrics
        from prometheus_client import Counter

        MY_COUNTER = Counter("my_app_requests", "My app requests")
        register_app_metrics(MY_COUNTER)
    """
    _app_metrics.extend(metrics)


def get_registered_metrics() -> list:
    return list(_app_metrics)
