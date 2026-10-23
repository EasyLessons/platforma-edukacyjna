"""
JEDYNE miejsce z limitami planów. Zmieniasz liczby tutaj (albo env) - nigdzie indziej.

`None` = bez limitu. Decyzja A (Patryk, 01.10.2026):
  Free:    2 własne przestrzenie, 3 tablice w JEDNEJ przestrzeni, 1000 elementów na tablicy.
  Premium: bez limitów w ofercie (limity techniczne chronią infrastrukturę - patrz PR 3).
  Miejsce na pliki tablic (decyzja Patryka, 12.10.2026): Free 100 MB, Premium 5 GB na konto.

Limity zależą od planu WŁAŚCICIELA przestrzeni, nie od tego, kto akurat tworzy zasób.
"""
import os
from dataclasses import asdict, dataclass

from .models import PLAN_FREE, PLAN_PREMIUM

MB = 1024 * 1024
GB = 1024 * MB

# Ostrzeżenie w UI, gdy tablica zapełnia się (ułamek limitu elementów).
ELEMENTS_WARN_RATIO = 0.8


def _env_int(name: str, default: int) -> int:
    """Liczba z env (wartość niepoprawna lub <= 0 -> domyślna)."""
    try:
        value = int(os.getenv(name, ""))
    except ValueError:
        return default
    return value if value > 0 else default


@dataclass(frozen=True)
class PlanLimits:
    max_own_workspaces: int | None
    max_boards_per_workspace: int | None
    max_elements_per_board: int | None
    max_storage_bytes: int | None = None  # miejsce na pliki tablic na konto właściciela przestrzeni
    ai_chat_daily: int | None = None  # na przyszłość; None = bez limitu

    def as_dict(self) -> dict:
        return asdict(self)


def _build_plan_limits() -> dict[str, PlanLimits]:
    return {
        PLAN_FREE: PlanLimits(
            max_own_workspaces=_env_int("PLAN_FREE_MAX_WORKSPACES", 2),
            max_boards_per_workspace=_env_int("PLAN_FREE_MAX_BOARDS_PER_WORKSPACE", 3),
            max_elements_per_board=_env_int("PLAN_FREE_MAX_ELEMENTS", 1000),
            max_storage_bytes=_env_int("PLAN_FREE_MAX_STORAGE_MB", 100) * MB,
            ai_chat_daily=None,
        ),
        PLAN_PREMIUM: PlanLimits(
            max_own_workspaces=None,
            max_boards_per_workspace=None,
            max_elements_per_board=None,
            max_storage_bytes=_env_int("PLAN_PREMIUM_MAX_STORAGE_MB", 5 * 1024) * MB,
            ai_chat_daily=None,
        ),
    }


PLAN_LIMITS: dict[str, PlanLimits] = _build_plan_limits()

DEFAULT_PLAN = PLAN_FREE


def get_limits(plan: str) -> PlanLimits:
    """Limity dla planu; nieznany plan traktujemy jak free (bezpieczny default)."""
    return PLAN_LIMITS.get(plan, PLAN_LIMITS[DEFAULT_PLAN])
