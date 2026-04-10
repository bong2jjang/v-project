"""
RouteManager 양방향 라우팅 테스트

2026-04-04 작업에서 추가된 is_bidirectional 기능을 검증합니다.
- add_route() 양방향 시 역방향 자동 생성
- add_route() 단방향 시 역방향 미생성
- get_all_routes()에서 is_bidirectional 플래그 포함 여부
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.route_manager import RouteManager


@pytest.fixture
def mock_redis():
    """fakeredis 대신 Mock을 사용한 Redis 클라이언트"""
    redis = MagicMock()
    redis.sadd = AsyncMock(return_value=1)
    redis.hset = AsyncMock(return_value=1)
    redis.set = AsyncMock(return_value=True)
    redis.get = AsyncMock(return_value=None)
    redis.smembers = AsyncMock(return_value=set())
    redis.hgetall = AsyncMock(return_value={})
    redis.srem = AsyncMock(return_value=1)
    redis.delete = AsyncMock(return_value=1)
    redis.hdel = AsyncMock(return_value=1)
    redis.scan = AsyncMock(return_value=(0, []))
    # add_route()의 중복 확인 호출: 0(falsy) → 중복 없음으로 처리
    redis.sismember = AsyncMock(return_value=0)
    return redis


@pytest.fixture
def route_manager(mock_redis):
    return RouteManager(redis_client=mock_redis)


class TestAddRouteBidirectional:
    """add_route() 양방향 라우팅 테스트"""

    @pytest.mark.asyncio
    async def test_bidirectional_creates_forward_route(self, route_manager, mock_redis):
        """양방향 추가 시 정방향 라우트가 Redis에 저장되어야 한다"""
        result = await route_manager.add_route(
            source_platform="slack",
            source_channel="C123",
            target_platform="teams",
            target_channel="T456",
            is_bidirectional=True,
        )

        assert result is True
        mock_redis.sadd.assert_any_call("route:slack:C123", "teams:T456")

    @pytest.mark.asyncio
    async def test_bidirectional_creates_reverse_route(self, route_manager, mock_redis):
        """양방향 추가 시 역방향 라우트가 자동 생성되어야 한다"""
        await route_manager.add_route(
            source_platform="slack",
            source_channel="C123",
            target_platform="teams",
            target_channel="T456",
            is_bidirectional=True,
        )

        mock_redis.sadd.assert_any_call("route:teams:T456", "slack:C123")

    @pytest.mark.asyncio
    async def test_bidirectional_flag_stored_for_forward(
        self, route_manager, mock_redis
    ):
        """양방향 플래그가 정방향에 '1'로 저장되어야 한다"""
        await route_manager.add_route(
            source_platform="slack",
            source_channel="C123",
            target_platform="teams",
            target_channel="T456",
            is_bidirectional=True,
        )

        mock_redis.hset.assert_any_call(
            "route:slack:C123:bidirectional", "teams:T456", "1"
        )

    @pytest.mark.asyncio
    async def test_bidirectional_flag_stored_for_reverse(
        self, route_manager, mock_redis
    ):
        """역방향에도 bidirectional 플래그가 '1'로 저장되어야 한다"""
        await route_manager.add_route(
            source_platform="slack",
            source_channel="C123",
            target_platform="teams",
            target_channel="T456",
            is_bidirectional=True,
        )

        mock_redis.hset.assert_any_call(
            "route:teams:T456:bidirectional", "slack:C123", "1"
        )

    @pytest.mark.asyncio
    async def test_bidirectional_channel_names_stored_in_reverse(
        self, route_manager, mock_redis
    ):
        """역방향 라우트에 소스/타겟 채널 이름이 올바르게 교차 저장되어야 한다"""
        await route_manager.add_route(
            source_platform="slack",
            source_channel="C123",
            target_platform="teams",
            target_channel="T456",
            source_channel_name="general",
            target_channel_name="General",
            is_bidirectional=True,
        )

        # 역방향 names: 소스 채널 이름(general)이 타겟 이름으로 저장
        mock_redis.hset.assert_any_call(
            "route:teams:T456:names", "slack:C123", "general"
        )
        # 역방향 source_name: 타겟 채널 이름(General)이 소스 이름으로 저장
        mock_redis.set.assert_any_call("route:teams:T456:source_name", "General")

    @pytest.mark.asyncio
    async def test_bidirectional_message_mode_stored_in_reverse(
        self, route_manager, mock_redis
    ):
        """역방향 라우트에도 동일한 message_mode가 저장되어야 한다"""
        await route_manager.add_route(
            source_platform="slack",
            source_channel="C123",
            target_platform="teams",
            target_channel="T456",
            message_mode="sender_info",
            is_bidirectional=True,
        )

        mock_redis.hset.assert_any_call(
            "route:teams:T456:modes", "slack:C123", "sender_info"
        )


class TestAddRouteUnidirectional:
    """add_route() 단방향 라우팅 테스트"""

    @pytest.mark.asyncio
    async def test_unidirectional_no_reverse_route(self, route_manager, mock_redis):
        """단방향 추가 시 역방향 라우트가 생성되면 안 된다"""
        await route_manager.add_route(
            source_platform="slack",
            source_channel="C123",
            target_platform="teams",
            target_channel="T456",
            is_bidirectional=False,
        )

        # 역방향 sadd가 호출되지 않아야 함
        sadd_calls = [str(c) for c in mock_redis.sadd.call_args_list]
        reverse_calls = [
            c for c in sadd_calls if "route:teams:T456" in c and "slack:C123" in c
        ]
        assert len(reverse_calls) == 0

    @pytest.mark.asyncio
    async def test_unidirectional_flag_stored_as_zero(self, route_manager, mock_redis):
        """단방향 플래그는 '0'으로 저장되어야 한다"""
        await route_manager.add_route(
            source_platform="slack",
            source_channel="C123",
            target_platform="teams",
            target_channel="T456",
            is_bidirectional=False,
        )

        mock_redis.hset.assert_any_call(
            "route:slack:C123:bidirectional", "teams:T456", "0"
        )

    @pytest.mark.asyncio
    async def test_default_is_bidirectional(self, route_manager, mock_redis):
        """is_bidirectional 기본값은 True여야 한다 (역방향 자동 생성)"""
        await route_manager.add_route(
            source_platform="slack",
            source_channel="C123",
            target_platform="teams",
            target_channel="T456",
        )

        # 역방향 sadd가 호출되어야 함
        mock_redis.sadd.assert_any_call("route:teams:T456", "slack:C123")


class TestRemoveRoute:
    """remove_route() 테스트 — 역방향 cascade 삭제 및 메타데이터 정리"""

    @pytest.fixture
    def mock_redis_for_remove(self):
        redis = MagicMock()
        redis.srem = AsyncMock(return_value=1)
        redis.hdel = AsyncMock(return_value=1)
        redis.smembers = AsyncMock(return_value=set())  # 마지막 타겟 제거된 상태
        redis.delete = AsyncMock(return_value=1)
        redis.hget = AsyncMock(return_value="1")  # is_bidirectional=True
        return redis

    @pytest.mark.asyncio
    async def test_bidirectional_remove_also_removes_reverse(
        self, mock_redis_for_remove
    ):
        """양방향 라우트 삭제 시 역방향도 함께 삭제되어야 한다"""
        rm = RouteManager(redis_client=mock_redis_for_remove)

        result = await rm.remove_route(
            source_platform="slack",
            source_channel="C123",
            target_platform="teams",
            target_channel="T456",
        )

        assert result is True
        # 정방향 srem
        mock_redis_for_remove.srem.assert_any_call("route:slack:C123", "teams:T456")
        # 역방향 srem
        mock_redis_for_remove.srem.assert_any_call("route:teams:T456", "slack:C123")

    @pytest.mark.asyncio
    async def test_unidirectional_remove_does_not_touch_reverse(
        self, mock_redis_for_remove
    ):
        """단방향 라우트 삭제 시 역방향은 건드리지 않아야 한다"""
        mock_redis_for_remove.hget = AsyncMock(
            return_value="0"
        )  # is_bidirectional=False
        rm = RouteManager(redis_client=mock_redis_for_remove)

        await rm.remove_route(
            source_platform="slack",
            source_channel="C123",
            target_platform="teams",
            target_channel="T456",
        )

        srem_calls = [str(c) for c in mock_redis_for_remove.srem.call_args_list]
        reverse_calls = [c for c in srem_calls if "route:teams:T456" in c]
        assert len(reverse_calls) == 0

    @pytest.mark.asyncio
    async def test_remove_cleans_all_metadata(self, mock_redis_for_remove):
        """삭제 시 :names, :modes, :bidirectional 메타데이터가 모두 정리되어야 한다"""
        mock_redis_for_remove.hget = AsyncMock(
            return_value="0"
        )  # 단방향으로 단순 테스트
        rm = RouteManager(redis_client=mock_redis_for_remove)

        await rm.remove_route(
            source_platform="slack",
            source_channel="C123",
            target_platform="teams",
            target_channel="T456",
        )

        hdel_calls = [str(c) for c in mock_redis_for_remove.hdel.call_args_list]
        assert any(":names" in c for c in hdel_calls)
        assert any(":modes" in c for c in hdel_calls)
        assert any(":bidirectional" in c for c in hdel_calls)

    @pytest.mark.asyncio
    async def test_remove_deletes_source_name_when_last_target(
        self, mock_redis_for_remove
    ):
        """마지막 타겟 삭제 시 source_name 키도 삭제되어야 한다"""
        mock_redis_for_remove.hget = AsyncMock(return_value="0")
        mock_redis_for_remove.smembers = AsyncMock(
            return_value=set()
        )  # 빈 set = 마지막 타겟
        rm = RouteManager(redis_client=mock_redis_for_remove)

        await rm.remove_route(
            source_platform="slack",
            source_channel="C123",
            target_platform="teams",
            target_channel="T456",
        )

        delete_calls = [str(c) for c in mock_redis_for_remove.delete.call_args_list]
        assert any(":source_name" in c for c in delete_calls)


def _make_hgetall_side_effect(data: dict):
    """key별로 다른 값을 반환하는 hgetall async side_effect 생성"""

    async def _side_effect(key):
        return data.get(key, {})

    return _side_effect


class TestGetAllRoutesBidirectionalFlag:
    """get_all_routes()에서 is_bidirectional 플래그 반환 테스트"""

    @pytest.mark.asyncio
    async def test_get_all_routes_includes_bidirectional_true(
        self, route_manager, mock_redis
    ):
        """bidirectional 플래그가 '1'인 경우 is_bidirectional=True로 반환"""
        mock_redis.scan = AsyncMock(return_value=(0, ["route:slack:C123"]))
        mock_redis.get = AsyncMock(return_value="general")
        mock_redis.smembers = AsyncMock(return_value={"teams:T456"})
        mock_redis.hgetall = AsyncMock(
            side_effect=_make_hgetall_side_effect(
                {
                    "route:slack:C123:names": {"teams:T456": "General"},
                    "route:slack:C123:modes": {"teams:T456": "sender_info"},
                    "route:slack:C123:bidirectional": {"teams:T456": "1"},
                }
            )
        )

        routes = await route_manager.get_all_routes()

        assert len(routes) == 1
        target = routes[0]["targets"][0]
        assert target["is_bidirectional"] is True

    @pytest.mark.asyncio
    async def test_get_all_routes_includes_bidirectional_false(
        self, route_manager, mock_redis
    ):
        """bidirectional 플래그가 '0'인 경우 is_bidirectional=False로 반환"""
        mock_redis.scan = AsyncMock(return_value=(0, ["route:slack:C123"]))
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.smembers = AsyncMock(return_value={"teams:T456"})
        mock_redis.hgetall = AsyncMock(
            side_effect=_make_hgetall_side_effect(
                {
                    "route:slack:C123:names": {"teams:T456": "General"},
                    "route:slack:C123:modes": {"teams:T456": "sender_info"},
                    "route:slack:C123:bidirectional": {"teams:T456": "0"},
                }
            )
        )

        routes = await route_manager.get_all_routes()

        assert len(routes) == 1
        target = routes[0]["targets"][0]
        assert target["is_bidirectional"] is False

    @pytest.mark.asyncio
    async def test_get_all_routes_default_bidirectional_true(
        self, route_manager, mock_redis
    ):
        """bidirectional 플래그 없는 기존 라우트는 기본값 True로 처리"""
        mock_redis.scan = AsyncMock(return_value=(0, ["route:slack:C123"]))
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.smembers = AsyncMock(return_value={"teams:T456"})
        mock_redis.hgetall = AsyncMock(
            side_effect=_make_hgetall_side_effect(
                {
                    "route:slack:C123:names": {"teams:T456": "General"},
                    # bidirectional 키 없음 → 기본값 True
                }
            )
        )

        routes = await route_manager.get_all_routes()

        assert len(routes) == 1
        target = routes[0]["targets"][0]
        assert target["is_bidirectional"] is True  # 기본값

    @pytest.mark.asyncio
    async def test_get_all_routes_skips_metadata_keys(self, route_manager, mock_redis):
        """메타데이터 키(:names, :source_name, :modes, :bidirectional)는 라우트에서 제외"""
        mock_redis.scan = AsyncMock(
            return_value=(
                0,
                [
                    "route:slack:C123",
                    "route:slack:C123:names",
                    "route:slack:C123:source_name",
                    "route:slack:C123:modes",
                    "route:slack:C123:bidirectional",
                ],
            )
        )
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.smembers = AsyncMock(return_value={"teams:T456"})
        mock_redis.hgetall = AsyncMock(
            side_effect=_make_hgetall_side_effect(
                {
                    "route:slack:C123:names": {"teams:T456": "General"},
                }
            )
        )

        routes = await route_manager.get_all_routes()

        # route:slack:C123 하나만 처리되어야 함
        assert len(routes) == 1

    @pytest.mark.asyncio
    async def test_get_all_routes_deduplicates_bidirectional_pair(
        self, route_manager, mock_redis
    ):
        """양방향 라우트 A↔B가 Redis에 A→B, B→A 두 키로 저장되어도 1개만 반환해야 한다"""
        # A→B, B→A 두 키가 존재하는 상황 시뮬레이션
        mock_redis.scan = AsyncMock(
            return_value=(0, ["route:slack:C123", "route:teams:T456"])
        )

        async def smembers_side_effect(key):
            if key == "route:slack:C123":
                return {"teams:T456"}
            if key == "route:teams:T456":
                return {"slack:C123"}
            return set()

        mock_redis.smembers = AsyncMock(side_effect=smembers_side_effect)
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.hgetall = AsyncMock(
            side_effect=_make_hgetall_side_effect(
                {
                    "route:slack:C123:names": {"teams:T456": "General"},
                    "route:slack:C123:bidirectional": {"teams:T456": "1"},
                    "route:teams:T456:names": {"slack:C123": "general"},
                    "route:teams:T456:bidirectional": {"slack:C123": "1"},
                }
            )
        )

        routes = await route_manager.get_all_routes()

        # 양방향 쌍은 1개만 반환 (역방향은 숨김)
        assert len(routes) == 1

    @pytest.mark.asyncio
    async def test_get_all_routes_splits_multi_target_into_individual_routes(
        self, route_manager, mock_redis
    ):
        """하나의 source에 target이 2개면 개별 Route 2개로 분리되어야 한다"""
        mock_redis.scan = AsyncMock(return_value=(0, ["route:slack:C123"]))

        async def smembers_side_effect(key):
            if key == "route:slack:C123":
                return {"teams:T456", "slack:C789"}
            return set()

        mock_redis.smembers = AsyncMock(side_effect=smembers_side_effect)
        mock_redis.get = AsyncMock(return_value="general")
        mock_redis.hgetall = AsyncMock(
            side_effect=_make_hgetall_side_effect(
                {
                    "route:slack:C123:names": {
                        "teams:T456": "General",
                        "slack:C789": "random",
                    },
                    "route:slack:C123:bidirectional": {
                        "teams:T456": "0",
                        "slack:C789": "0",
                    },
                }
            )
        )

        routes = await route_manager.get_all_routes()

        # source가 같아도 각 target별로 개별 Route
        assert len(routes) == 2
        assert len(routes[0]["targets"]) == 1
        assert len(routes[1]["targets"]) == 1

    @pytest.mark.asyncio
    async def test_get_all_routes_unidirectional_pair_not_deduplicated(
        self, route_manager, mock_redis
    ):
        """단방향 라우트 A→B, B→A는 별개이므로 2개 모두 반환해야 한다"""
        mock_redis.scan = AsyncMock(
            return_value=(0, ["route:slack:C123", "route:teams:T456"])
        )

        async def smembers_side_effect(key):
            if key == "route:slack:C123":
                return {"teams:T456"}
            if key == "route:teams:T456":
                return {"slack:C123"}
            return set()

        mock_redis.smembers = AsyncMock(side_effect=smembers_side_effect)
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.hgetall = AsyncMock(
            side_effect=_make_hgetall_side_effect(
                {
                    "route:slack:C123:names": {"teams:T456": "General"},
                    "route:slack:C123:bidirectional": {"teams:T456": "0"},  # 단방향
                    "route:teams:T456:names": {"slack:C123": "general"},
                    "route:teams:T456:bidirectional": {"slack:C123": "0"},  # 단방향
                }
            )
        )

        routes = await route_manager.get_all_routes()

        # 단방향 2개는 별개로 반환
        assert len(routes) == 2
