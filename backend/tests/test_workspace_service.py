"""
Testy dla WorkspaceService - POPRAWIONE
Fix: creator może być dict lub obiekt Pydantic
"""
import pytest
from datetime import datetime
from fastapi import HTTPException

from dashboard.workspaces.service import (
    get_user_workspaces,
    get_workspace_by_id,
    create_workspace,
    update_workspace,
    delete_workspace,
    toggle_workspace_favourite
)
from dashboard.workspaces.schemas import (
    WorkspaceCreate,
    WorkspaceUpdate,
    WorkspaceResponse,
    WorkspaceListResponse,
    ToggleFavouriteRequest
)
from core.models import Workspace, WorkspaceMember, Board


def get_creator_field(creator, field):
    """Helper: pobiera pole z creator (dict lub obiekt)"""
    if isinstance(creator, dict):
        return creator.get(field)
    else:
        return getattr(creator, field, None)


class TestWorkspaceServiceCreate:
    """Testy tworzenia workspace'ów"""
    
    def test_create_workspace_success(self, db_session, test_user):
        """Test pomyślnego utworzenia workspace'a"""
        workspace_data = WorkspaceCreate(
            name="New Test Workspace",
            icon="Building",
            bg_color="bg-blue-500"
        )
        
        result = create_workspace(db_session, workspace_data, test_user.id)
        
        assert isinstance(result, WorkspaceResponse)
        assert result.name == "New Test Workspace"
        assert result.icon == "Building"
        assert result.bg_color == "bg-blue-500"
        assert result.created_by == test_user.id
        assert result.is_owner == True
        assert result.role == "owner"
        assert result.member_count == 1
        assert result.board_count == 0
        assert result.is_favourite == False
        
        # Sprawdź czy workspace został dodany do bazy
        workspace = db_session.query(Workspace).filter(
            Workspace.name == "New Test Workspace"
        ).first()
        assert workspace is not None
        assert workspace.created_by == test_user.id
    
    def test_create_workspace_with_default_values(self, db_session, test_user):
        """Test utworzenia workspace'a z wartościami domyślnymi"""
        workspace_data = WorkspaceCreate(
            name="Workspace with defaults"
        )
        
        result = create_workspace(db_session, workspace_data, test_user.id)
        
        assert result.icon == "Home"  # Domyślna wartość
        assert result.bg_color == "bg-green-500"  # Domyślna wartość
    
    def test_create_workspace_creates_membership(self, db_session, test_user):
        """Test czy tworzenie workspace'a tworzy relację WorkspaceMember"""
        workspace_data = WorkspaceCreate(
            name="Membership Test Workspace"
        )
        
        result = create_workspace(db_session, workspace_data, test_user.id)
        
        # Sprawdź relację
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == result.id,
            WorkspaceMember.user_id == test_user.id
        ).first()
        
        assert membership is not None
        assert membership.role == "owner"
        assert membership.is_favourite == False
    
    def test_create_workspace_includes_creator_info(self, db_session, test_user):
        """Test czy response zawiera informacje o twórcy"""
        workspace_data = WorkspaceCreate(
            name="Creator Info Test"
        )
        
        result = create_workspace(db_session, workspace_data, test_user.id)
        
        assert result.creator is not None
        assert get_creator_field(result.creator, "id") == test_user.id
        assert get_creator_field(result.creator, "username") == test_user.username
        assert get_creator_field(result.creator, "email") == test_user.email


