"""
═══════════════════════════════════════════════════════════════════════════
                        DASHBOARD SERVICE
                Logika biznesowa dla Workspace'ów
═══════════════════════════════════════════════════════════════════════════

🎯 CEL:
Ten plik zawiera CAŁĄ LOGIKĘ operacji na workspace'ach.
To jak "manager" który rozmawia z bazą danych.

📦 UŻYWANE W:
- routes.py → wywołuje funkcje z tego pliku

🔑 GŁÓWNE FUNKCJE:
- get_user_workspaces() → pobiera workspace'y użytkownika
- get_workspace_by_id() → pobiera jeden workspace
- create_workspace() → tworzy nowy workspace
- update_workspace() → aktualizuje workspace
- delete_workspace() → usuwa workspace
"""

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_
from typing import List, Optional
from fastapi import HTTPException, status
from datetime import datetime, timedelta
import secrets
import asyncio

# Importy modeli z bazy danych
from core.models import Workspace, WorkspaceMember, Board, User, WorkspaceInvite
from core.config import get_settings

# Importy schematów Pydantic
from .schemas import WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse, InviteCreate, InviteResponse, PendingInviteResponse, WorkspaceMemberResponse, WorkspaceMembersListResponse, UpdateMemberRoleRequest

from dashboard.workspaces.utils import send_workspace_invite_email
from .realtime import broadcast_notification
from notifications.service import create_notification

# ═══════════════════════════════════════════════════════════════════════════
# 📋 POBIERANIE WORKSPACE'ÓW UŻYTKOWNIKA
# ═══════════════════════════════════════════════════════════════════════════

def get_user_workspaces(db: Session, user_id: int) -> List[WorkspaceResponse]:
    """
    Pobiera WSZYSTKIE workspace'y do których użytkownik ma dostęp
    
    LOGIKA:
    1. Znajdź workspace'y gdzie użytkownik jest TWÓRCĄ
    2. Znajdź workspace'y gdzie użytkownik jest CZŁONKIEM
    3. Połącz obie listy (usuń duplikaty)
    4. Dla każdego workspace'a dodaj:
       - Liczbę członków
       - Liczbę tablic
       - Rolę użytkownika (owner/member)
       - Czy oznaczony jako ulubiony
    
    PARAMETRY:
    - db: Sesja bazy danych (SQLAlchemy)
    - user_id: ID zalogowanego użytkownika
    
    ZWRACA:
    Lista WorkspaceResponse (może być pusta [])
    
    PRZYKŁAD UŻYCIA:
    workspaces = get_user_workspaces(db, current_user.id)
    """
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 1: Pobierz workspace'y gdzie użytkownik jest CZŁONKIEM
    # ───────────────────────────────────────────────────────────────────────
    
    # Zapytanie SQL (w uproszczeniu):
    # SELECT workspace_members.*, workspaces.* 
    # FROM workspace_members 
    # JOIN workspaces ON workspace_members.workspace_id = workspaces.id
    # WHERE workspace_members.user_id = {user_id}
    
    memberships = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.user_id == user_id)
        .options(
            joinedload(WorkspaceMember.workspace)  # Pobierz też dane workspace'a
            .joinedload(Workspace.creator)  # I dane twórcy
        )
        .all()
    )
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 2: Przygotuj odpowiedź dla każdego workspace'a
    # ───────────────────────────────────────────────────────────────────────
    
    workspaces_data = []
    
    for membership in memberships:
        workspace = membership.workspace
        
        # Policz członków (ile osób ma dostęp)
        member_count = (
            db.query(WorkspaceMember)
            .filter(WorkspaceMember.workspace_id == workspace.id)
            .count()
        )
        
        # Policz tablice (ile tablic jest w workspace'ie)
        board_count = (
            db.query(Board)
            .filter(Board.workspace_id == workspace.id)
            .count()
        )
        
        # Sprawdź rolę użytkownika
        is_owner = workspace.created_by == user_id
        role = "owner" if is_owner else membership.role
        
        # Stwórz obiekt odpowiedzi
        workspace_data = WorkspaceResponse(
            id=workspace.id,
            name=workspace.name,
            icon=workspace.icon,
            bg_color=workspace.bg_color,
            created_by=workspace.created_by,
            creator={
                "id": workspace.creator.id,
                "username": workspace.creator.username,
                "email": workspace.creator.email,
                "full_name": workspace.creator.full_name
            } if workspace.creator else None,
            member_count=member_count,
            board_count=board_count,
            is_owner=is_owner,
            role=role,
            is_favourite=membership.is_favourite
        )
        
        workspaces_data.append(workspace_data)
    
    return workspaces_data


