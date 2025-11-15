"""
Konfiguracja pytest dla testów modułów dashboard (workspaces i boards)
POPRAWIONA wersja z działającym JSONB fix
"""
import pytest
import asyncio
from datetime import datetime
import json
from sqlalchemy import TypeDecorator, Text, event
from sqlalchemy.dialects import postgresql

# Zamień JSONB na wersję kompatybilną z SQLite
class JSONBCompatible(TypeDecorator):
    """JSONB które działa w SQLite jako TEXT z JSON"""
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'sqlite':
            return dialect.type_descriptor(Text())
        else:
            return dialect.type_descriptor(postgresql.JSONB())

    def process_bind_param(self, value, dialect):
        if dialect.name == 'sqlite':
            if value is not None:
                return json.dumps(value)
        return value

    def process_result_value(self, value, dialect):
        if dialect.name == 'sqlite':
            if value is not None:
                return json.loads(value)
        return value


# Podmień oryginalny JSONB
postgresql.JSONB = JSONBCompatible

# ═══════════════════════════════════════════════════════════════════════════
# TERAZ MOŻEMY IMPORTOWAĆ MODELS (po monkey patch)
# ═══════════════════════════════════════════════════════════════════════════

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from core.models import Base, User, Workspace, WorkspaceMember, Board, BoardUsers
from auth.utils import hash_password

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Tworzy nową sesję bazy danych dla każdego testu"""
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


# ═══════════════════════════════════════════════════════════════════════════
# FIXTURES DLA UŻYTKOWNIKÓW
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture
def test_user(db_session: Session):
    """Tworzy testowego użytkownika (główny użytkownik testowy)"""
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=hash_password("testpassword"),
        full_name="Test User",
        is_active=True,
        created_at=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_user2(db_session: Session):
    """Tworzy drugiego testowego użytkownika"""
    user = User(
        username="testuser2",
        email="test2@example.com",
        hashed_password=hash_password("testpassword2"),
        full_name="Test User 2",
        is_active=True,
        created_at=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_user3(db_session: Session):
    """Tworzy trzeciego testowego użytkownika"""
    user = User(
        username="testuser3",
        email="test3@example.com",
        hashed_password=hash_password("testpassword3"),
        full_name="Test User 3",
        is_active=True,
        created_at=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


# ═══════════════════════════════════════════════════════════════════════════
# FIXTURES DLA WORKSPACE'ÓW
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture
def test_workspace(db_session: Session, test_user):
    """Tworzy testową przestrzeń roboczą z członkostwem"""
    workspace = Workspace(
        name="Test Workspace",
        icon="Home",
        bg_color="bg-green-500",
        created_by=test_user.id,
        created_at=datetime.utcnow()
    )
    db_session.add(workspace)
    db_session.flush()
    
    # Dodaj członkostwo dla twórcy
    membership = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=test_user.id,
        role="owner",
        is_favourite=False,
        joined_at=datetime.utcnow()
    )
    db_session.add(membership)
    db_session.commit()
    db_session.refresh(workspace)
    return workspace


@pytest.fixture
def test_workspace2(db_session: Session, test_user2):
    """Tworzy drugą testową przestrzeń roboczą"""
    workspace = Workspace(
        name="Test Workspace 2",
        icon="Star",
        bg_color="bg-blue-500",
        created_by=test_user2.id,
        created_at=datetime.utcnow()
    )
    db_session.add(workspace)
    db_session.flush()
    
    membership = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=test_user2.id,
        role="owner",
        is_favourite=False,
        joined_at=datetime.utcnow()
    )
    db_session.add(membership)
    db_session.commit()
    db_session.refresh(workspace)
    return workspace


@pytest.fixture
def multiple_workspaces(db_session: Session, test_user):
    """Tworzy wiele workspace'ów dla testów listowania i paginacji"""
    workspaces = []
    for i in range(10):
        workspace = Workspace(
            name=f"Test Workspace {i+1}",
            icon=f"Icon{i+1}",
            bg_color=f"bg-color-{i+1}",
            created_by=test_user.id,
            created_at=datetime.utcnow()
        )
        db_session.add(workspace)
        db_session.flush()
        
        membership = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user.id,
            role="owner",
            is_favourite=(i % 3 == 0),  # Co trzeci jako ulubiony
            joined_at=datetime.utcnow()
        )
        db_session.add(membership)
        workspaces.append(workspace)
    
    db_session.commit()
    return workspaces


