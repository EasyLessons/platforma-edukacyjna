
"""
Presence service - kto jest aktualnie na tablicy, przechowywane w Redisie.

Schemat: jeden sorted set per tablica (board: {board_id}:presence),
member = user_id, score = unix timestamp wygaśnięcia. 
Odczyt filtruje member-y ze score > teraz - wygasłe wpisy są po prostu ignorowane.

Bez aktywnego pingu na wyjście "mark_offline" - czysty TTL wystarcza, dashboard i nie potrzebuje widoku live.
"""
import time
from typing import Dict, List

import redis.asyncio as redis
from redis.exceptions import ConnectionError, TimeoutError
from sqlalchemy.orm import Session

from core.redis_client import get_redis_client
from core.logging import get_logger
from core.models import User

from api.v1.whiteboard.schemas import OnlineUserInfo

logger = get_logger(__name__)

PRESENCE_TTL_SECONDS = 100
KEY_TTL_SECONDS = 60 * 60 # 1h


class PresenceService:
    def __init__(self, db: Session, redis_client: redis.Redis | None = None):
        self.db = db
        self.redis = redis_client or get_redis_client()

    def _key(self, board_id: int) -> str:
        return f"board:{board_id}:presence"

    async def mark_online(self, board_id: int, user_id: int) -> None:
        """Odświeża (albo tworzy) wpis presence - nadpisuje TTL."""
        expires_at = time.time() + PRESENCE_TTL_SECONDS
        key = self._key(board_id)
        try:
            await self.redis.zadd(key, {str(user_id): expires_at})
            await self.redis.expire(key, KEY_TTL_SECONDS)
        except (ConnectionError, TimeoutError):
            logger.warning(f"Redis niedostępny - pominięto zapis presence dla board={board_id}")

    async def get_online_users(self, board_ids: List[int]) -> Dict[int, List[OnlineUserInfo]]:
        """Zwraca online userów dla listy tablic jednym pipeline'em Redisa."""
        unique_ids = sorted(set(board_ids))
        result: Dict[int, List[OnlineUserInfo]] = {board_id: [] for board_id in unique_ids}
        if not unique_ids:
            return result

        now = time.time()
        try:
            pipe = self.redis.pipeline()
            for board_id in unique_ids:
                pipe.zrangebyscore(self._key(board_id), now, "+inf")
            per_board_raw_ids = await pipe.execute()
        except (ConnectionError, TimeoutError):
            logger.warning("Redis niedostępny - brak danych presence")
            return result

        board_to_user_ids: Dict[int, List[int]] = {}
        all_user_ids: set[int] = set()
        for board_id, raw_ids in zip(unique_ids, per_board_raw_ids):
            uids = [int(uid) for uid in raw_ids]
            board_to_user_ids[board_id] = uids
            all_user_ids.update(uids)

        if not all_user_ids:
            return result

        users_by_id = {
            u.id: u for u in self.db.query(User).filter(User.id.in_(all_user_ids)).all()
        }
        for board_id, uids in board_to_user_ids.items():
            result[board_id] = [OnlineUserInfo(
                user_id=uid,
                username=users_by_id[uid].username,
                avatar_url=users_by_id[uid].avatar_url
                ) for uid in uids if uid in users_by_id]
        return result