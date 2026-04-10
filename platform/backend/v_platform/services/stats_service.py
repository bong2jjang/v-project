"""Generic statistics aggregation helpers

Provides reusable aggregation patterns (by date, category, etc.)
for any v-platform app.

Usage:
    from v_platform.services.stats_service import StatsService

    daily = StatsService.aggregate_by_date(query, DateColumn, days=30)
    category = StatsService.aggregate_by_category(query, CategoryColumn)
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Query


class StatsService:
    """Reusable statistics aggregation helpers."""

    @staticmethod
    def aggregate_by_date(
        query: Query,
        date_column,
        days: int = 30,
        count_column=None,
    ) -> list[dict[str, Any]]:
        """Aggregate counts by date.

        Returns:
            [{"date": "2026-04-01", "count": 42}, ...]
        """
        since = datetime.now(timezone.utc) - timedelta(days=days)
        q = (
            query.filter(date_column >= since)
            .with_entities(
                cast(date_column, Date).label("date"),
                func.count(count_column or date_column).label("count"),
            )
            .group_by(cast(date_column, Date))
            .order_by(cast(date_column, Date))
        )
        return [{"date": str(row.date), "count": row.count} for row in q.all()]

    @staticmethod
    def aggregate_by_category(
        query: Query,
        category_column,
        count_column=None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Aggregate counts by category.

        Returns:
            [{"category": "slack", "count": 100}, ...]
        """
        q = (
            query.with_entities(
                category_column.label("category"),
                func.count(count_column or category_column).label("count"),
            )
            .group_by(category_column)
            .order_by(func.count(count_column or category_column).desc())
            .limit(limit)
        )
        return [{"category": str(row.category), "count": row.count} for row in q.all()]

    @staticmethod
    def aggregate_by_hour(
        query: Query,
        timestamp_column,
        days: int = 7,
    ) -> list[dict[str, Any]]:
        """Aggregate counts by hour of day.

        Returns:
            [{"hour": 0, "count": 5}, {"hour": 1, "count": 3}, ...]
        """
        since = datetime.now(timezone.utc) - timedelta(days=days)
        q = (
            query.filter(timestamp_column >= since)
            .with_entities(
                func.extract("hour", timestamp_column).label("hour"),
                func.count().label("count"),
            )
            .group_by(func.extract("hour", timestamp_column))
            .order_by("hour")
        )
        return [{"hour": int(row.hour), "count": row.count} for row in q.all()]
