"""
OnboardingService - konfiguruje startowe zasoby dla 
nowo zarejestrowanego użytkownika.
"""
from sqlalchemy.orm import Session

from core.models import Workspace
from api.v1.workspaces.service import create_starter_workspace
from api.v1.boards.service import create_starter_board

class OnboardingService:
    def __init__(self, db: Session):
        self.db = db

    def setup_new_user(self, user_id: int) -> Workspace:
        """Tworzy startowy workspace i domyślną tablicę.
        Nie commituje - wołający zarządza transakcją."""
        workspace = create_starter_workspace(self.db, user_id)
        create_starter_board(self.db, workspace.id, user_id)
        return workspace