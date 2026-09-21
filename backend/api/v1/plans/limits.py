"""
JEDYNE miejsce z limitami planów. Zmieniasz liczby tutaj — nigdzie indziej.

`None` = bez limitu.
"""
from dataclasses import asdict, dataclass

from .models import PLAN_FREE, PLAN_PREMIUM


@dataclass(frozen=True)
class PlanLimits:
    max_own_workspaces: int | None
    max_boards: int | None
    max_elements_per_board: int | None
    ai_chat_daily: int | None = None  # na przyszłość; None = bez limitu

    def as_dict(self) -> dict:
        return asdict(self)


PLAN_LIMITS: dict[str, PlanLimits] = {
    PLAN_FREE: PlanLimits(
        max_own_workspaces=1,
        max_boards=3,
        max_elements_per_board=300,
        ai_chat_daily=None,
    ),
    PLAN_PREMIUM: PlanLimits(
        max_own_workspaces=None,
        max_boards=None,
        max_elements_per_board=None,
        ai_chat_daily=None,
    ),
}

DEFAULT_PLAN = PLAN_FREE


def get_limits(plan: str) -> PlanLimits:
    """Limity dla planu; nieznany plan traktujemy jak free (bezpieczny default)."""
    return PLAN_LIMITS.get(plan, PLAN_LIMITS[DEFAULT_PLAN])
