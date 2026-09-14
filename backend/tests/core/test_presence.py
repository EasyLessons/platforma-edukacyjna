"""
Testy PresenceService (core/presence.py) - obecność na tablicy w Redisie.
"""
import time

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

from core.presence import PresenceService


class TestMarkOnline:

    @pytest.mark.asyncio
    async def test_marks_user_online(self, db_session, redis_client, test_user, test_board):
        service = PresenceService(db_session, redis_client)
        await service.mark_online(test_board.id, test_user.id)

        result = await service.get_online_users([test_board.id])
        assert any(u.user_id == test_user.id for u in result[test_board.id])

    @pytest.mark.asyncio
    async def test_sets_key_ttl(self, db_session, redis_client, test_user, test_board):
        service = PresenceService(db_session, redis_client)
        await service.mark_online(test_board.id, test_user.id)

        ttl = await redis_client.ttl(service._key(test_board.id))
        assert 0 < ttl <= 60 * 60

    @pytest.mark.asyncio
    async def test_redis_unavailable_does_not_raise(self, db_session, redis_client, test_user, test_board, monkeypatch):
        async def broken_zadd(*args, **kwargs):
            raise RedisConnectionError("down")
        monkeypatch.setattr(redis_client, "zadd", broken_zadd)

        service = PresenceService(db_session, redis_client)
        await service.mark_online(test_board.id, test_user.id) 


class TestGetOnlineUsers:

    @pytest.mark.asyncio
    async def test_expired_entry_is_not_returned(self, db_session, redis_client, test_user, test_board):
        service = PresenceService(db_session, redis_client)
        # Ręcznie wstawiamy wpis z przeszłym score - symulacja wygaśnięcia TTL
        await redis_client.zadd(service._key(test_board.id), {str(test_user.id): time.time() - 10})

        result = await service.get_online_users([test_board.id])
        assert result[test_board.id] == []

    @pytest.mark.asyncio
    async def test_groups_multiple_boards_in_one_call(
        self, db_session, redis_client, test_user, test_user2, multiple_boards
    ):
        service = PresenceService(db_session, redis_client)
        board_a, board_b = multiple_boards[0], multiple_boards[1]

        await service.mark_online(board_a.id, test_user.id)
        await service.mark_online(board_b.id, test_user2.id)

        result = await service.get_online_users([board_a.id, board_b.id])
        assert [u.user_id for u in result[board_a.id]] == [test_user.id]
        assert [u.user_id for u in result[board_b.id]] == [test_user2.id]

    @pytest.mark.asyncio
    async def test_board_with_nobody_online_returns_empty_list(self, db_session, redis_client, test_board):
        service = PresenceService(db_session, redis_client)
        result = await service.get_online_users([test_board.id])
        assert result[test_board.id] == []

    @pytest.mark.asyncio
    async def test_empty_board_ids_returns_empty_dict(self, db_session, redis_client):
        service = PresenceService(db_session, redis_client)
        result = await service.get_online_users([])
        assert result == {}

    @pytest.mark.asyncio
    async def test_redis_unavailable_returns_empty_lists(self, db_session, redis_client, test_board, monkeypatch):
        def broken_pipeline(*args, **kwargs):
            raise RedisConnectionError("down")
        monkeypatch.setattr(redis_client, "pipeline", broken_pipeline)

        service = PresenceService(db_session, redis_client)
        result = await service.get_online_users([test_board.id])
        assert result == {test_board.id: []}