# ═══════════════════════════════════════════════════════════════════════════
# 🔍 POBIERANIE POJEDYNCZEGO WORKSPACE'A
# ═══════════════════════════════════════════════════════════════════════════

def get_workspace_by_id(db: Session, workspace_id: int, user_id: int) -> WorkspaceResponse:
    """
    Pobiera JEDEN konkretny workspace
    
    BEZPIECZEŃSTWO:
    Sprawdza czy użytkownik MA DOSTĘP do tego workspace'a!
    
    PARAMETRY:
    - db: Sesja bazy danych
    - workspace_id: ID workspace'a
    - user_id: ID zalogowanego użytkownika
    
    ZWRACA:
    WorkspaceResponse
    
    BŁĘDY:
    - 404: Workspace nie istnieje LUB użytkownik nie ma dostępu
    
    PRZYKŁAD UŻYCIA:
    workspace = get_workspace_by_id(db, 1, current_user.id)
    """
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 1: Pobierz workspace z bazy
    # ───────────────────────────────────────────────────────────────────────
    
    workspace = (
        db.query(Workspace)
        .options(joinedload(Workspace.creator))  # Pobierz też twórcę
        .filter(Workspace.id == workspace_id)
        .first()
    )
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace nie został znaleziony"
        )
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 2: Sprawdź czy użytkownik MA DOSTĘP
    # ───────────────────────────────────────────────────────────────────────
    
    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id
        )
        .first()
    )
    
    if not membership:
        # Użytkownik NIE jest członkiem tego workspace'a
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie masz dostępu do tego workspace'a"
        )
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 3: Przygotuj pełne dane
    # ───────────────────────────────────────────────────────────────────────
    
    member_count = (
        db.query(WorkspaceMember)
        .filter(WorkspaceMember.workspace_id == workspace.id)
        .count()
    )
    
    board_count = (
        db.query(Board)
        .filter(Board.workspace_id == workspace.id)
        .count()
    )
    
    is_owner = workspace.created_by == user_id
    role = "owner" if is_owner else membership.role
    
    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        icon=workspace.icon,
        bg_color=workspace.bg_color,
        created_by=workspace.created_by,
        creator={
            "id": workspace.creator.id,
            "username": workspace.creator.username,
            "email": workspace.creator.email,
            "full_name": workspace.creator.full_name
        } if workspace.creator else None,
        member_count=member_count,
        board_count=board_count,
        is_owner=is_owner,
        role=role,
        is_favourite=membership.is_favourite
    )


# ═══════════════════════════════════════════════════════════════════════════
# ➕ TWORZENIE NOWEGO WORKSPACE'A
# ═══════════════════════════════════════════════════════════════════════════

def create_workspace(db: Session, workspace_data: WorkspaceCreate, user_id: int) -> WorkspaceResponse:
    # 1. Tworzymy workspace
    new_workspace = Workspace(
        name=workspace_data.name,
        icon=workspace_data.icon or "Home",
        bg_color=workspace_data.bg_color or "bg-green-500",
        created_by=user_id,  # ← to jest OK
        created_at=datetime.utcnow()
    )
    
    db.add(new_workspace)
    db.flush()  # ← daje ID
    db.refresh(new_workspace)  # ← KLUCZOWE! Odświeża relacje (creator się załaduje)

    # 2. Dodajemy właściciela
    membership = WorkspaceMember(
        workspace_id=new_workspace.id,
        user_id=user_id,
        role="owner",
        is_favourite=False
    )
    db.add(membership)
    db.commit()  # ← teraz wszystko zapisane
    db.refresh(new_workspace)  # ← jeszcze raz, żeby relacje były pełne
    db.refresh(membership)

    # 3. Pobieramy twórcę (teraz już istnieje)
    creator = db.query(User).filter(User.id == user_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Twórca nie istnieje")

    # 4. Zwracamy pełny response
    return WorkspaceResponse(
        id=new_workspace.id,
        name=new_workspace.name,
        icon=new_workspace.icon,
        bg_color=new_workspace.bg_color,
        created_by=new_workspace.created_by,
        creator={
            "id": creator.id,
            "username": creator.username,
            "email": creator.email,
            "full_name": creator.full_name
        },  # ← Przekazuj jako dict, NIE używaj from_orm()
        member_count=1,
        board_count=0,
        is_owner=True,
        role="owner",
        is_favourite=False
    )


# ═══════════════════════════════════════════════════════════════════════════
# ✏️ AKTUALIZACJA WORKSPACE'A
# ═══════════════════════════════════════════════════════════════════════════

def update_workspace(
    db: Session, 
    workspace_id: int, 
    workspace_data: WorkspaceUpdate, 
    user_id: int
) -> WorkspaceResponse:
    """
    Aktualizuje workspace (nazwa, ikona, kolor)
    
    BEZPIECZEŃSTWO:
    Tylko OWNER może edytować workspace!
    
    PARAMETRY:
    - db: Sesja bazy danych
    - workspace_id: ID workspace'a do aktualizacji
    - workspace_data: Nowe dane (opcjonalne pola)
    - user_id: ID użytkownika który edytuje
    
    ZWRACA:
    WorkspaceResponse
    
    BŁĘDY:
    - 404: Workspace nie istnieje
    - 403: Użytkownik nie jest ownerem
    
    PRZYKŁAD UŻYCIA:
    updated = update_workspace(db, 1, WorkspaceUpdate(name="Nowa Nazwa"), user_id=1)
    """
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 1: Pobierz workspace
    # ───────────────────────────────────────────────────────────────────────
    
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace nie został znaleziony"
        )
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 2: Sprawdź uprawnienia (tylko owner może edytować)
    # ───────────────────────────────────────────────────────────────────────
    
    if workspace.created_by != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tylko właściciel może edytować workspace"
        )
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 3: Aktualizuj tylko podane pola
    # ───────────────────────────────────────────────────────────────────────
    
    if workspace_data.name is not None:
        workspace.name = workspace_data.name
    
    if workspace_data.icon is not None:
        workspace.icon = workspace_data.icon
    
    if workspace_data.bg_color is not None:
        workspace.bg_color = workspace_data.bg_color
    
    db.commit()
    db.refresh(workspace)
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 4: Zwróć zaktualizowany workspace
    # ───────────────────────────────────────────────────────────────────────
    
    return get_workspace_by_id(db, workspace_id, user_id)


