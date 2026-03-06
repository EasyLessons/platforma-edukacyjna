"""
Skrypt do inicjalizacji bazy danych
Tworzy wszystkie tabele zdefiniowane w models.py
"""

from core.database import engine, Base
from core.models import User, Workspace, WorkspaceMember, Board, BoardUsers, WorkspaceInvite, BoardElement

def init_database():
    """Tworzy wszystkie tabele w bazie danych"""
    print("🔨 Tworzenie tabel w bazie danych...")
    
    # To stworzy wszystkie tabele na podstawie modeli
    Base.metadata.create_all(bind=engine)
    
    print("✅ Tabele zostały utworzone!")
    print("Utworzone tabele:")
    print("  - users")
    print("  - workspaces")
    print("  - workspace_members")
    print("  - boards")
    print("  - board_users")
    print("  - workspace_invites")
    print("  - board_elements")

if __name__ == "__main__":
    init_database()