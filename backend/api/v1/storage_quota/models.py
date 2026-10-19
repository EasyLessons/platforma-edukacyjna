"""
Rejestr plikow tablic w Storage (`board_files`) - zrodlo prawdy o zajetym miejscu.

Jeden wiersz = jeden obiekt `board-files/{board_id}/{file_name}`. Wiersz powstaje po udanym
zapisie w Storage (api/v1/whiteboard/files.py), wiec suma `size_bytes` to miejsce zajete przez
konto - to z niej liczy sie limit planu (plans/limits.py: max_storage_bytes).

DLACZEGO BEZ KLUCZY OBCYCH:
    Rejestr musi przezyc usuniecie tablicy, przestrzeni i konta: pliki kasujemy ze Storage
    dopiero po okresie karencji (storage_quota/cleanup.py), a do tego trzeba wiedziec, ktore
    obiekty do kogo naleza. `board_id` i `owner_id` to zwykle liczby (id nie sa uzywane ponownie).

`owner_id` = wlasciciel przestrzeni (`workspaces.created_by`) w chwili uploadu - jak limity
z `plans`: miejsce liczy sie wlascicielowi, nie temu, kto wgral plik.
`deleted_at` != NULL = plik czeka na fizyczne skasowanie; nie liczy sie do limitu.
"""
from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint

from core.database import Base
from core.time import utcnow


class BoardFile(Base):
    __tablename__ = "board_files"
    __table_args__ = (
        UniqueConstraint("board_id", "file_name", name="uq_board_files_board_file"),
    )

    id = Column(Integer, primary_key=True)
    board_id = Column(Integer, nullable=False, index=True)
    owner_id = Column(Integer, nullable=False, index=True)
    file_name = Column(String(64), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True, index=True)