# ═══════════════════════════════════════════════════════════════════════════
# 🗑️ USUWANIE WORKSPACE'A
# ═══════════════════════════════════════════════════════════════════════════

def delete_workspace(db: Session, workspace_id: int, user_id: int) -> dict:
    """
    Usuwa workspace
    
    BEZPIECZEŃSTWO:
    Tylko OWNER może usunąć workspace!
    
    KASKADOWE USUWANIE:
    Gdy usuwasz workspace, automatycznie usuwa się też:
    - Wszystkie członkostwa (workspace_members)
    - Wszystkie tablice (boards)
    - Wszystkie zaproszenia (workspace_invites)
    
    PARAMETRY:
    - db: Sesja bazy danych
    - workspace_id: ID workspace'a do usunięcia
    - user_id: ID użytkownika który usuwa
    
    ZWRACA:
    {"message": "Workspace został usunięty"}
    
    BŁĘDY:
    - 404: Workspace nie istnieje
    - 403: Użytkownik nie jest ownerem
    
    PRZYKŁAD UŻYCIA:
    result = delete_workspace(db, 1, user_id=1)
    """
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 1: Pobierz workspace
    # ───────────────────────────────────────────────────────────────────────
    
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace nie został znaleziony"
        )
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 2: Sprawdź uprawnienia (tylko owner może usunąć)
    # ───────────────────────────────────────────────────────────────────────
    
    if workspace.created_by != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tylko właściciel może usunąć workspace"
        )
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 3: Usuń workspace (kaskadowe usuwanie reszty)
    # ───────────────────────────────────────────────────────────────────────
    
    db.delete(workspace)
    db.commit()
    
    return {"message": "Workspace został usunięty"}


# ═══════════════════════════════════════════════════════════════════════════
# ⭐ TOGGLE FAVOURITE - Zmiana ulubionego
# ═══════════════════════════════════════════════════════════════════════════

def toggle_workspace_favourite(db: Session, workspace_id: int, user_id: int, is_favourite: bool) -> dict:
    """
    Zmienia status ulubionego dla workspace'a (w workspace_members)
    
    LOGIKA:
    1. Znajdź membership użytkownika w tym workspace'ie
    2. Zmień is_favourite w workspace_members
    3. Zapisz
    
    PARAMETRY:
    - db: Sesja bazy danych
    - workspace_id: ID workspace'a
    - user_id: ID użytkownika
    - is_favourite: True = ulubiony, False = nie ulubiony
    
    ZWRACA:
    {"message": "Status ulubionego został zmieniony", "is_favourite": True/False}
    
    BŁĘDY:
    - 404: Nie jesteś członkiem tego workspace'a
    
    PRZYKŁAD UŻYCIA:
    result = toggle_workspace_favourite(db, 1, user_id=5, is_favourite=True)
    """
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 1: Znajdź membership
    # ───────────────────────────────────────────────────────────────────────
    
    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id
        )
        .first()
    )
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie jesteś członkiem tego workspace'a"
        )
    
    # ───────────────────────────────────────────────────────────────────────
    # Krok 2: Zmień status
    # ───────────────────────────────────────────────────────────────────────
    
    membership.is_favourite = is_favourite
    db.commit()
    
    return {
        "message": "Status ulubionego został zmieniony",
        "is_favourite": is_favourite
    }


