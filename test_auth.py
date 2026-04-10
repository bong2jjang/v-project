#!/usr/bin/env python3
"""
인증 API 테스트 스크립트
"""

import requests
import json


def test_login():
    """로그인 테스트"""
    url = "http://localhost:8000/api/auth/login"
    payload = {
        "email": "admin@example.com",
        "password": "Admin123!"
    }

    print("=" * 60)
    print("Testing Login API")
    print("=" * 60)
    print(f"URL: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print()

    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response:")
        print(json.dumps(response.json(), indent=2))
        print()

        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            user = data.get("user")

            print("[OK] Login successful!")
            print(f"  Token: {token[:50]}...")
            print(f"  User ID: {user.get('id')}")
            print(f"  Email: {user.get('email')}")
            print(f"  Role: {user.get('role')}")
            print()

            return token
        else:
            print("[FAIL] Login failed!")
            return None
    except Exception as e:
        print(f"[ERROR] {e}")
        return None


def test_register():
    """회원가입 테스트"""
    url = "http://localhost:8000/api/auth/register"
    payload = {
        "email": "test@example.com",
        "username": "testuser",
        "password": "Test123456!"
    }

    print("=" * 60)
    print("Testing Register API")
    print("=" * 60)
    print(f"URL: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    print()

    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response:")
        print(json.dumps(response.json(), indent=2))
        print()

        if response.status_code == 201:
            data = response.json()
            print("[OK] Registration successful!")
            print(f"  User ID: {data.get('id')}")
            print(f"  Email: {data.get('email')}")
            print(f"  Role: {data.get('role')}")
            print()
            return True
        else:
            print("[FAIL] Registration failed!")
            return False
    except Exception as e:
        print(f"[ERROR] {e}")
        return False


def test_get_me(token):
    """현재 사용자 정보 조회 테스트"""
    url = "http://localhost:8000/api/auth/me"
    headers = {"Authorization": f"Bearer {token}"}

    print("=" * 60)
    print("Testing Get Current User API")
    print("=" * 60)
    print(f"URL: {url}")
    print(f"Token: {token[:50]}...")
    print()

    try:
        response = requests.get(url, headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Response:")
        print(json.dumps(response.json(), indent=2))
        print()

        if response.status_code == 200:
            data = response.json()
            print("[OK] Get current user successful!")
            print(f"  User ID: {data.get('id')}")
            print(f"  Email: {data.get('email')}")
            print(f"  Role: {data.get('role')}")
            print()
            return True
        else:
            print("[FAIL] Get current user failed!")
            return False
    except Exception as e:
        print(f"[ERROR] {e}")
        return False


if __name__ == "__main__":
    print()
    print("=" * 60)
    print("VMS Chat Ops - Auth API Test")
    print("=" * 60)
    print()

    # Test 1: Login
    token = test_login()

    if token:
        # Test 2: Get current user
        test_get_me(token)

        # Test 3: Register new user
        test_register()

        print()
        print("=" * 60)
        print("All tests completed!")
        print("=" * 60)
    else:
        print()
        print("=" * 60)
        print("Tests failed - could not obtain login token")
        print("=" * 60)
