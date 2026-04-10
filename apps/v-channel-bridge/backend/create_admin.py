#!/usr/bin/env python3
"""
초기 관리자 계정 생성 스크립트

Usage:
    python create_admin.py [email] [username] [password]

    If no arguments provided, defaults will be used:
    - email: admin@example.com
    - username: admin
    - password: Admin123!
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import get_db, init_db  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.utils.auth import get_password_hash  # noqa: E402


def create_admin_user(
    email: str = "admin@example.com",
    username: str = "admin",
    password: str = "Admin123!",
):
    """
    관리자 계정 생성

    Args:
        email: 관리자 이메일
        username: 관리자 사용자명
        password: 관리자 비밀번호
    """
    # Initialize database (create tables if not exist)
    init_db()
    print("✓ Database initialized")

    with get_db() as db:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.email == email).first()
        if existing_admin:
            print(f"✗ Admin user already exists: {email}")
            print(f"  ID: {existing_admin.id}")
            print(f"  Username: {existing_admin.username}")
            print(f"  Role: {existing_admin.role.value}")
            print(f"  Active: {existing_admin.is_active}")
            return existing_admin

        # Create admin user
        admin_user = User(
            email=email,
            username=username,
            hashed_password=get_password_hash(password),
            role=UserRole.ADMIN,
            is_active=True,
        )

        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        print("✓ Admin user created successfully!")
        print(f"  ID: {admin_user.id}")
        print(f"  Email: {admin_user.email}")
        print(f"  Username: {admin_user.username}")
        print(f"  Role: {admin_user.role.value}")
        print(f"  Password: {password}")
        print()
        print("⚠️  Please change the default password after first login!")

        return admin_user


if __name__ == "__main__":
    # Parse command line arguments
    email = sys.argv[1] if len(sys.argv) > 1 else "admin@example.com"
    username = sys.argv[2] if len(sys.argv) > 2 else "admin"
    password = sys.argv[3] if len(sys.argv) > 3 else "Admin123!"

    print("=" * 60)
    print("VMS Chat Ops - Admin Account Creation")
    print("=" * 60)
    print()

    create_admin_user(email, username, password)

    print()
    print("=" * 60)