# ═══════════════════════════════════════════════════════════════════════════
# 🚪 OPUSZCZANIE WORKSPACE'A (dla memberów)
# ═══════════════════════════════════════════════════════════════════════════

def leave_workspace(db: Session, workspace_id: int, user_id: int) -> dict:
    """
    Pozwala użytkownikowi OPUŚCIĆ workspace (usunąć swoje członkostwo)
    
    BEZPIECZEŃSTWO:
    - Owner NIE MOŻE opuścić swojego workspace'a (musi go usunąć)
    - Member może opuścić w dowolnym momencie
    
    PARAMETRY:
    - db: Sesja bazy danych
    - workspace_id: ID workspace'a
    - user_id: ID użytkownika który opuszcza
    
    ZWRACA:
    {"message": "Opuściłeś workspace"}
    
    BŁĘDY:
    - 404: Nie jesteś członkiem tego workspace'a
    - 403: Właściciel nie może opuścić swojego workspace'a
    """
    
    # Sprawdź członkostwo
    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id
        )
        .first()
    )
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie jesteś członkiem tego workspace'a"
        )
    
    # Sprawdź czy to nie owner
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if workspace and workspace.created_by == user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Właściciel nie może opuścić swojego workspace'a. Musisz go usunąć."
        )
    
    # Usuń członkostwo
    db.delete(membership)
    db.commit()
    
    return {"message": "Opuściłeś workspace"}


# ═══════════════════════════════════════════════════════════════════════════
# 👥 POBIERANIE CZŁONKÓW WORKSPACE'A
# ═══════════════════════════════════════════════════════════════════════════

def get_workspace_members(db: Session, workspace_id: int, user_id: int) -> WorkspaceMembersListResponse:
    """
    Pobiera listę wszystkich członków workspace'a
    
    BEZPIECZEŃSTWO:
    Tylko członek workspace'a może zobaczyć innych członków
    
    PARAMETRY:
    - db: Sesja bazy danych
    - workspace_id: ID workspace'a
    - user_id: ID użytkownika który wykonuje zapytanie
    
    ZWRACA:
    WorkspaceMembersListResponse z listą członków
    
    BŁĘDY:
    - 404: Workspace nie istnieje lub użytkownik nie ma dostępu
    """
    
    # Sprawdź czy workspace istnieje
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace nie został znaleziony"
        )
    
    # Sprawdź czy użytkownik jest członkiem
    user_membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id
        )
        .first()
    )
    
    if not user_membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie masz dostępu do tego workspace'a"
        )
    
    # Pobierz wszystkich członków z danymi użytkownika
    memberships = (
        db.query(WorkspaceMember)
        .options(joinedload(WorkspaceMember.user))
        .filter(WorkspaceMember.workspace_id == workspace_id)
        .order_by(WorkspaceMember.joined_at.asc())
        .all()
    )
    
    # Przygotuj odpowiedź
    members = []
    for membership in memberships:
        is_owner = workspace.created_by == membership.user_id
        members.append(WorkspaceMemberResponse(
            id=membership.id,
            user_id=membership.user.id,
            username=membership.user.username,
            email=membership.user.email,
            full_name=membership.user.full_name,
            role="owner" if is_owner else membership.role,
            joined_at=membership.joined_at,
            is_owner=is_owner
        ))
    
    return WorkspaceMembersListResponse(
        members=members,
        total=len(members)
    )


# ═══════════════════════════════════════════════════════════════════════════
# 🗑️ USUWANIE CZŁONKA Z WORKSPACE'A
# ═══════════════════════════════════════════════════════════════════════════