class TestWorkspaceServiceUpdate:
    """Testy aktualizacji workspace'ów"""
    
    def test_update_workspace_success(self, db_session, test_user, test_workspace):
        """Test pomyślnej aktualizacji workspace'a"""
        update_data = WorkspaceUpdate(
            name="Updated Workspace Name",
            icon="UpdatedIcon",
            bg_color="bg-red-500"
        )
        
        result = update_workspace(
            db_session, 
            test_workspace.id, 
            update_data, 
            test_user.id
        )
        
        assert isinstance(result, WorkspaceResponse)
        assert result.name == "Updated Workspace Name"
        assert result.icon == "UpdatedIcon"
        assert result.bg_color == "bg-red-500"
    
    def test_update_workspace_partial(self, db_session, test_user, test_workspace):
        """Test częściowej aktualizacji workspace'a"""
        original_icon = test_workspace.icon
        original_color = test_workspace.bg_color
        
        update_data = WorkspaceUpdate(name="Partially Updated")
        
        result = update_workspace(
            db_session, 
            test_workspace.id, 
            update_data, 
            test_user.id
        )
        
        assert result.name == "Partially Updated"
        assert result.icon == original_icon
        assert result.bg_color == original_color
    
    def test_update_workspace_not_found(self, db_session, test_user):
        """Test aktualizacji nieistniejącego workspace'a"""
        update_data = WorkspaceUpdate(name="Non-existent")
        
        with pytest.raises(HTTPException) as exc_info:
            update_workspace(db_session, 99999, update_data, test_user.id)
        
        assert exc_info.value.status_code == 404
        assert "nie został znaleziony" in str(exc_info.value.detail)
    
    def test_update_workspace_not_owner(self, db_session, test_user2, test_workspace):
        """Test aktualizacji workspace'a przez użytkownika niebędącego właścicielem"""
        update_data = WorkspaceUpdate(name="Unauthorized Update")
        
        with pytest.raises(HTTPException) as exc_info:
            update_workspace(
                db_session, 
                test_workspace.id, 
                update_data, 
                test_user2.id
            )
        
        assert exc_info.value.status_code == 403
        assert "Tylko właściciel" in str(exc_info.value.detail)
    
    def test_update_workspace_name_only(self, db_session, test_user, test_workspace):
        """Test aktualizacji tylko nazwy"""
        update_data = WorkspaceUpdate(name="Only Name Changed")
        
        result = update_workspace(
            db_session, 
            test_workspace.id, 
            update_data, 
            test_user.id
        )
        
        assert result.name == "Only Name Changed"
        # Reszta powinna pozostać bez zmian
        db_session.refresh(test_workspace)
        assert test_workspace.name == "Only Name Changed"
    
    def test_update_workspace_icon_only(self, db_session, test_user, test_workspace):
        """Test aktualizacji tylko ikony"""
        original_name = test_workspace.name
        
        update_data = WorkspaceUpdate(icon="Star")
        
        result = update_workspace(
            db_session, 
            test_workspace.id, 
            update_data, 
            test_user.id
        )
        
        assert result.icon == "Star"
        assert result.name == original_name
    
    def test_update_workspace_color_only(self, db_session, test_user, test_workspace):
        """Test aktualizacji tylko koloru"""
        original_name = test_workspace.name
        
        update_data = WorkspaceUpdate(bg_color="bg-purple-500")
        
        result = update_workspace(
            db_session, 
            test_workspace.id, 
            update_data, 
            test_user.id
        )
        
        assert result.bg_color == "bg-purple-500"
        assert result.name == original_name


class TestWorkspaceServiceDelete:
    """Testy usuwania workspace'ów"""
    
    def test_delete_workspace_success(self, db_session, test_user, test_workspace):
        """Test pomyślnego usunięcia workspace'a"""
        workspace_id = test_workspace.id
        
        result = delete_workspace(db_session, workspace_id, test_user.id)
        
        assert result["message"] == "Workspace został usunięty"
        
        # Sprawdź czy workspace został usunięty
        workspace = db_session.query(Workspace).filter(
            Workspace.id == workspace_id
        ).first()
        assert workspace is None
    
    def test_delete_workspace_not_owner(self, db_session, test_user2, test_workspace):
        """Test usuwania workspace'a przez użytkownika niebędącego właścicielem"""
        with pytest.raises(HTTPException) as exc_info:
            delete_workspace(db_session, test_workspace.id, test_user2.id)
        
        assert exc_info.value.status_code == 403
        assert "Tylko właściciel" in str(exc_info.value.detail)
    
    def test_delete_workspace_not_found(self, db_session, test_user):
        """Test usuwania nieistniejącego workspace'a"""
        with pytest.raises(HTTPException) as exc_info:
            delete_workspace(db_session, 99999, test_user.id)
        
        assert exc_info.value.status_code == 404
        assert "nie został znaleziony" in str(exc_info.value.detail)
    
    def test_delete_workspace_cascades_to_members(self, db_session, test_user, test_user2):
        """Test czy usunięcie workspace'a usuwa członkostwa"""
        # Utwórz workspace
        workspace_data = WorkspaceCreate(name="Cascade Test")
        workspace = create_workspace(db_session, workspace_data, test_user.id)
        
        # Dodaj drugiego członka
        membership = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user2.id,
            role="member"
        )
        db_session.add(membership)
        db_session.commit()
        
        # Sprawdź że są 2 członków
        member_count = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace.id
        ).count()
        assert member_count == 2
        
        # Usuń workspace
        delete_workspace(db_session, workspace.id, test_user.id)
        
        # Sprawdź czy członkostwa zostały usunięte
        member_count = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == workspace.id
        ).count()
        assert member_count == 0
    
    def test_delete_workspace_cascades_to_boards(self, db_session, test_user, test_workspace):
        """Test czy usunięcie workspace'a usuwa tablice"""
        # Dodaj tablicę
        board = Board(
            name="Test Board",
            workspace_id=test_workspace.id,
            created_by=test_user.id,
            created_at=datetime.utcnow(),
            last_modified=datetime.utcnow()
        )
        db_session.add(board)
        db_session.commit()
        
        # Sprawdź że tablica istnieje
        board_count = db_session.query(Board).filter(
            Board.workspace_id == test_workspace.id
        ).count()
        assert board_count == 1
        
        # Usuń workspace
        delete_workspace(db_session, test_workspace.id, test_user.id)
        
        # Sprawdź czy tablice zostały usunięte
        board_count = db_session.query(Board).filter(
            Board.workspace_id == test_workspace.id
        ).count()
        assert board_count == 0