@pytest.fixture
def shared_workspace(db_session: Session, test_user, test_user2):
    """Tworzy workspace współdzielony przez dwóch użytkowników"""
    workspace = Workspace(
        name="Shared Workspace",
        icon="Users",
        bg_color="bg-purple-500",
        created_by=test_user.id,
        created_at=datetime.utcnow()
    )
    db_session.add(workspace)
    db_session.flush()
    
    # Owner membership
    membership1 = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=test_user.id,
        role="owner",
        is_favourite=False,
        joined_at=datetime.utcnow()
    )
    db_session.add(membership1)
    
    # Member membership
    membership2 = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=test_user2.id,
        role="member",
        is_favourite=False,
        joined_at=datetime.utcnow()
    )
    db_session.add(membership2)
    
    db_session.commit()
    db_session.refresh(workspace)
    return workspace


@pytest.fixture
def test_invite(db_session: Session, test_workspace, test_user, test_user2):
    """Tworzy testowe zaproszenie do workspace'a"""
    from core.models import WorkspaceInvite
    from datetime import datetime, timedelta
    import secrets
    
    invite = WorkspaceInvite(
        workspace_id=test_workspace.id,
        invited_by=test_user.id,
        invited_id=test_user2.id,
        invite_token=secrets.token_urlsafe(32),
        expires_at=datetime.utcnow() + timedelta(days=7),
        is_used=False,
        created_at=datetime.utcnow()
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


@pytest.fixture
def expired_invite(db_session: Session, test_workspace, test_user, test_user2):
    """Tworzy wygasłe zaproszenie"""
    from core.models import WorkspaceInvite
    from datetime import datetime, timedelta
    import secrets
    
    invite = WorkspaceInvite(
        workspace_id=test_workspace.id,
        invited_by=test_user.id,
        invited_id=test_user2.id,
        invite_token=secrets.token_urlsafe(32),
        expires_at=datetime.utcnow() - timedelta(days=1),  # Wygasłe
        is_used=False,
        created_at=datetime.utcnow() - timedelta(days=8)
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


@pytest.fixture
def used_invite(db_session: Session, test_workspace, test_user, test_user2):
    """Tworzy już użyte zaproszenie"""
    from core.models import WorkspaceInvite
    from datetime import datetime, timedelta
    import secrets
    
    invite = WorkspaceInvite(
        workspace_id=test_workspace.id,
        invited_by=test_user.id,
        invited_id=test_user2.id,
        invite_token=secrets.token_urlsafe(32),
        expires_at=datetime.utcnow() + timedelta(days=7),
        is_used=True,  # Już użyte
        accepted_at=datetime.utcnow(),
        created_at=datetime.utcnow()
    )
    db_session.add(invite)
    db_session.commit()
    db_session.refresh(invite)
    return invite


# ═══════════════════════════════════════════════════════════════════════════
# FIXTURES DLA TABLIC (BOARDS)
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture
def test_board(db_session: Session, test_user, test_workspace):
    """Tworzy testową tablicę"""
    board = Board(
        name="Test Board",
        icon="TestIcon",
        bg_color="bg-blue-500",
        workspace_id=test_workspace.id,
        created_by=test_user.id,
        created_at=datetime.utcnow(),
        last_modified=datetime.utcnow(),
        last_modified_by=test_user.id
    )
    db_session.add(board)
    db_session.commit()
    db_session.refresh(board)
    
    # Dodaj relację użytkownik-tablica
    board_user = BoardUsers(
        board_id=board.id,
        user_id=test_user.id,
        is_favourite=False,
        is_online=True,
        last_opened=datetime.utcnow()
    )
    db_session.add(board_user)
    db_session.commit()
    
    return board


@pytest.fixture
def test_board2(db_session: Session, test_user, test_workspace):
    """Tworzy drugą testową tablicę"""
    board = Board(
        name="Test Board 2",
        icon="TestIcon2",
        bg_color="bg-red-500",
        workspace_id=test_workspace.id,
        created_by=test_user.id,
        created_at=datetime.utcnow(),
        last_modified=datetime.utcnow(),
        last_modified_by=test_user.id
    )
    db_session.add(board)
    db_session.commit()
    db_session.refresh(board)
    
    board_user = BoardUsers(
        board_id=board.id,
        user_id=test_user.id,
        is_favourite=False,
        is_online=True,
        last_opened=datetime.utcnow()
    )
    db_session.add(board_user)
    db_session.commit()
    
    return board


@pytest.fixture
def multiple_boards(db_session: Session, test_user, test_workspace):
    """Tworzy wiele tablic dla testów paginacji"""
    boards = []
    for i in range(15):
        board = Board(
            name=f"Test Board {i+1}",
            icon=f"Icon{i+1}",
            bg_color=f"bg-color-{i+1}",
            workspace_id=test_workspace.id,
            created_by=test_user.id,
            created_at=datetime.utcnow(),
            last_modified=datetime.utcnow(),
            last_modified_by=test_user.id
        )
        db_session.add(board)
        db_session.flush()
        
        board_user = BoardUsers(
            board_id=board.id,
            user_id=test_user.id,
            is_favourite=(i % 3 == 0),  # Co trzecia tablica jako ulubiona
            is_online=(i % 2 == 0),  # Co druga jako online
            last_opened=datetime.utcnow()
        )
        db_session.add(board_user)
        boards.append(board)
    
    db_session.commit()
    return boards


@pytest.fixture
def workspace_with_boards(db_session: Session, test_user, test_workspace):
    """Tworzy workspace z kilkoma tablicami"""
    boards = []
    for i in range(5):
        board = Board(
            name=f"Board in Workspace {i+1}",
            icon="PenTool",
            bg_color="bg-gray-500",
            workspace_id=test_workspace.id,
            created_by=test_user.id,
            created_at=datetime.utcnow(),
            last_modified=datetime.utcnow(),
            last_modified_by=test_user.id
        )
        db_session.add(board)
        db_session.flush()
        
        board_user = BoardUsers(
            board_id=board.id,
            user_id=test_user.id,
            is_favourite=False,
            is_online=False,
            last_opened=datetime.utcnow()
        )
        db_session.add(board_user)
        boards.append(board)
    
    db_session.commit()
    return test_workspace, boards


# ═══════════════════════════════════════════════════════════════════════════
# FIXTURES DLA ASYNC TESTÓW
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="session")
def event_loop():
    """Tworzy event loop dla testów asynchronicznych"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# ═══════════════════════════════════════════════════════════════════════════
# HELPER FIXTURES
# ═══════════════════════════════════════════════════════════════════════════

@pytest.fixture
def workspace_with_multiple_members(db_session: Session, test_user, test_user2, test_user3):
    """Tworzy workspace z wieloma członkami"""
    workspace = Workspace(
        name="Multi-member Workspace",
        icon="Users",
        bg_color="bg-indigo-500",
        created_by=test_user.id,
        created_at=datetime.utcnow()
    )
    db_session.add(workspace)
    db_session.flush()
    
    # Owner
    membership1 = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=test_user.id,
        role="owner",
        is_favourite=True,
        joined_at=datetime.utcnow()
    )
    db_session.add(membership1)
    
    # Member 2
    membership2 = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=test_user2.id,
        role="member",
        is_favourite=False,
        joined_at=datetime.utcnow()
    )
    db_session.add(membership2)
    
    # Member 3
    membership3 = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=test_user3.id,
        role="member",
        is_favourite=False,
        joined_at=datetime.utcnow()
    )
    db_session.add(membership3)
    
    db_session.commit()
    db_session.refresh(workspace)
    return workspace


@pytest.fixture
def favourite_workspace(db_session: Session, test_user):
    """Tworzy workspace oznaczony jako ulubiony"""
    workspace = Workspace(
        name="Favourite Workspace",
        icon="Star",
        bg_color="bg-yellow-500",
        created_by=test_user.id,
        created_at=datetime.utcnow()
    )
    db_session.add(workspace)
    db_session.flush()
    
    membership = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=test_user.id,
        role="owner",
        is_favourite=True,  # Oznaczony jako ulubiony
        joined_at=datetime.utcnow()
    )
    db_session.add(membership)
    db_session.commit()
    db_session.refresh(workspace)
    return workspace