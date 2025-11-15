"""
═══════════════════════════════════════════════════════════════════════════
                        DASHBOARD SCHEMAS
                    Struktury danych dla Workspace'ów
═══════════════════════════════════════════════════════════════════════════

🎯 CEL:
Ten plik definiuje JAK WYGLĄDAJĄ dane które przesyłamy między frontendem a backendem.
To jak "formularz" - określa jakie pola są wymagane, jakiego typu, itp.

📦 UŻYWANE W:
- routes.py → waliduje przychodzące dane
- service.py → zwraca dane w odpowiednim formacie
- Frontend → TypeScript wie jak ma wyglądać odpowiedź z API

🔑 GŁÓWNE MODELE:
- WorkspaceCreate → dane do TWORZENIA workspace'a
- WorkspaceResponse → dane ZWRACANE z backendu
- WorkspaceList → lista workspace'ów użytkownika
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════
# 📝 WORKSPACE CREATE - Dane do tworzenia workspace'a
# ═══════════════════════════════════════════════════════════════════════════

class WorkspaceCreate(BaseModel):
    """
    Model do TWORZENIA nowego workspace'a
    
    KIEDY UŻYWANY?
    Gdy frontend wysyła POST /api/workspaces żeby stworzyć nowy workspace
    
    PRZYKŁAD z frontu:
    {
      "name": "Moja Firma",
      "icon": "Building",
      "bg_color": "bg-blue-500"
    }
    """
    name: str = Field(..., min_length=1, max_length=200, description="Nazwa workspace'a")
    # ☝️ ... = pole WYMAGANE (nie może być puste)
    # min_length=1 = minimum 1 znak
    # max_length=200 = maksymalnie 200 znaków
    
    icon: Optional[str] = Field(default="Home", description="Nazwa ikony (lucide-react)")
    # ☝️ Optional = pole OPCJONALNE (może nie być wysłane)
    # default="Home" = jeśli nie podasz, użyje "Home"
    
    bg_color: Optional[str] = Field(default="bg-green-500", description="Kolor tła (Tailwind)")
    # ☝️ Domyślnie zielony, ale można zmienić
    
    class Config:
        # Przykład jak powinien wyglądać JSON
        json_schema_extra = {
            "example": {
                "name": "Korepetycje z Matematyki",
                "icon": "Calculator",
                "bg_color": "bg-purple-500"
            }
        }


# ═══════════════════════════════════════════════════════════════════════════
# 👤 USER BASIC - Podstawowe info o użytkowniku (bez haseł!)
# ═══════════════════════════════════════════════════════════════════════════

class UserBasic(BaseModel):
    """
    Podstawowe informacje o użytkowniku (BEZ HASŁA!)
    
    BEZPIECZEŃSTWO:
    Nigdy nie wysyłamy haseł do frontendu! Tylko podstawowe info.
    """
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    
    class Config:
        from_attributes = True  # Pozwala tworzyć z SQLAlchemy models


# ═══════════════════════════════════════════════════════════════════════════
# 🏢 WORKSPACE RESPONSE - Pełne dane workspace'a
# ═══════════════════════════════════════════════════════════════════════════

class WorkspaceResponse(BaseModel):
    """
    Model ZWRACANY z backendu - pełne dane workspace'a
    
    KIEDY UŻYWANY?
    - GET /api/workspaces → lista workspace'ów
    - GET /api/workspaces/{id} → jeden workspace
    - POST /api/workspaces → po stworzeniu
    
    PRZYKŁAD odpowiedzi:
    {
      "id": 1,
      "name": "Moja Firma",
      "icon": "Building",
      "bg_color": "bg-blue-500",
      "created_by": 5,
      "creator": {
        "id": 5,
        "username": "mati",
        "email": "mati@example.com",
        "full_name": "Mateusz"
      },
      "member_count": 3,
      "board_count": 5,
      "is_owner": true,
      "role": "owner"
    }
    """
    id: int
    name: str
    icon: str
    bg_color: str
    created_by: int  # ID użytkownika który stworzył
    
    # ───────────────────────────────────────────────────────────────────────
    # Relacje (dodatkowe dane)
    # ───────────────────────────────────────────────────────────────────────
    
    creator: Optional[UserBasic] = None
    # ☝️ Pełne dane twórcy workspace'a (username, email, itp.)
    
    member_count: int = 0
    # ☝️ Ile osób jest w workspace'ie
    
    board_count: int = 0
    # ☝️ Ile tablic jest w workspace'ie
    
    # ───────────────────────────────────────────────────────────────────────
    # Info o roli użytkownika
    # ───────────────────────────────────────────────────────────────────────
    
    is_owner: bool = False
    # ☝️ Czy AKTUALNY użytkownik jest właścicielem?
    
    role: str = "member"
    # ☝️ Rola użytkownika: "owner" lub "member"
    
    is_favourite: bool = False
    # ☝️ Czy użytkownik oznaczył jako ulubiony?
    
    class Config:
        from_attributes = True  # Pozwala tworzyć z SQLAlchemy models
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "Korepetycje",
                "icon": "BookOpen",
                "bg_color": "bg-green-500",
                "created_by": 1,
                "creator": {
                    "id": 1,
                    "username": "mati",
                    "email": "mati@example.com",
                    "full_name": "Mateusz"
                },
                "member_count": 3,
                "board_count": 5,
                "is_owner": True,
                "role": "owner",
                "is_favourite": False
            }
        }


# ═══════════════════════════════════════════════════════════════════════════
# 📋 WORKSPACE LIST - Lista wszystkich workspace'ów użytkownika
# ═══════════════════════════════════════════════════════════════════════════

class WorkspaceListResponse(BaseModel):
    """
    Lista workspace'ów użytkownika
    
    KIEDY UŻYWANY?
    GET /api/workspaces → zwraca listę wszystkich workspace'ów
    
    PRZYKŁAD:
    {
      "workspaces": [
        { "id": 1, "name": "Praca", ... },
        { "id": 2, "name": "Szkoła", ... }
      ],
      "total": 2
    }
    """
    workspaces: List[WorkspaceResponse]
    # ☝️ Lista workspace'ów (może być pusta [])
    
    total: int
    # ☝️ Ile workspace'ów użytkownik ma w sumie


# ═══════════════════════════════════════════════════════════════════════════
# 🔄 UPDATE - Dane do aktualizacji workspace'a
# ═══════════════════════════════════════════════════════════════════════════

class WorkspaceUpdate(BaseModel):
    """
    Model do AKTUALIZACJI workspace'a
    
    KIEDY UŻYWANY?
    PUT /api/workspaces/{id} → zmiana nazwy, ikony lub koloru
    
    WSZYSTKIE pola OPCJONALNE - zmieniasz tylko to co chcesz
    
    PRZYKŁAD:
    {
      "name": "Nowa Nazwa"  ← zmieniam tylko nazwę
    }
    """
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    icon: Optional[str] = None
    bg_color: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Zmieniona Nazwa",
                "icon": "Star",
                "bg_color": "bg-yellow-500"
            }
        }


# ═══════════════════════════════════════════════════════════════════════════
# 📊 STATS - Statystyki workspace'a
# ═══════════════════════════════════════════════════════════════════════════

class WorkspaceStats(BaseModel):
    """
    Szczegółowe statystyki workspace'a
    
    OPCJONALNY endpoint - możesz dodać później
    GET /api/workspaces/{id}/stats
    """
    total_members: int
    total_boards: int
    active_boards: int  # Ile tablic było edytowanych ostatnio
    total_invites: int  # Ile zaproszeń jest aktywnych



# ═══════════════════════════════════════════════════════════════════════════
# ⭐ FAVOURITE TOGGLE - Zmiana ulubionego
# ═══════════════════════════════════════════════════════════════════════════

class ToggleFavouriteRequest(BaseModel):
    """
    Request do zmiany statusu ulubionego
    
    PRZYKŁAD:
    {
      "is_favourite": true
    }
    """
    is_favourite: bool = Field(..., description="Czy workspace ma być ulubiony?")



# ═══════════════════════════════════════════════════════════════════════════
# INVITATION SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════

class InviteCreate(BaseModel):
    """Schema do tworzenia zaproszenia"""
    workspace_id: int
    invited_user_id: int


class InviteResponse(BaseModel):
    """Podstawowa odpowiedź z zaproszeniem"""
    id: int
    workspace_id: int
    invited_by: int
    invited_id: int
    invite_token: str
    expires_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


class PendingInviteResponse(BaseModel):
    """Zaproszenie z dodatkowymi informacjami o workspace"""
    id: int
    workspace_id: int
    workspace_name: str
    workspace_icon: str
    workspace_bg_color: str
    invited_by: int
    inviter_name: str
    invited_id: int
    invited_user_name: str
    invite_token: str
    expires_at: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# 📚 PODSUMOWANIE
# ═══════════════════════════════════════════════════════════════════════════

# MODELE WEJŚCIOWE (frontend → backend):
# ✅ WorkspaceCreate - tworzenie nowego workspace'a
# ✅ WorkspaceUpdate - aktualizacja workspace'a

# MODELE WYJŚCIOWE (backend → frontend):
# ✅ WorkspaceResponse - pojedynczy workspace z pełnymi danymi
# ✅ WorkspaceListResponse - lista workspace'ów
# ✅ UserBasic - podstawowe info o użytkowniku

# DODATKOWE:
# ✅ WorkspaceStats - statystyki (opcjonalne)

# ═══════════════════════════════════════════════════════════════════════════


