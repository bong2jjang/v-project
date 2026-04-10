"""
In-memory ring buffer for recent log entries.

LogViewer 대시보드 위젯에 실시간 로그를 제공하기 위한 메모리 버퍼.
"""

import logging
from collections import deque
from threading import Lock

_MAX_LINES = 2000
_buffer: deque[str] = deque(maxlen=_MAX_LINES)
_lock = Lock()


class BufferHandler(logging.Handler):
    """logging Handler that appends formatted records to the ring buffer."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = self.format(record)
            with _lock:
                _buffer.append(msg)
        except Exception:
            self.handleError(record)


def get_recent_logs(lines: int = 100) -> list[str]:
    """Return the last *lines* log entries."""
    with _lock:
        if lines >= len(_buffer):
            return list(_buffer)
        return list(_buffer)[-lines:]


def install(level: int = logging.INFO) -> None:
    """Attach the buffer handler to the root logger."""
    handler = BufferHandler()
    handler.setLevel(level)
    handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)-5s] %(name)s — %(message)s")
    )
    logging.getLogger().addHandler(handler)
