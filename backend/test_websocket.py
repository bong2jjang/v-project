"""
Simple WebSocket Test Client

테스트 실행:
  python test_websocket.py
"""

import asyncio
import websockets
import json


async def test_websocket():
    """WebSocket 연결 테스트"""
    uri = "ws://localhost:8000/api/ws"

    try:
        print(f"Connecting to {uri}...")
        async with websockets.connect(uri) as websocket:
            print("✅ Connected!")

            # 연결 메시지 수신
            response = await websocket.recv()
            message = json.loads(response)
            print(f"📨 Received: {message['type']} - {message['data']}")

            # 채널 구독
            subscribe_msg = {
                "type": "subscribe",
                "data": {"channels": ["status", "logs"]},
            }
            await websocket.send(json.dumps(subscribe_msg))
            print(f"📤 Sent: {subscribe_msg}")

            # 5초간 메시지 수신
            print("\n🔄 Listening for messages (5 seconds)...")
            try:
                async with asyncio.timeout(5):
                    while True:
                        response = await websocket.recv()
                        message = json.loads(response)
                        print(
                            f"📨 {message['type']}: {message.get('timestamp', 'N/A')}"
                        )
            except asyncio.TimeoutError:
                print("\n⏱️  Timeout reached")

            # Ping 테스트
            ping_msg = {"type": "ping"}
            await websocket.send(json.dumps(ping_msg))
            print("\n📤 Sent ping")

            response = await websocket.recv()
            message = json.loads(response)
            print(f"📨 Received: {message['type']}")

            print("\n✅ WebSocket test completed successfully!")

    except websockets.exceptions.WebSocketException as e:
        print(f"❌ WebSocket error: {e}")
    except ConnectionRefusedError:
        print(
            "❌ Connection refused. Make sure the backend server is running on port 8000"
        )
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    print("=== WebSocket Test Client ===\n")
    asyncio.run(test_websocket())
