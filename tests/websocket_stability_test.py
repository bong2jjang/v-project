"""
WebSocket 연결 안정성 테스트

99% 이상의 연결 안정성을 검증하는 테스트 스크립트
"""

import asyncio
import websockets
import time
import sys
from datetime import datetime
from typing import List, Dict
import json


class WebSocketStabilityTest:
    def __init__(self, ws_url: str = "ws://localhost:8000/ws/status"):
        self.ws_url = ws_url
        self.test_duration = 300  # 5 minutes
        self.results: List[Dict] = []

    async def test_single_connection(self, connection_id: int) -> Dict:
        """단일 WebSocket 연결 테스트"""
        start_time = time.time()
        connection_time = 0
        disconnect_count = 0
        message_count = 0

        try:
            async with websockets.connect(self.ws_url) as websocket:
                print(f"[Connection {connection_id}] 연결 성공")

                # 연결 유지 및 메시지 수신
                while (time.time() - start_time) < self.test_duration:
                    try:
                        # 1초 타임아웃으로 메시지 수신 대기
                        message = await asyncio.wait_for(
                            websocket.recv(),
                            timeout=1.0
                        )
                        message_count += 1
                        connection_time = time.time() - start_time

                        # Ping 메시지 전송 (연결 유지)
                        await websocket.send(json.dumps({"type": "ping"}))

                    except asyncio.TimeoutError:
                        # 타임아웃은 정상 (메시지가 없을 때)
                        connection_time = time.time() - start_time
                        continue

                    except websockets.exceptions.ConnectionClosed:
                        disconnect_count += 1
                        print(f"[Connection {connection_id}] 연결 끊김, 재연결 시도...")
                        break

        except Exception as e:
            print(f"[Connection {connection_id}] 오류 발생: {e}")
            disconnect_count += 1

        total_time = time.time() - start_time
        uptime_percentage = (connection_time / total_time) * 100 if total_time > 0 else 0

        return {
            "connection_id": connection_id,
            "total_time": total_time,
            "connection_time": connection_time,
            "disconnect_count": disconnect_count,
            "message_count": message_count,
            "uptime_percentage": uptime_percentage
        }

    async def run_stability_test(self, num_connections: int = 10):
        """여러 연결에 대한 안정성 테스트 실행"""
        print(f"\n{'='*60}")
        print(f"WebSocket 안정성 테스트 시작")
        print(f"URL: {self.ws_url}")
        print(f"연결 수: {num_connections}")
        print(f"테스트 시간: {self.test_duration}초")
        print(f"{'='*60}\n")

        # 병렬로 여러 연결 테스트
        tasks = [
            self.test_single_connection(i)
            for i in range(num_connections)
        ]

        self.results = await asyncio.gather(*tasks)

        # 결과 분석
        self.analyze_results()

    def analyze_results(self):
        """테스트 결과 분석 및 출력"""
        if not self.results:
            print("테스트 결과가 없습니다.")
            return

        total_connections = len(self.results)
        total_disconnect_count = sum(r["disconnect_count"] for r in self.results)
        total_message_count = sum(r["message_count"] for r in self.results)
        avg_uptime = sum(r["uptime_percentage"] for r in self.results) / total_connections

        # 99% 이상 연결 유지한 연결 수
        stable_connections = sum(1 for r in self.results if r["uptime_percentage"] >= 99.0)
        stability_rate = (stable_connections / total_connections) * 100

        print(f"\n{'='*60}")
        print(f"테스트 결과 요약")
        print(f"{'='*60}")
        print(f"총 연결 수: {total_connections}")
        print(f"총 연결 끊김 횟수: {total_disconnect_count}")
        print(f"총 수신 메시지 수: {total_message_count}")
        print(f"평균 업타임: {avg_uptime:.2f}%")
        print(f"99% 이상 안정적인 연결: {stable_connections}/{total_connections} ({stability_rate:.2f}%)")
        print(f"{'='*60}\n")

        # 개별 연결 결과
        print("개별 연결 상세 결과:")
        print(f"{'ID':<5} {'연결 시간':<12} {'끊김 횟수':<12} {'메시지 수':<12} {'업타임 %':<12}")
        print("-" * 60)

        for result in self.results:
            print(
                f"{result['connection_id']:<5} "
                f"{result['connection_time']:<12.2f} "
                f"{result['disconnect_count']:<12} "
                f"{result['message_count']:<12} "
                f"{result['uptime_percentage']:<12.2f}"
            )

        # 검증 결과
        print(f"\n{'='*60}")
        if avg_uptime >= 99.0:
            print("✅ WebSocket 안정성 테스트 통과 (99% 이상)")
        else:
            print(f"❌ WebSocket 안정성 테스트 실패 (목표: 99%, 실제: {avg_uptime:.2f}%)")
        print(f"{'='*60}\n")

        return avg_uptime >= 99.0


async def main():
    """메인 실행 함수"""
    ws_url = sys.argv[1] if len(sys.argv) > 1 else "ws://localhost:8000/ws/status"
    num_connections = int(sys.argv[2]) if len(sys.argv) > 2 else 10

    test = WebSocketStabilityTest(ws_url)
    await test.run_stability_test(num_connections)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n테스트가 사용자에 의해 중단되었습니다.")
    except Exception as e:
        print(f"\n오류 발생: {e}")
        sys.exit(1)