class TestWorkspaceServiceToggleFavourite:
    """Testy toggleowania ulubionych"""
    
    def test_toggle_favourite_to_true(self, db_session, test_user, test_workspace):
        """Test ustawienia workspace'a jako ulubionego"""
        result = toggle_workspace_favourite(
            db_session, 
            test_workspace.id, 
            test_user.id, 
            True
        )
        
        assert result["message"] == "Status ulubionego został zmieniony"
        assert result["is_favourite"] == True
        
        # Sprawdź w bazie
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_workspace.id,
            WorkspaceMember.user_id == test_user.id
        ).first()
        assert membership.is_favourite == True
    
    def test_toggle_favourite_to_false(self, db_session, test_user, test_workspace):
        """Test usunięcia workspace'a z ulubionych"""
        # Najpierw ustaw jako ulubiony
        membership = db_session.query(WorkspaceMember).filter(
            WorkspaceMember.workspace_id == test_workspace.id,
            WorkspaceMember.user_id == test_user.id
        ).first()
        membership.is_favourite = True
        db_session.commit()
        
        # Teraz usuń z ulubionych
        result = toggle_workspace_favourite(
            db_session, 
            test_workspace.id, 
            test_user.id, 
            False
        )
        
        assert result["is_favourite"] == False
        
        # Sprawdź w bazie
        db_session.refresh(membership)
        assert membership.is_favourite == False
    
    def test_toggle_favourite_not_member(self, db_session, test_user2, test_workspace):
        """Test toggleowania przez użytkownika niebędącego członkiem"""
        with pytest.raises(HTTPException) as exc_info:
            toggle_workspace_favourite(
                db_session, 
                test_workspace.id, 
                test_user2.id, 
                True
            )
        
        assert exc_info.value.status_code == 404
        assert "Nie jesteś członkiem" in str(exc_info.value.detail)
    
    def test_toggle_favourite_multiple_times(self, db_session, test_user, test_workspace):
        """Test wielokrotnego przełączania ulubionego"""
        # True
        result1 = toggle_workspace_favourite(
            db_session, 
            test_workspace.id, 
            test_user.id, 
            True
        )
        assert result1["is_favourite"] == True
        
        # False
        result2 = toggle_workspace_favourite(
            db_session, 
            test_workspace.id, 
            test_user.id, 
            False
        )
        assert result2["is_favourite"] == False
        
        # True again
        result3 = toggle_workspace_favourite(
            db_session, 
            test_workspace.id, 
            test_user.id, 
            True
        )
        assert result3["is_favourite"] == True


