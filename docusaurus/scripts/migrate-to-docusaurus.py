#!/usr/bin/env python3
"""
VMS Chat Ops 문서를 Docusaurus 포맷으로 마이그레이션하는 스크립트

Usage:
    python migrate-to-docusaurus.py
"""
import os
import re
import shutil
from pathlib import Path
from typing import Dict, Optional
import json


# 디렉토리 매핑
DIR_MAPPING = {
    "guides/user": "docs/user-guide",
    "guides/admin": "docs/admin-guide",
    "guides/developer": "docs/developer-guide",
    "project": "docs/developer-guide",
    "api": "docs/api",
    "design/proposals": "blog",
    "reports/progress": "blog",
}

# 파일별 sidebar position
SIDEBAR_POSITIONS = {
    # User Guide
    "USER_GUIDE.md": 1,
    "DASHBOARD_GUIDE.md": 2,
    "LOGIN_INFO.md": 3,
    "COMPLETION_SUMMARY.md": 4,

    # Admin Guide
    "ADMIN_GUIDE.md": 1,
    "DEPLOYMENT.md": 2,
    "MONITORING_SETUP.md": 3,
    "SLACK_SETUP.md": 4,
    "TEAMS_SETUP.md": 5,
    "EMAIL_SETUP.md": 6,
    "SSL_TLS_SETUP.md": 7,
    "POSTGRESQL_MIGRATION.md": 8,
    "TROUBLESHOOTING.md": 9,

    # Developer Guide
    "DEVELOPMENT.md": 1,
    "TESTING_GUIDE.md": 2,
    "ARCHITECTURE.md": 3,
    "DESIGN_SYSTEM.md": 4,
}


def extract_title(content: str) -> str:
    """마크다운에서 첫 번째 # 헤딩 추출"""
    match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    return match.group(1) if match else "Untitled"


def extract_metadata(content: str) -> dict:
    """마크다운에서 메타데이터 추출 (기존 front matter 또는 제목)"""
    # 이미 front matter가 있는지 확인
    if content.startswith('---'):
        # 기존 front matter 파싱 (간단한 구현)
        fm_match = re.match(r'^---\n(.+?)\n---\n', content, re.DOTALL)
        if fm_match:
            # 기존 front matter가 있으면 스킵
            return {}

    title = extract_title(content)
    return {"title": title}


def generate_frontmatter(
    file_path: Path,
    content: str,
    dest_dir: str
) -> str:
    """Front Matter 생성"""
    # 이미 Front Matter가 있으면 그대로 반환
    if content.startswith('---'):
        return content

    # 메타데이터 추출
    title = extract_title(content)
    id = file_path.stem.lower().replace('_', '-').replace(' ', '-')

    # Sidebar position 결정
    position = SIDEBAR_POSITIONS.get(file_path.name, 99)

    # Tags 생성
    tags = []
    if 'user-guide' in dest_dir:
        tags = ['guide', 'user']
    elif 'admin-guide' in dest_dir:
        tags = ['guide', 'admin']
    elif 'developer-guide' in dest_dir:
        tags = ['guide', 'developer']
    elif 'api' in dest_dir:
        tags = ['api', 'reference']

    # Front Matter 생성
    frontmatter_lines = [
        "---",
        f"id: {id}",
        f"title: {title}",
        f"sidebar_position: {position}",
    ]

    if tags:
        tags_str = ", ".join(tags)
        frontmatter_lines.append(f"tags: [{tags_str}]")

    frontmatter_lines.append("---")
    frontmatter_lines.append("")  # 빈 줄

    return "\n".join(frontmatter_lines) + "\n" + content


