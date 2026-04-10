#!/usr/bin/env python3
"""
VMS Chat Ops Quick Test Script
Phase 2 주요 기능 빠른 테스트
"""

import requests
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"

# Colors
GREEN = "\033[0;32m"
RED = "\033[0;31m"
YELLOW = "\033[1;33m"
BLUE = "\033[0;34m"
NC = "\033[0m"  # No Color

test_count = 0
pass_count = 0
fail_count = 0


def print_header(text):
    print(f"\n{BLUE}{'=' * 50}{NC}")
    print(f"{BLUE}{text}{NC}")
    print(f"{BLUE}{'=' * 50}{NC}")


def print_section(text):
    print(f"\n{YELLOW}{text}{NC}")
    print("-" * len(text))


def test_api(name, method, endpoint, data=None, expected_status=200):
    global test_count, pass_count, fail_count
    test_count += 1

    print(f"[{test_count}] Testing: {name}... ", end="", flush=True)

    try:
        url = f"{BASE_URL}{endpoint}"
        if method == "GET":
            response = requests.get(url, timeout=10)
        elif method == "POST":
            if data:
                response = requests.post(url, json=data, timeout=10)
            else:
                response = requests.post(url, timeout=10)
        else:
            print(f"{RED}INVALID METHOD{NC}")
            fail_count += 1
            return False

        if response.status_code == expected_status:
            print(f"{GREEN}PASS{NC} (HTTP {response.status_code})")
            pass_count += 1
            return True
        else:
            print(f"{RED}FAIL{NC} (HTTP {response.status_code})")
            print(f"  Response: {response.text[:200]}")
            fail_count += 1
            return False

    except requests.exceptions.ConnectionError:
        print(f"{RED}FAIL{NC} (Connection Error)")
        print(f"  Could not connect to {BASE_URL}")
        fail_count += 1
        return False
    except Exception as e:
        print(f"{RED}FAIL{NC} ({str(e)})")
        fail_count += 1
        return False


def main():
    print_header("VMS Chat Ops Quick Test")
    print(f"Base URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Check if server is running
    print("\nChecking server status...", end="", flush=True)
    try:
        response = requests.get(f"{BASE_URL}/api/health", timeout=5)
        if response.status_code == 200:
            print(f" {GREEN}Server is running!{NC}")
        else:
            print(f" {RED}Server responded but may not be healthy{NC}")
    except Exception:
        print(f" {RED}Server is not running!{NC}")
        print("\nPlease start the backend server:")
        print("  cd backend")
        print("  python -m uvicorn app.main:app --reload")
        return

    # Phase 1 Tests
    print_section("Phase 1: Basic API Tests")
    test_api("Health Check", "GET", "/api/health")
    test_api("Get Status", "GET", "/api/matterbridge/status")
    test_api("Get Logs (10 lines)", "GET", "/api/matterbridge/logs?lines=10")
    test_api("Get Config", "GET", "/api/config")
    test_api("Get Backups", "GET", "/api/config/backups")

    # Phase 2 Week 1 Tests
    print_section("Phase 2 Week 1: WebSocket Tests")
    test_api("WebSocket Info", "GET", "/api/ws/info")

    # Phase 2 Week 2 Tests
    print_section("Phase 2 Week 2: Messages Tests")

    # Generate test data
    print("\n  Generating test data (50 messages)...")
    test_api("Generate Test Data", "POST", "/api/messages/test-data?count=50")

    time.sleep(1)  # Wait for data to be inserted

    test_api("Get All Messages", "GET", "/api/messages")
    test_api("Search 'Hello'", "GET", "/api/messages?q=Hello&page=1&per_page=10")
    test_api("Filter by Gateway", "GET", "/api/messages?gateway=gateway-1")
    test_api("Filter by Channel", "GET", "/api/messages?channel=general")
    test_api("Filter by User", "GET", "/api/messages?user=alice")
    test_api("Get Message Stats", "GET", "/api/messages/stats/summary")

    # Try to get a specific message
    print("\n  Checking if messages exist...")
    try:
        response = requests.get(f"{BASE_URL}/api/messages?per_page=1")
        if response.status_code == 200 and response.json().get("messages"):
            msg_id = response.json()["messages"][0]["id"]
            test_api(f"Get Message #{msg_id}", "GET", f"/api/messages/{msg_id}")
        else:
            print(f"  {YELLOW}No messages found for detail test{NC}")
    except Exception:
        pass

    # Summary
    print_header("Test Summary")
    print(f"Total Tests: {test_count}")
    print(f"Passed: {GREEN}{pass_count}{NC}")
    print(f"Failed: {RED}{fail_count}{NC}")
    print(f"Success Rate: {(pass_count/test_count*100):.1f}%")

    if fail_count == 0:
        print(f"\n{GREEN}✅ All tests passed!{NC}")
        print("\nNext steps:")
        print("1. Open http://localhost:8000/docs for API documentation")
        print("2. Test WebSocket:")
        print("   cd backend && python test_websocket.py")
        print("3. Start Frontend (if npm install works):")
        print("   cd frontend && npm run dev")
        print("4. Access Frontend: http://localhost:5173")
        print("5. Full test guide: See TEST-GUIDE.md")
    else:
        print(f"\n{RED}❌ Some tests failed. Please check the errors above.{NC}")

    print()


if __name__ == "__main__":
    main()
