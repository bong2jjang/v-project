"""
부하 테스트 스크립트

동시 사용자 50명 시뮬레이션 및 성능 측정
"""

import asyncio
import aiohttp
import time
import sys
from datetime import datetime
from typing import List, Dict
import statistics


class LoadTest:
    def __init__(self, base_url: str = "http://127.0.0.1:8000"):
        self.base_url = base_url
        self.results: List[Dict] = []

    async def simulate_user(self, user_id: int, session: aiohttp.ClientSession) -> Dict:
        """단일 사용자 시뮬레이션"""
        user_results = {
            "user_id": user_id,
            "requests": [],
            "errors": [],
            "total_requests": 0,
            "failed_requests": 0,
            "avg_response_time": 0
        }

        # 각 사용자가 수행할 API 호출 목록
        endpoints = [
            ("GET", "/api/health"),
            ("GET", "/api/messages"),
            ("GET", "/api/messages/stats/summary"),
            ("GET", "/api/messages/filters/options"),
            ("GET", "/api/gateways"),
            ("GET", "/api/channels"),
        ]

        for endpoint_method, endpoint_path in endpoints:
            start_time = time.time()
            try:
                async with session.request(
                    endpoint_method,
                    f"{self.base_url}{endpoint_path}",
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    response_time = time.time() - start_time
                    status = response.status

                    user_results["requests"].append({
                        "endpoint": endpoint_path,
                        "method": endpoint_method,
                        "status": status,
                        "response_time": response_time,
                        "success": 200 <= status < 300
                    })

                    user_results["total_requests"] += 1
                    if status >= 400:
                        user_results["failed_requests"] += 1

            except Exception as e:
                response_time = time.time() - start_time
                user_results["errors"].append({
                    "endpoint": endpoint_path,
                    "error": str(e),
                    "response_time": response_time
                })
                user_results["total_requests"] += 1
                user_results["failed_requests"] += 1

            # 요청 간 짧은 대기 (0.1초)
            await asyncio.sleep(0.1)

        # 평균 응답 시간 계산
        response_times = [r["response_time"] for r in user_results["requests"]]
        if response_times:
            user_results["avg_response_time"] = statistics.mean(response_times)

        return user_results

    async def run_load_test(self, num_users: int = 50):
        """부하 테스트 실행"""
        print(f"\n{'='*60}")
        print(f"부하 테스트 시작")
        print(f"Base URL: {self.base_url}")
        print(f"동시 사용자 수: {num_users}")
        print(f"{'='*60}\n")

        start_time = time.time()

        # 비동기 HTTP 세션 생성
        async with aiohttp.ClientSession() as session:
            # 동시에 모든 사용자 시뮬레이션
            tasks = [
                self.simulate_user(i, session)
                for i in range(num_users)
            ]

            self.results = await asyncio.gather(*tasks)

        total_time = time.time() - start_time

        # 결과 분석
        self.analyze_results(total_time)

    def analyze_results(self, total_time: float):
        """테스트 결과 분석 및 출력"""
        if not self.results:
            print("테스트 결과가 없습니다.")
            return

        # 전체 통계 계산
        total_users = len(self.results)
        total_requests = sum(r["total_requests"] for r in self.results)
        total_failed = sum(r["failed_requests"] for r in self.results)
        success_rate = ((total_requests - total_failed) / total_requests * 100) if total_requests > 0 else 0

        # 응답 시간 통계
        all_response_times = []
        for user_result in self.results:
            for request in user_result["requests"]:
                all_response_times.append(request["response_time"])

        if all_response_times:
            avg_response_time = statistics.mean(all_response_times)
            min_response_time = min(all_response_times)
            max_response_time = max(all_response_times)
            median_response_time = statistics.median(all_response_times)
            p95_response_time = sorted(all_response_times)[int(len(all_response_times) * 0.95)]
            p99_response_time = sorted(all_response_times)[int(len(all_response_times) * 0.99)]
        else:
            avg_response_time = min_response_time = max_response_time = median_response_time = 0
            p95_response_time = p99_response_time = 0

        # 처리량 계산 (requests per second)
        throughput = total_requests / total_time if total_time > 0 else 0

        print(f"\n{'='*60}")
        print(f"테스트 결과 요약")
        print(f"{'='*60}")
        print(f"총 실행 시간: {total_time:.2f}초")
        print(f"동시 사용자 수: {total_users}")
        print(f"총 요청 수: {total_requests}")
        print(f"성공한 요청: {total_requests - total_failed}")
        print(f"실패한 요청: {total_failed}")
        print(f"성공률: {success_rate:.2f}%")
        print(f"처리량: {throughput:.2f} requests/sec")
        print(f"\n응답 시간 통계:")
        print(f"  평균: {avg_response_time*1000:.2f}ms")
        print(f"  최소: {min_response_time*1000:.2f}ms")
        print(f"  최대: {max_response_time*1000:.2f}ms")
        print(f"  중앙값: {median_response_time*1000:.2f}ms")
        print(f"  95 백분위수: {p95_response_time*1000:.2f}ms")
        print(f"  99 백분위수: {p99_response_time*1000:.2f}ms")
        print(f"{'='*60}\n")

        # 엔드포인트별 통계
        endpoint_stats = {}
        for user_result in self.results:
            for request in user_result["requests"]:
                endpoint = request["endpoint"]
                if endpoint not in endpoint_stats:
                    endpoint_stats[endpoint] = {
                        "count": 0,
                        "failed": 0,
                        "response_times": []
                    }

                endpoint_stats[endpoint]["count"] += 1
                endpoint_stats[endpoint]["response_times"].append(request["response_time"])
                if not request["success"]:
                    endpoint_stats[endpoint]["failed"] += 1

        print("엔드포인트별 통계:")
        print(f"{'엔드포인트':<40} {'요청 수':<10} {'실패 수':<10} {'평균 응답시간':<15}")
        print("-" * 75)

        for endpoint, stats in sorted(endpoint_stats.items()):
            avg_time = statistics.mean(stats["response_times"]) if stats["response_times"] else 0
            print(
                f"{endpoint:<40} "
                f"{stats['count']:<10} "
                f"{stats['failed']:<10} "
                f"{avg_time*1000:<15.2f}ms"
            )

        # 성능 기준 검증
        print(f"\n{'='*60}")
        passed = True

        if success_rate < 95.0:
            print(f"❌ 성공률 테스트 실패 (목표: 95% 이상, 실제: {success_rate:.2f}%)")
            passed = False
        else:
            print(f"✅ 성공률 테스트 통과 ({success_rate:.2f}%)")

        if avg_response_time > 2.0:
            print(f"❌ 평균 응답 시간 테스트 실패 (목표: 2초 이하, 실제: {avg_response_time:.2f}초)")
            passed = False
        else:
            print(f"✅ 평균 응답 시간 테스트 통과 ({avg_response_time*1000:.2f}ms)")

        if p95_response_time > 5.0:
            print(f"❌ 95백분위 응답 시간 테스트 실패 (목표: 5초 이하, 실제: {p95_response_time:.2f}초)")
            passed = False
        else:
            print(f"✅ 95백분위 응답 시간 테스트 통과 ({p95_response_time*1000:.2f}ms)")

        print(f"{'='*60}\n")

        return passed


async def main():
    """메인 실행 함수"""
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
    num_users = int(sys.argv[2]) if len(sys.argv) > 2 else 50

    test = LoadTest(base_url)
    await test.run_load_test(num_users)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n테스트가 사용자에 의해 중단되었습니다.")
    except Exception as e:
        print(f"\n오류 발생: {e}")
        sys.exit(1)
