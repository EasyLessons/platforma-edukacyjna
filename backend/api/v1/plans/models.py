"""
Model planu użytkownika.

DLACZEGO OSOBNA TABELA, A NIE KOLUMNA W `users`?
    `core/models.py` jest w strefie równoległej pracy nad Yjs (Bartek) — nie dotykamy
    go, żeby nie tworzyć konfliktów w modelach ani w migracjach Alembic. Osobna
    tabela `user_plans` (user_id = PK/FK) daje to samo co kolumna, a dodatkowo:
      - brak wiersza == plan "free" (zero backfillu przy migracji),
      - łatwo później dopiąć Stripe (dodatkowe kolumny: status, current_period_end)
        bez ruszania `users`.

REJESTRACJA W METADATA:
    Model dziedziczy po `core.database.Base`, więc wystarczy zaimportować ten moduł
    tam, gdzie Alembic/testy zbierają metadata (`alembic/env.py`, `tests/conftest.py`).
"""
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, String

from core.database import Base

PLAN_FREE = "free"
PLAN_PREMIUM = "premium"
PLAN_VALUES = (PLAN_FREE, PLAN_PREMIUM)


class UserPlan(Base):
    __tablename__ = "user_plans"
    __table_args__ = (
        CheckConstraint("plan IN ('free', 'premium')", name="ck_user_plans_plan"),
    )

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    plan = Column(String(20), nullable=False, default=PLAN_FREE, server_default=PLAN_FREE)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