class TestWorkspaceServiceGetById:
    """Testy pobierania pojedynczego workspace'a"""
    
    def test_get_workspace_by_id_success(self, db_session, test_user, test_workspace):
        """Test pomyślnego pobrania workspace'a"""
        result = get_workspace_by_id(
            db_session, 
            test_workspace.id, 
            test_user.id
        )
        
        assert isinstance(result, WorkspaceResponse)
        assert result.id == test_workspace.id
        assert result.name == test_workspace.name
        assert result.is_owner == True
        assert result.role == "owner"
    
    def test_get_workspace_by_id_not_found(self, db_session, test_user):
        """Test pobrania nieistniejącego workspace'a"""
        with pytest.raises(HTTPException) as exc_info:
            get_workspace_by_id(db_session, 99999, test_user.id)
        
        assert exc_info.value.status_code == 404
        assert "nie został znaleziony" in str(exc_info.value.detail)
    
    def test_get_workspace_by_id_no_access(self, db_session, test_user2, test_workspace):
        """Test pobrania workspace'a bez dostępu"""
        with pytest.raises(HTTPException) as exc_info:
            get_workspace_by_id(
                db_session, 
                test_workspace.id, 
                test_user2.id
            )
        
        assert exc_info.value.status_code == 404
        assert "Nie masz dostępu" in str(exc_info.value.detail)
    
    def test_get_workspace_includes_counts(self, db_session, test_user, test_workspace):
        """Test czy response zawiera liczniki"""
        # Dodaj tablicę
        board = Board(
            name="Test Board",
            workspace_id=test_workspace.id,
            created_by=test_user.id,
            created_at=datetime.utcnow(),
            last_modified=datetime.utcnow()
        )
        db_session.add(board)
        db_session.commit()
        
        result = get_workspace_by_id(
            db_session, 
            test_workspace.id, 
            test_user.id
        )
        
        assert result.member_count == 1
        assert result.board_count == 1
    
    def test_get_workspace_as_member(self, db_session, test_user, test_user2):
        """Test pobrania workspace'a jako członek (nie owner)"""
        # Utwórz workspace
        workspace_data = WorkspaceCreate(name="Member Test")
        workspace = create_workspace(db_session, workspace_data, test_user.id)
        
        # Dodaj test_user2 jako członka
        membership = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user2.id,
            role="member"
        )
        db_session.add(membership)
        db_session.commit()
        
        # Pobierz jako test_user2
        result = get_workspace_by_id(
            db_session, 
            workspace.id, 
            test_user2.id
        )
        
        assert result.is_owner == False
        assert result.role == "member"