def fix_internal_links(content: str) -> str:
    """내부 링크를 Docusaurus 형식으로 변환"""
    # .md 확장자 제거
    content = re.sub(r'\(([^)]+)\.md\)', r'(\1)', content)

    # 상대 경로 조정
    content = re.sub(r'\(\.\./guides/user/', r'(../user-guide/', content)
    content = re.sub(r'\(\.\./guides/admin/', r'(../admin-guide/', content)
    content = re.sub(r'\(\.\./guides/developer/', r'(../developer-guide/', content)
    content = re.sub(r'\(\.\./project/', r'(../developer-guide/', content)

    # 절대 경로를 상대 경로로 변환
    content = re.sub(r'\(/docs/guides/user/', r'(/docs/user-guide/', content)
    content = re.sub(r'\(/docs/guides/admin/', r'(/docs/admin-guide/', content)
    content = re.sub(r'\(/docs/guides/developer/', r'(/docs/developer-guide/', content)

    return content


def create_category_json(category_dir: Path, label: str, position: int, description: str = ""):
    """_category_.json 생성"""
    category_file = category_dir / "_category_.json"
    category_data = {
        "label": label,
        "position": position,
        "link": {
            "type": "generated-index",
            "description": description or f"{label}입니다."
        }
    }

    category_file.write_text(json.dumps(category_data, indent=2, ensure_ascii=False), encoding='utf-8')


def migrate_file(source_path: Path, dest_path: Path, dest_dir: str):
    """파일 하나를 마이그레이션"""
    print(f"Processing {source_path.name} -> {dest_path}")

    content = source_path.read_text(encoding='utf-8')

    # Front Matter 추가
    content_with_fm = generate_frontmatter(source_path, content, dest_dir)

    # 내부 링크 수정
    content_fixed = fix_internal_links(content_with_fm)

    # 파일 쓰기
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    dest_path.write_text(content_fixed, encoding='utf-8')


def migrate():
    """마이그레이션 실행"""
    source_root = Path("../../docs")
    dest_root = Path("..")

    if not source_root.exists():
        print(f"Error: Source directory {source_root} does not exist")
        return

    # 목적지 디렉토리 생성
    for dest_dir in DIR_MAPPING.values():
        (dest_root / dest_dir).mkdir(parents=True, exist_ok=True)

    # 파일 복사 및 변환
    for source_pattern, dest_dir in DIR_MAPPING.items():
        source_dir = source_root / source_pattern

        if not source_dir.exists():
            print(f"Warning: {source_dir} does not exist, skipping...")
            continue

        for md_file in source_dir.glob("*.md"):
            # README.md는 스킵
            if md_file.name == "README.md":
                continue

            dest_path = dest_root / dest_dir / md_file.name
            migrate_file(md_file, dest_path, dest_dir)

    # _category_.json 생성
    create_category_json(
        dest_root / "docs/user-guide",
        "사용자 가이드",
        2,
        "일반 사용자를 위한 VMS Chat Ops 사용 가이드"
    )
    create_category_json(
        dest_root / "docs/admin-guide",
        "관리자 가이드",
        3,
        "시스템 관리자를 위한 배포 및 운영 가이드"
    )
    create_category_json(
        dest_root / "docs/developer-guide",
        "개발자 가이드",
        4,
        "개발 환경 설정 및 기여 가이드"
    )
    create_category_json(
        dest_root / "docs/api",
        "API 레퍼런스",
        5,
        "REST API 및 WebSocket API 문서"
    )

    # intro.md 생성 (메인 README.md 기반)
    readme_path = source_root / "README.md"
    if readme_path.exists():
        intro_path = dest_root / "docs/intro.md"
        content = readme_path.read_text(encoding='utf-8')

        # Front Matter 추가
        frontmatter = """---
id: intro
title: VMS Chat Ops 문서
sidebar_position: 1
slug: /
---

"""
        intro_path.write_text(frontmatter + content, encoding='utf-8')
        print(f"Created intro.md from README.md")

    print("\n[OK] Migration completed!")
    print(f"\nNext steps:")
    print(f"1. cd vms-chat-ops-docs")
    print(f"2. npm install  or  docker-compose up")
    print(f"3. npm start")


if __name__ == "__main__":
    migrate()
