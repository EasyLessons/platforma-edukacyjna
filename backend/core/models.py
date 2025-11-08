from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

from core.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Kod weryfikacyjny - bezpośrednio w tabeli user
    verification_code = Column(String(6), nullable=True)
    verification_code_expires = Column(DateTime, nullable=True)

    # Relationships
    created_workspaces = relationship("Workspace", back_populates="creator")
    workspace_memberships = relationship("WorkspaceMember", back_populates="user")
    created_boards = relationship(
        "Board",
        back_populates="creator",
        foreign_keys="[Board.created_by]"
    )
    modified_boards = relationship(
        "Board",
        back_populates="last_modifier",
        foreign_keys="[Board.last_modified_by]"
    )
    board_users = relationship("BoardUsers", back_populates="user")

class Workspace(Base):
    __tablename__ = "workspaces"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    icon = Column(String, default='Home')
    bg_color = Column(String(50), default="bg-green-500")
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
<<<<<<< HEAD
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)  # ← DODANE!
=======
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
>>>>>>> 642d0675ad56bdf51c9d1ce4e00f28502e554504
    
    # Relationships
    creator = relationship("User", back_populates="created_workspaces")
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    boards = relationship("Board", back_populates="workspace", cascade="all, delete-orphan")
    invites = relationship("WorkspaceInvite", back_populates="workspace", cascade="all, delete-orphan")

class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), default="member", nullable=False)
    is_favourite = Column(Boolean, default=False, index=True)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", back_populates="workspace_memberships")

class Board(Base):
    __tablename__ = "boards"
    
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    name = Column(String(200), nullable=False)
    icon = Column(String(50), default="PenTool")
    bg_color = Column(String(50), default="bg-gray-500")
    last_modified = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_modified_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    
    # Relationships
    workspace = relationship("Workspace", back_populates="boards")
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_boards")
    last_modifier = relationship("User", foreign_keys=[last_modified_by], back_populates="modified_boards")
    users = relationship("BoardUsers", back_populates="board", cascade="all, delete-orphan")

class BoardUsers(Base):
    __tablename__ = "board_users"
    
    id = Column(Integer, primary_key=True, index=True)
    board_id = Column(Integer, ForeignKey("boards.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    is_online = Column(Boolean, default=False, index=True)
    is_favourite = Column(Boolean, default=False)
    last_opened = Column(DateTime, nullable=True)
    
    # Relationships
    board = relationship("Board", back_populates="users")
    user = relationship("User", back_populates="board_users")

class WorkspaceInvite(Base):
    __tablename__ = "workspace_invites"
    
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    invited_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invite_token = Column(String(100), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    is_used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    workspace = relationship("Workspace", back_populates="invites")
    inviter = relationship("User")