class TestWorkspaceServiceList:
    """Testy listowania workspace'ów"""
    
    def test_list_workspaces_success(self, db_session, test_user):
        """Test pobrania listy workspace'ów"""
        # Utwórz kilka workspace'ów
        for i in range(3):
            workspace_data = WorkspaceCreate(name=f"Workspace {i+1}")
            create_workspace(db_session, workspace_data, test_user.id)
        
        result = get_user_workspaces(db_session, test_user.id)
        
        assert isinstance(result, list)
        assert len(result) == 3
        assert all(isinstance(w, WorkspaceResponse) for w in result)
    
    def test_list_workspaces_empty(self, db_session, test_user):
        """Test listowania workspace'ów gdy użytkownik nie ma żadnych"""
        result = get_user_workspaces(db_session, test_user.id)
        
        assert isinstance(result, list)
        assert len(result) == 0
    
    def test_list_workspaces_includes_memberships(self, db_session, test_user, test_user2):
        """Test czy lista zawiera workspace'y gdzie użytkownik jest członkiem"""
        # test_user tworzy workspace
        workspace_data = WorkspaceCreate(name="Shared Workspace")
        workspace = create_workspace(db_session, workspace_data, test_user.id)
        
        # Dodaj test_user2 jako członka
        membership = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user2.id,
            role="member"
        )
        db_session.add(membership)
        db_session.commit()
        
        # Pobierz listę dla test_user2
        result = get_user_workspaces(db_session, test_user2.id)
        
        assert len(result) == 1
        assert result[0].id == workspace.id
        assert result[0].is_owner == False
        assert result[0].role == "member"
    
    def test_list_workspaces_contains_favourite_info(self, db_session, test_user):
        """Test czy lista zawiera informacje o ulubionych"""
        # Utwórz workspace
        workspace_data = WorkspaceCreate(name="Favourite Test")
        workspace = create_workspace(db_session, workspace_data, test_user.id)
        
        # Ustaw jako ulubiony
        toggle_workspace_favourite(db_session, workspace.id, test_user.id, True)
        
        # Pobierz listę
        result = get_user_workspaces(db_session, test_user.id)
        
        assert len(result) == 1
        assert result[0].is_favourite == True
    
    def test_list_workspaces_correct_counts(self, db_session, test_user, test_user2):
        """Test czy lista zawiera poprawne liczniki"""
        # Utwórz workspace
        workspace_data = WorkspaceCreate(name="Counts Test")
        workspace = create_workspace(db_session, workspace_data, test_user.id)
        
        # Dodaj drugiego członka
        membership = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user2.id,
            role="member"
        )
        db_session.add(membership)
        
        # Dodaj 2 tablice
        for i in range(2):
            board = Board(
                name=f"Board {i+1}",
                workspace_id=workspace.id,
                created_by=test_user.id,
                created_at=datetime.utcnow(),
                last_modified=datetime.utcnow()
            )
            db_session.add(board)
        db_session.commit()
        
        # Pobierz listę
        result = get_user_workspaces(db_session, test_user.id)
        
        assert len(result) == 1
        assert result[0].member_count == 2
        assert result[0].board_count == 2
    
    def test_list_workspaces_multiple_roles(self, db_session, test_user, test_user2):
        """Test listowania workspace'ów z różnymi rolami"""
        # test_user tworzy workspace (owner)
        workspace1_data = WorkspaceCreate(name="Owned Workspace")
        workspace1 = create_workspace(db_session, workspace1_data, test_user.id)
        
        # test_user2 tworzy workspace i dodaje test_user jako członka
        workspace2_data = WorkspaceCreate(name="Member Workspace")
        workspace2 = create_workspace(db_session, workspace2_data, test_user2.id)
        
        membership = WorkspaceMember(
            workspace_id=workspace2.id,
            user_id=test_user.id,
            role="member"
        )
        db_session.add(membership)
        db_session.commit()
        
        # Pobierz listę dla test_user
        result = get_user_workspaces(db_session, test_user.id)
        
        assert len(result) == 2
        
        # Znajdź workspace'y po nazwach
        owned = next(w for w in result if w.name == "Owned Workspace")
        member = next(w for w in result if w.name == "Member Workspace")
        
        assert owned.is_owner == True
        assert owned.role == "owner"
        assert member.is_owner == False
        assert member.role == "member"


class TestWorkspaceServiceCreatorInfo:
    """Testy informacji o twórcy"""
    
    def test_workspace_includes_creator_basic_info(self, db_session, test_user, test_workspace):
        """Test czy workspace zawiera podstawowe info o twórcy"""
        result = get_workspace_by_id(
            db_session, 
            test_workspace.id, 
            test_user.id
        )
        
        assert result.creator is not None
        assert get_creator_field(result.creator, "id") == test_user.id
        assert get_creator_field(result.creator, "username") == test_user.username
        assert get_creator_field(result.creator, "email") == test_user.email
        assert get_creator_field(result.creator, "full_name") == test_user.full_name
    
    def test_workspace_creator_no_sensitive_data(self, db_session, test_user, test_workspace):
        """Test czy info o twórcy nie zawiera wrażliwych danych (hasło)"""
        result = get_workspace_by_id(
            db_session, 
            test_workspace.id, 
            test_user.id
        )
        
        # Sprawdź czy creator nie ma hasła
        if isinstance(result.creator, dict):
            assert "password" not in result.creator
            assert "hashed_password" not in result.creator
        else:
            # Jeśli to obiekt Pydantic
            assert not hasattr(result.creator, "password")
            assert not hasattr(result.creator, "hashed_password")


