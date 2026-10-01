"""
SEED E2E - przygotowanie bazy pod testy Playwright (e2e/)
=========================================================

Uruchamiany przez `webServer` w playwright.config.ts tuz przed startem backendu:

    python scripts/seed_e2e.py   (z katalogu backend/, z env jak w playwright.config.ts)

Co robi:
    1. Tworzy schemat przez `Base.metadata.create_all` (NIE alembic - lancuch
       migracji nie startuje od zera; testy pytest robia to samo na SQLite).
    2. Tworzy trzech ZWERYFIKOWANYCH uzytkownikow testowych: wlasciciel (ze startowym
       workspace'em i tablica, jak OnboardingService przy rejestracji) oraz edytor
       i viewer jako czlonkowie tego samego workspace'u - do testow wspolpracy i roli viewer.
    3. Zapisuje id workspace'u i tablicy do pliku stanu (E2E_STATE_FILE), ktory
       czytaja testy.
    4. Jest idempotentny - drugi start tylko odswieza plik stanu.

Dane logowania sa celowo jawne i testowe (patrz e2e/helpers.ts).
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import Base, SessionLocal, engine  # noqa: E402
from core.models import Board, User, WorkspaceMember  # noqa: E402
from api.v1.auth.utils import hash_password  # noqa: E402
from api.v1.onboarding.service import OnboardingService  # noqa: E402

PASSWORD = os.getenv("E2E_PASSWORD", "E2ePassword123!")
OWNER = "e2e_owner"
MEMBERS = {"e2e_editor": "editor", "e2e_viewer": "viewer"}
STATE_FILE = os.getenv(
    "E2E_STATE_FILE",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "e2e", ".state", "seed.json"),
)


def get_or_create_user(db, username: str) -> tuple[User, bool]:
    user = db.query(User).filter(User.username == username).first()
    if user is not None:
        return user, False
    user = User(
        username=username,
        email=f"{username}@example.com",
        hashed_password=hash_password(PASSWORD),
        full_name=username.replace("_", " ").title(),
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user, True


def main() -> None:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        owner, created = get_or_create_user(db, OWNER)
        if created:
            workspace = OnboardingService(db).setup_new_user(owner.id)
            db.flush()
            workspace_id = workspace.id
        else:
            workspace_id = (
                db.query(WorkspaceMember.workspace_id)
                .filter(WorkspaceMember.user_id == owner.id, WorkspaceMember.role == "owner")
                .order_by(WorkspaceMember.workspace_id)
                .first()[0]
            )

        for username, role in MEMBERS.items():
            member, _ = get_or_create_user(db, username)
            exists = (
                db.query(WorkspaceMember)
                .filter(WorkspaceMember.workspace_id == workspace_id, WorkspaceMember.user_id == member.id)
                .first()
            )
            if exists is None:
                db.add(WorkspaceMember(workspace_id=workspace_id, user_id=member.id, role=role))

        board = db.query(Board).filter(Board.workspace_id == workspace_id).order_by(Board.id).first()
        db.commit()

        state = {"workspace_id": workspace_id, "board_id": board.id}
        os.makedirs(os.path.dirname(os.path.abspath(STATE_FILE)), exist_ok=True)
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f)
        print(f"[seed_e2e] {'utworzono' if created else 'istnieje'}: {state}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
