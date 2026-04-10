"""Generic data export service (CSV / JSON)

Provides reusable export utilities that any v-platform app can use.

Usage:
    from v_platform.services.export_service import ExportService

    csv_response = ExportService.to_csv(
        rows=[{"name": "A", "value": 1}],
        columns=["name", "value"],
        filename="export.csv",
    )
"""

import csv
import io
import json
from datetime import datetime, timezone
from typing import Any, Sequence

from fastapi.responses import StreamingResponse


class ExportService:
    """Reusable data export utilities."""

    @staticmethod
    def to_csv(
        rows: Sequence[dict[str, Any]],
        columns: list[str],
        filename: str = "export.csv",
        column_labels: dict[str, str] | None = None,
    ) -> StreamingResponse:
        """Export rows as CSV file download.

        Args:
            rows: List of dicts (each dict is a row)
            columns: Column keys to include
            filename: Download filename
            column_labels: Optional display names for columns
        """
        labels = column_labels or {}
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([labels.get(c, c) for c in columns])

        # Data
        for row in rows:
            writer.writerow([row.get(c, "") for c in columns])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )

    @staticmethod
    def to_json(
        rows: Sequence[dict[str, Any]],
        filename: str = "export.json",
    ) -> StreamingResponse:
        """Export rows as JSON file download."""
        content = json.dumps(rows, ensure_ascii=False, indent=2, default=str)
        return StreamingResponse(
            iter([content]),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
            },
        )

    @staticmethod
    def generate_filename(prefix: str, ext: str = "csv") -> str:
        """Generate timestamped filename: prefix_20260411_120000.csv"""
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        return f"{prefix}_{ts}.{ext}"
