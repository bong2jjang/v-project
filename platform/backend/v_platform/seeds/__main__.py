"""Seed runner CLI entry point.

Usage:
    python -m v_platform.seeds --level base     # 최소 시드 (fresh install)
    python -m v_platform.seeds --level demo     # 데모 데이터 포함
    python -m v_platform.seeds --level demo --reset  # 기존 시드 데이터 삭제 후 재삽입
"""

import argparse
import logging
import sys

from v_platform.seeds.runner import run_seeds


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")

    parser = argparse.ArgumentParser(description="v-platform seed data loader")
    parser.add_argument(
        "--level",
        choices=["base", "demo"],
        default="base",
        help="Seed level: base (fresh install) or demo (test data included)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing seed data before inserting (demo level only)",
    )
    args = parser.parse_args()

    success = run_seeds(level=args.level, reset=args.reset)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
