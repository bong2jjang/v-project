"""Generic filter options generator

Provides reusable utilities for generating dynamic filter parameters
from database columns.

Usage:
    from v_platform.utils.filters import get_distinct_values

    options = get_distinct_values(db, MyModel.category, MyModel.is_active == True)
"""

from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session


def get_distinct_values(
    db: Session,
    column,
    *filters,
    limit: int = 100,
) -> list[str]:
    """Get distinct non-null values from a column.

    Args:
        db: SQLAlchemy session
        column: Column to get distinct values from
        filters: Additional filter expressions
        limit: Maximum number of distinct values

    Returns:
        Sorted list of distinct string values
    """
    query = db.query(func.distinct(column)).filter(column.isnot(None))
    for f in filters:
        query = query.filter(f)
    rows = query.limit(limit).all()
    return sorted([str(row[0]) for row in rows if row[0]])


def apply_date_range(query, column, start_date=None, end_date=None):
    """Apply date range filter to query.

    Args:
        query: SQLAlchemy query
        column: DateTime column to filter
        start_date: Start date (inclusive)
        end_date: End date (inclusive)

    Returns:
        Filtered query
    """
    if start_date:
        query = query.filter(column >= start_date)
    if end_date:
        query = query.filter(column <= end_date)
    return query


def apply_pagination(query, page: int = 1, per_page: int = 20):
    """Apply pagination to query.

    Returns:
        (paginated_query, total_count)
    """
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return items, total
