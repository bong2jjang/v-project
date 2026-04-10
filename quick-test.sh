#!/bin/bash

# VMS Chat Ops Quick Test Script
# Phase 2 주요 기능 빠른 테스트

echo "=================================="
echo "VMS Chat Ops Quick Test"
echo "=================================="
echo ""

BASE_URL="http://localhost:8000"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

function test_api() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4

    test_count=$((test_count + 1))
    echo -n "[$test_count] Testing: $name... "

    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    elif [ "$method" == "POST" ]; then
        if [ -z "$data" ]; then
            response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint")
        else
            response=$(curl -s -w "\n%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$BASE_URL$endpoint")
        fi
    fi

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" == "200" ] || [ "$http_code" == "201" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $http_code)"
        pass_count=$((pass_count + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC} (HTTP $http_code)"
        echo "  Response: $body"
        fail_count=$((fail_count + 1))
        return 1
    fi
}

echo "Phase 1: Basic API Tests"
echo "------------------------"
test_api "Health Check" "GET" "/api/health"
test_api "Get Status" "GET" "/api/matterbridge/status"
test_api "Get Logs" "GET" "/api/matterbridge/logs?lines=10"
test_api "Get Config" "GET" "/api/config"
test_api "Get Backups" "GET" "/api/config/backups"
echo ""

echo "Phase 2 Week 1: WebSocket Tests"
echo "--------------------------------"
test_api "WebSocket Info" "GET" "/api/ws/info"
echo ""

echo "Phase 2 Week 2: Messages Tests"
echo "-------------------------------"
test_api "Generate Test Data" "POST" "/api/messages/test-data?count=50"
test_api "Get All Messages" "GET" "/api/messages"
test_api "Search Messages" "GET" "/api/messages?q=Hello&page=1&per_page=10"
test_api "Filter by Gateway" "GET" "/api/messages?gateway=gateway-1"
test_api "Filter by Channel" "GET" "/api/messages?channel=general"
test_api "Get Message Stats" "GET" "/api/messages/stats/summary"
test_api "Get Message #1" "GET" "/api/messages/1"
echo ""

echo "=================================="
echo "Test Summary"
echo "=================================="
echo "Total Tests: $test_count"
echo -e "Passed: ${GREEN}$pass_count${NC}"
echo -e "Failed: ${RED}$fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✅${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Open http://localhost:8000/docs for API documentation"
    echo "2. Test WebSocket: cd backend && python test_websocket.py"
    echo "3. Start Frontend: cd frontend && npm run dev"
    echo "4. Full test guide: See TEST-GUIDE.md"
else
    echo -e "${RED}Some tests failed. Please check the errors above.${NC}"
fi

echo ""
