"""
Konfiguracja pytest - fixtures wspólne dla wszystkich testów
"""
import pytest
import asyncio
import json
import secrets
from datetime import datetime, timedelta
from sqlalchemy import TypeDecorator, Text, event
from sqlalchemy.dialects import postgresql


# Monkey-patch JSONB → SQLite-compatible TEXT
class JSONBCompatible(TypeDecorator):
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "sqlite":
            return dialect.type_descriptor(Text())
        return dialect.type_descriptor(postgresql.JSONB())

    def process_bind_param(self, value, dialect):
        if dialect.name == "sqlite" and value is not None:
            return json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if dialect.name == "sqlite" and value is not None:
            return json.loads(value)
        return value


postgresql.JSONB = JSONBCompatible

# === po monkey-patch importujemy modele ===

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from core.models import Base, User, Workspace, WorkspaceMember, Board, BoardUsers
from api.v1.auth.utils import hash_password

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Świeża baza danych dla każdego testu"""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ── Users ──────────────────────────────────────────────────────────────────

@pytest.fixture
def test_user(db_session: Session):
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=hash_password("testpassword"),
        full_name="Test User",
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_user2(db_session: Session):
    user = User(
        username="testuser2",
        email="test2@example.com",
        hashed_password=hash_password("testpassword2"),
        full_name="Test User 2",
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_user3(db_session: Session):
    user = User(
        username="testuser3",
        email="test3@example.com",
        hashed_password=hash_password("testpassword3"),
        full_name="Test User 3",
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def unverified_user(db_session: Session):
    """Niezweryfikowany użytkownik z aktywnym kodem"""
    user = User(
        username="unverified",
        email="unverified@example.com",
        hashed_password=hash_password("testpassword"),
        is_active=False,
        verification_code="123456",
        verification_code_expires=datetime.utcnow() + timedelta(minutes=15),
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


# ── Workspaces ─────────────────────────────────────────────────────────────

@pytest.fixture
def test_workspace(db_session: Session, test_user):
    workspace = Workspace(
        name="Test Workspace",
        icon="Home",
        bg_color="bg-green-500",
        created_by=test_user.id,
        created_at=datetime.utcnow(),
    )
    db_session.add(workspace)
    db_session.flush()

    membership = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=test_user.id,
        role="owner",
        is_favourite=False,
        joined_at=datetime.utcnow(),
    )
    db_session.add(membership)
    db_session.commit()
    db_session.refresh(workspace)
    return workspace


@pytest.fixture
def test_workspace2(db_session: Session, test_user2):
    workspace = Workspace(
        name="Test Workspace 2",
        icon="Star",
        bg_color="bg-blue-500",
        created_by=test_user2.id,
        created_at=datetime.utcnow(),
    )
    db_session.add(workspace)
    db_session.flush()

    membership = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=test_user2.id,
        role="owner",
        is_favourite=False,
        joined_at=datetime.utcnow(),
    )
    db_session.add(membership)
    db_session.commit()
    db_session.refresh(workspace)
    return workspace


@pytest.fixture
def shared_workspace(db_session: Session, test_user, test_user2):
    workspace = Workspace(
        name="Shared Workspace",
        icon="Users",
        bg_color="bg-purple-500",
        created_by=test_user.id,
        created_at=datetime.utcnow(),
    )
    db_session.add(workspace)
    db_session.flush()

    db_session.add(WorkspaceMember(
        workspace_id=workspace.id, user_id=test_user.id,
        role="owner", is_favourite=False, joined_at=datetime.utcnow(),
    ))
    db_session.add(WorkspaceMember(
        workspace_id=workspace.id, user_id=test_user2.id,
        role="editor", is_favourite=False, joined_at=datetime.utcnow(),
    ))
    db_session.commit()
    db_session.refresh(workspace)
    return workspace


@pytest.fixture
def multiple_workspaces(db_session: Session, test_user):
    workspaces = []
    for i in range(10):
        ws = Workspace(
            name=f"Test Workspace {i+1}",
            icon=f"Icon{i+1}",
            bg_color="bg-gray-500",
            created_by=test_user.id,
            created_at=datetime.utcnow(),
        )
        db_session.add(ws)
        db_session.flush()
        db_session.add(WorkspaceMember(
            workspace_id=ws.id, user_id=test_user.id,
            role="owner", is_favourite=(i % 3 == 0),
            joined_at=datetime.utcnow(),
        ))
        workspaces.append(ws)
    db_session.commit()
    return workspaces


# ── Boards ─────────────────────────────────────────────────────────────────

@pytest.fixture
def test_board(db_session: Session, test_user, test_workspace):
    board = Board(
        name="Test Board",
        icon="TestIcon",
        bg_color="bg-blue-500",
        workspace_id=test_workspace.id,
        created_by=test_user.id,
        created_at=datetime.utcnow(),
        last_modified=datetime.utcnow(),
        last_modified_by=test_user.id,
    )
    db_session.add(board)
    db_session.flush()

    db_session.add(BoardUsers(
        board_id=board.id, user_id=test_user.id,
        is_favourite=False, is_online=True,
        last_opened=datetime.utcnow(),
    ))
    db_session.commit()
    db_session.refresh(board)
    return board


@pytest.fixture
def multiple_boards(db_session: Session, test_user, test_workspace):
    boards = []
    for i in range(15):
        board = Board(
            name=f"Test Board {i+1}",
            icon=f"Icon{i+1}",
            bg_color="bg-gray-500",
            workspace_id=test_workspace.id,
            created_by=test_user.id,
            created_at=datetime.utcnow(),
            last_modified=datetime.utcnow(),
            last_modified_by=test_user.id,
        )
        db_session.add(board)
        db_session.flush()
        db_session.add(BoardUsers(
            board_id=board.id, user_id=test_user.id,
            is_favourite=(i % 3 == 0), is_online=(i % 2 == 0),
            last_opened=datetime.utcnow(),
        ))
        boards.append(board)
    db_session.commit()
    return boards


# ── Invites ────────────────────────────────────────────────────────────────

@pytest.fixture
def test_invite(db_session: Session, test_workspace, test_user, test_user2):
    from core.models import WorkspaceInvite
    invite = WorkspaceInvite(
        workspace_id=test_workspace.id,
        invited_by=test_user.id,
        invited_id=test_user2.id,
        invite_token=secrets.token_urlsafe(32),
        expires_at=datetime.utcnow() + timedelta(days=7),
        is_used=False,
        created_at=datetime.utcnow(),
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


@pytest.fixture
def expired_invite(db_session: Session, test_workspace, test_user, test_user2):
    from core.models import WorkspaceInvite
    invite = WorkspaceInvite(
        workspace_id=test_workspace.id,
        invited_by=test_user.id,
        invited_id=test_user2.id,
        invite_token=secrets.token_urlsafe(32),
        expires_at=datetime.utcnow() - timedelta(days=1),
        is_used=False,
        created_at=datetime.utcnow() - timedelta(days=8),
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite