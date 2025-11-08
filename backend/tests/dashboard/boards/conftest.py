"""
Konfiguracja pytest dla testów modułu boards
"""
import pytest
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from datetime import datetime

from core.models import Base, User, Workspace, Board, BoardUsers
from core.database import get_db
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


@pytest.fixture
def test_user(db_session: Session):
    """Tworzy testowego użytkownika"""
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
def test_workspace(db_session: Session, test_user):
    """Tworzy testową przestrzeń roboczą"""
    workspace = Workspace(
        name="Test Workspace",
        created_by=test_user.id,
        created_at=datetime.utcnow()
    )
    db_session.add(workspace)
    db_session.commit()
    db_session.refresh(workspace)
    return workspace


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


@pytest.fixture(scope="session")
def event_loop():
    """Tworzy event loop dla testów asynchronicznych"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()