class TestWorkspaceServiceEdgeCases:
    """Testy przypadków brzegowych"""
    
    def test_create_workspace_with_empty_name_fails(self, db_session, test_user):
        """Test czy tworzenie workspace'a z pustą nazwą kończy się błędem"""
        # Pydantic validation powinno to złapać
        with pytest.raises((ValueError, Exception)):
            workspace_data = WorkspaceCreate(name="")
            create_workspace(db_session, workspace_data, test_user.id)
    
    def test_create_workspace_with_very_long_name(self, db_session, test_user):
        """Test tworzenia workspace'a z bardzo długą nazwą"""
        long_name = "A" * 200  # Max length w schemacie
        
        workspace_data = WorkspaceCreate(name=long_name)
        result = create_workspace(db_session, workspace_data, test_user.id)
        
        assert result.name == long_name
    
    def test_update_workspace_with_none_values(self, db_session, test_user, test_workspace):
        """Test aktualizacji z wartościami None (nie powinno nic zmieniać)"""
        original_name = test_workspace.name
        original_icon = test_workspace.icon
        original_color = test_workspace.bg_color
        
        update_data = WorkspaceUpdate(
            name=None,
            icon=None,
            bg_color=None
        )
        
        result = update_workspace(
            db_session, 
            test_workspace.id, 
            update_data, 
            test_user.id
        )
        
        assert result.name == original_name
        assert result.icon == original_icon
        assert result.bg_color == original_color
    
    def test_multiple_users_same_workspace_name(self, db_session, test_user, test_user2):
        """Test czy różni użytkownicy mogą mieć workspace'y o tej samej nazwie"""
        workspace_data = WorkspaceCreate(name="Same Name")
        
        workspace1 = create_workspace(db_session, workspace_data, test_user.id)
        workspace2 = create_workspace(db_session, workspace_data, test_user2.id)
        
        assert workspace1.id != workspace2.id
        assert workspace1.name == workspace2.name
        assert workspace1.created_by != workspace2.created_by


class TestWorkspaceServiceIntegration:
    """Testy integracyjne - kompletne scenariusze"""
    
    def test_full_workspace_lifecycle(self, db_session, test_user):
        """Test pełnego cyklu życia workspace'a"""
        # 1. Utwórz
        workspace_data = WorkspaceCreate(
            name="Lifecycle Test",
            icon="Star",
            bg_color="bg-yellow-500"
        )
        created = create_workspace(db_session, workspace_data, test_user.id)
        assert created.name == "Lifecycle Test"
        
        # 2. Pobierz
        retrieved = get_workspace_by_id(db_session, created.id, test_user.id)
        assert retrieved.id == created.id
        
        # 3. Aktualizuj
        update_data = WorkspaceUpdate(name="Updated Lifecycle")
        updated = update_workspace(
            db_session, 
            created.id, 
            update_data, 
            test_user.id
        )
        assert updated.name == "Updated Lifecycle"
        
        # 4. Toggle favourite
        toggle_result = toggle_workspace_favourite(
            db_session, 
            created.id, 
            test_user.id, 
            True
        )
        assert toggle_result["is_favourite"] == True
        
        # 5. Sprawdź w liście
        workspaces = get_user_workspaces(db_session, test_user.id)
        assert len(workspaces) == 1
        assert workspaces[0].is_favourite == True
        
        # 6. Usuń
        delete_result = delete_workspace(db_session, created.id, test_user.id)
        assert delete_result["message"] == "Workspace został usunięty"
        
        # 7. Sprawdź czy usunięty
        workspaces_after = get_user_workspaces(db_session, test_user.id)
        assert len(workspaces_after) == 0
    
    def test_workspace_with_multiple_members(self, db_session, test_user, test_user2):
        """Test workspace'a z wieloma członkami"""
        # Utwórz workspace
        workspace_data = WorkspaceCreate(name="Multi-member Workspace")
        workspace = create_workspace(db_session, workspace_data, test_user.id)
        
        # Dodaj drugiego członka
        membership = WorkspaceMember(
            workspace_id=workspace.id,
            user_id=test_user2.id,
            role="member"
        )
        db_session.add(membership)
        db_session.commit()
        
        # Sprawdź z perspektywy ownera
        owner_view = get_workspace_by_id(
            db_session, 
            workspace.id, 
            test_user.id
        )
        assert owner_view.member_count == 2
        assert owner_view.is_owner == True
        
        # Sprawdź z perspektywy członka
        member_view = get_workspace_by_id(
            db_session, 
            workspace.id, 
            test_user2.id
        )
        assert member_view.member_count == 2
        assert member_view.is_owner == False
        
        # Członek nie może usunąć
        with pytest.raises(HTTPException) as exc_info:
            delete_workspace(db_session, workspace.id, test_user2.id)
        assert exc_info.value.status_code == 403
        
        # Owner może usunąć
        delete_result = delete_workspace(db_session, workspace.id, test_user.id)