def remove_workspace_member(db: Session, workspace_id: int, member_user_id: int, current_user_id: int) -> dict:
    """
    Usuwa członka z workspace'a
    
    BEZPIECZEŃSTWO:
    - Tylko OWNER może usuwać członków
    - Owner nie może usunąć samego siebie (musi usunąć cały workspace)
    
    PARAMETRY:
    - db: Sesja bazy danych
    - workspace_id: ID workspace'a
    - member_user_id: ID użytkownika do usunięcia
    - current_user_id: ID użytkownika wykonującego akcję (musi być owner)
    
    ZWRACA:
    {"message": "Członek został usunięty z workspace'a"}
    
    BŁĘDY:
    - 404: Workspace lub członek nie istnieje
    - 403: Brak uprawnień (nie jesteś ownerem)
    - 400: Nie można usunąć właściciela
    """
    
    # Sprawdź czy workspace istnieje
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace nie został znaleziony"
        )
    
    # Sprawdź czy użytkownik jest właścicielem
    if workspace.created_by != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tylko właściciel może usuwać członków"
        )
    
    # Nie można usunąć właściciela
    if member_user_id == workspace.created_by:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie można usunąć właściciela workspace'a"
        )
    
    # Znajdź członkostwo
    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == member_user_id
        )
        .first()
    )
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Użytkownik nie jest członkiem tego workspace'a"
        )
    
    # Pobierz nazwę użytkownika przed usunięciem (do wiadomości)
    user = db.query(User).filter(User.id == member_user_id).first()
    username = user.username if user else "Użytkownik"
    
    # Usuń członkostwo
    db.delete(membership)
    db.commit()
    
    return {
        "message": f"Użytkownik {username} został usunięty z workspace'a"
    }


# ═══════════════════════════════════════════════════════════════════════════
# 🔐 ZMIANA ROLI CZŁONKA WORKSPACE'A
# ═══════════════════════════════════════════════════════════════════════════

def update_member_role(db: Session, workspace_id: int, member_user_id: int, new_role: str, current_user_id: int) -> dict:
    """
    Zmienia rolę członka workspace'a
    
    BEZPIECZEŃSTWO:
    - Tylko OWNER może zmieniać role
    - Nie można zmienić roli samemu sobie (właściciel zawsze owner)
    - Możliwe role: "owner", "editor", "viewer"
    
    PARAMETRY:
    - db: Sesja bazy danych
    - workspace_id: ID workspace'a
    - member_user_id: ID użytkownika którego rolę zmieniamy
    - new_role: Nowa rola ("owner", "editor", "viewer")
    - current_user_id: ID użytkownika wykonującego akcję (musi być owner)
    
    ZWRACA:
    {"message": "Rola została zmieniona", "new_role": "editor"}
    
    BŁĘDY:
    - 404: Workspace lub członek nie istnieje
    - 403: Brak uprawnień (nie jesteś ownerem)
    - 400: Nie można zmienić własnej roli / nieprawidłowa rola
    """
    
    # Walidacja roli
    valid_roles = ["owner", "editor", "viewer"]
    if new_role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Nieprawidłowa rola. Dozwolone: {', '.join(valid_roles)}"
        )
    
    # Sprawdź czy workspace istnieje
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace nie został znaleziony"
        )
    
    # Sprawdź czy użytkownik jest właścicielem
    if workspace.created_by != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tylko właściciel może zmieniać role członków"
        )
    
    # Nie można zmienić roli sobie
    if member_user_id == current_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nie możesz zmienić własnej roli"
        )
    
    # Znajdź członkostwo
    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == member_user_id
        )
        .first()
    )
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Użytkownik nie jest członkiem tego workspace'a"
        )
    
    # Pobierz nazwę użytkownika (do wiadomości)
    user = db.query(User).filter(User.id == member_user_id).first()
    username = user.username if user else "Użytkownik"
    
    # Zmień rolę
    old_role = membership.role
    membership.role = new_role
    db.commit()
    
    return {
        "message": f"Zmieniono rolę użytkownika {username} z '{old_role}' na '{new_role}'",
        "new_role": new_role,
        "user_id": member_user_id
    }


# ═══════════════════════════════════════════════════════════════════════════
# 📋 POBIERANIE WŁASNEJ ROLI W WORKSPACE
# ═══════════════════════════════════════════════════════════════════════════

def get_user_role_in_workspace(db: Session, workspace_id: int, user_id: int) -> dict:
    """
    Pobiera rolę użytkownika w workspace'ie
    
    PARAMETRY:
    - db: Sesja bazy danych
    - workspace_id: ID workspace'a
    - user_id: ID użytkownika
    
    ZWRACA:
    {"role": "editor", "is_owner": false}
    
    BŁĘDY:
    - 404: Nie jesteś członkiem tego workspace'a
    """
    
    # Sprawdź czy workspace istnieje
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace nie został znaleziony"
        )
    
    # Znajdź członkostwo
    membership = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id
        )
        .first()
    )
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nie jesteś członkiem tego workspace'a"
        )
    
    is_owner = workspace.created_by == user_id
    
    return {
        "role": "owner" if is_owner else membership.role,
        "is_owner": is_owner,
        "workspace_id": workspace_id
    }
