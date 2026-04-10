"""Platform standardized logging configuration

Provides consistent JSON-formatted logging with app_name labels
across all v-platform apps.
"""

import os
import logging
import structlog


def configure_platform_logging(
    app_name: str,
    log_level: str = "INFO",
):
    """Configure standardized platform logging.

    Sets up structlog with JSON output and automatic app_name injection.
    Call this once at app startup.

    Args:
        app_name: Application identifier (e.g., "v-channel-bridge")
        log_level: Logging level (default: INFO, override with LOG_LEVEL env var)
    """
    level = os.environ.get("LOG_LEVEL", log_level).upper()

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.UnicodeDecoder(),
            _add_app_name(app_name),
            structlog.processors.JSONRenderer() if os.environ.get("LOG_FORMAT") != "console"
            else structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(levelname)-8s %(name)s %(message)s",
    )

    # Suppress noisy third-party loggers
    for noisy in ("slack_bolt", "slack_sdk", "aiohttp", "asyncio", "httpx"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def _add_app_name(app_name: str):
    """Structlog processor that adds app name to every log entry."""
    def processor(logger, method_name, event_dict):
        event_dict["app"] = app_name
        return event_dict
    return processor
