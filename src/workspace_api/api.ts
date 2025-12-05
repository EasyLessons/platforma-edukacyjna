/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        WORKSPACE API SERVICE
 *                   Komunikacja z backendem dla workspace'ów
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🎯 CEL:
 * Ten plik zawiera funkcje do komunikacji z backendem FastAPI.
 * To jak "kurier" który dostarcza zapytania do backendu i przynosi odpowiedzi.
 * 
 * 📡 FUNKCJE:
 * - fetchWorkspaces() → Pobiera listę workspace'ów użytkownika
 * - fetchWorkspaceById() → Pobiera jeden workspace
 * - createWorkspace() → Tworzy nowy workspace
 * - updateWorkspace() → Aktualizuje workspace
 * - deleteWorkspace() → Usuwa workspace
 * 
 * 📦 UŻYWANE W:
 * - WorkspaceContext.tsx → Context wywołuje te funkcje
 * - Komponenty dashboardu → bezpośrednio lub przez Context
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 KONFIGURACJA
// ═══════════════════════════════════════════════════════════════════════════

// URL backendu z pliku .env lub localhost:8000
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';


// ═══════════════════════════════════════════════════════════════════════════
// 📝 TYPY TYPESCRIPT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Podstawowe info o użytkowniku (bez hasła!)
 */
export interface UserBasic {
  id: number;
  username: string;
  email: string;
  full_name?: string;
}

/**
 * Pojedynczy workspace - PEŁNE dane z backendu
 * 
 * PRZYKŁAD:
 * {
 *   id: 1,
 *   name: "Moja Firma",
 *   icon: "Building",
 *   bg_color: "bg-blue-500",
 *   created_by: 5,
 *   creator: { id: 5, username: "mati", ... },
 *   member_count: 3,
 *   board_count: 5,
 *   is_owner: true,
 *   role: "owner",
 *   is_favourite: false
 * }
 */
export interface Workspace {
  id: number;
  name: string;
  icon: string;
  bg_color: string;
  created_by: number;
  creator?: UserBasic;
  member_count: number;
  board_count: number;
  is_owner: boolean;
  role: string;  // "owner" lub "member"
  is_favourite: boolean;
}

/**
 * Odpowiedź z listy workspace'ów
 * 
 * PRZYKŁAD:
 * {
 *   workspaces: [workspace1, workspace2, ...],
 *   total: 5
 * }
 */
export interface WorkspaceListResponse {
  workspaces: Workspace[];
  total: number;
}

/**
 * Dane do TWORZENIA nowego workspace'a
 * 
 * WYMAGANE:
 * - name: string (min 1 znak)
 * 
 * OPCJONALNE:
 * - icon: string (domyślnie "Home")
 * - bg_color: string (domyślnie "bg-green-500")
 * 
 * PRZYKŁAD:
 * {
 *   name: "Moja Firma",
 *   icon: "Building",
 *   bg_color: "bg-blue-500"
 * }
 */
export interface WorkspaceCreate {
  name: string;
  icon?: string;
  bg_color?: string;
}

/**
 * Dane do AKTUALIZACJI workspace'a
 * 
 * WSZYSTKIE pola OPCJONALNE - zmieniasz tylko to co chcesz
 * 
 * PRZYKŁAD:
 * {
 *   name: "Zmieniona Nazwa"  // zmieniam tylko nazwę
 * }
 */
export interface WorkspaceUpdate {
  name?: string;
  icon?: string;
  bg_color?: string;
}

/**
  * Pojedyncze zaproszenie oczekujące na akceptację
 */
export interface PendingInvite {
  id: number;
  workspace_id: number;
  workspace_name: string;
  workspace_icon: string;
  workspace_bg_color: string;
  invited_by: number;
  inviter_name: string;
   invited_id: number;
  invited_user_name: string;
  invite_token: string;
  expires_at: string;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ HELPER - Pobieranie tokenu
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pobiera JWT token z localStorage
 * 
 * UŻYWANE W:
 * Każdym zapytaniu do backendu (Authorization header)
 * 
 * ZWRACA:
 * Token (string) lub null jeśli niezalogowany
 */
const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token');
  }
  return null;
};


// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ HELPER - Obsługa błędów
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Obsługuje odpowiedź z backendu i błędy
 * 
 * LOGIKA:
 * 1. Parsuje JSON
 * 2. Sprawdza czy response.ok (status 200-299)
 * 3. Jeśli błąd → rzuca Error z komunikatem z backendu
 * 4. Jeśli ok → zwraca dane
 * 
 * PARAMETRY:
 * - response: Response z fetch()
 * 
 * ZWRACA:
 * Sparsowane dane JSON
 * 
 * BŁĘDY:
 * Rzuca Error jeśli backend zwrócił błąd
 */
const handleResponse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const errorMessage = data.detail || 'Wystąpił błąd';
    throw new Error(errorMessage);
  }
  
  return data;
};


// ═══════════════════════════════════════════════════════════════════════════
// 📡 API FUNKCJE
// ═══════════════════════════════════════════════════════════════════════════


/**
 * ───────────────────────────────────────────────────────────────────────────
 * 📋 POBIERANIE LISTY WORKSPACE'ÓW
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Pobiera WSZYSTKIE workspace'y zalogowanego użytkownika
 * 
 * ENDPOINT:
 * GET /api/workspaces
 * 
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany (token w localStorage)
 * 
 * ZWRACA:
 * {
 *   workspaces: [workspace1, workspace2, ...],
 *   total: 5
 * }
 * 
 * BŁĘDY:
 * - 401: Brak tokenu lub token nieprawidłowy
 * - 500: Błąd serwera
 * 
 * PRZYKŁAD UŻYCIA:
 * const { workspaces, total } = await fetchWorkspaces();
 * console.log(`Użytkownik ma ${total} workspace'ów`);
 */
export const fetchWorkspaces = async (): Promise<WorkspaceListResponse> => {
  // Pobierz token z localStorage
  const token = getToken();
  
  // Jeśli brak tokenu → użytkownik niezalogowany
  if (!token) {
    throw new Error('Musisz być zalogowany żeby pobierać workspace\'y');
  }
  
  // Wyślij zapytanie GET do backendu
  const response = await fetch(`${API_BASE_URL}/api/workspaces`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,  // JWT token
      'Content-Type': 'application/json'
    }
  });
  
  // Obsłuż odpowiedź (sprawdzi błędy)
  return handleResponse(response);
};


/**
 * ───────────────────────────────────────────────────────────────────────────
 * 🔍 POBIERANIE POJEDYNCZEGO WORKSPACE'A
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Pobiera JEDEN konkretny workspace
 * 
 * ENDPOINT:
 * GET /api/workspaces/{workspaceId}
 * 
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - Użytkownik MUSI mieć dostęp do tego workspace'a
 * 
 * PARAMETRY:
 * - workspaceId: ID workspace'a (number)
 * 
 * ZWRACA:
 * Workspace (pojedynczy obiekt z pełnymi danymi)
 * 
 * BŁĘDY:
 * - 401: Niezalogowany
 * - 404: Workspace nie istnieje LUB brak dostępu
 * 
 * PRZYKŁAD UŻYCIA:
 * const workspace = await fetchWorkspaceById(1);
 * console.log(workspace.name); // "Moja Firma"
 */
export const fetchWorkspaceById = async (workspaceId: number): Promise<Workspace> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Musisz być zalogowany');
  }
  
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse(response);
};


/**
 * ───────────────────────────────────────────────────────────────────────────
 * ➕ TWORZENIE NOWEGO WORKSPACE'A
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Tworzy NOWY workspace
 * 
 * ENDPOINT:
 * POST /api/workspaces
 * 
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * 
 * PARAMETRY:
 * - workspaceData: WorkspaceCreate
 *   {
 *     name: "Moja Firma" (WYMAGANE),
 *     icon: "Building" (OPCJONALNE),
 *     bg_color: "bg-blue-500" (OPCJONALNE)
 *   }
 * 
 * ZWRACA:
 * Utworzony workspace (Workspace)
 * 
 * LOGIKA BACKENDU:
 * - Tworzy workspace w bazie
 * - Automatycznie dodaje użytkownika jako owner
 * 
 * BŁĘDY:
 * - 401: Niezalogowany
 * - 422: Błąd walidacji (np. pusta nazwa)
 * 
 * PRZYKŁAD UŻYCIA:
 * const newWorkspace = await createWorkspace({
 *   name: "Moja Firma",
 *   icon: "Building",
 *   bg_color: "bg-blue-500"
 * });
 * console.log(`Utworzono workspace: ${newWorkspace.name}`);
 */
export const createWorkspace = async (workspaceData: WorkspaceCreate): Promise<Workspace> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Musisz być zalogowany żeby tworzyć workspace\'y');
  }
  
  const response = await fetch(`${API_BASE_URL}/api/workspaces`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(workspaceData)  // Dane workspace'a jako JSON
  });
  
  return handleResponse(response);
};


/**
 * ───────────────────────────────────────────────────────────────────────────
 * ✏️ AKTUALIZACJA WORKSPACE'A
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Aktualizuje workspace (nazwa, ikona, kolor)
 * 
 * ENDPOINT:
 * PUT /api/workspaces/{workspaceId}
 * 
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - Użytkownik MUSI być OWNEREM workspace'a
 * 
 * PARAMETRY:
 * - workspaceId: ID workspace'a (number)
 * - workspaceData: WorkspaceUpdate (wszystkie pola OPCJONALNE)
 *   {
 *     name?: "Nowa Nazwa",
 *     icon?: "Star",
 *     bg_color?: "bg-yellow-500"
 *   }
 * 
 * ZWRACA:
 * Zaktualizowany workspace (Workspace)
 * 
 * BŁĘDY:
 * - 401: Niezalogowany
 * - 403: Użytkownik nie jest ownerem
 * - 404: Workspace nie istnieje
 * 
 * PRZYKŁAD UŻYCIA:
 * const updated = await updateWorkspace(1, {
 *   name: "Zmieniona Nazwa"
 * });
 * console.log(updated.name); // "Zmieniona Nazwa"
 */
export const updateWorkspace = async (
  workspaceId: number,
  workspaceData: WorkspaceUpdate
): Promise<Workspace> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Musisz być zalogowany');
  }
  
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(workspaceData)
  });
  
  return handleResponse(response);
};


/**
 * ───────────────────────────────────────────────────────────────────────────
 * 🗑️ USUWANIE WORKSPACE'A
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Usuwa workspace
 * 
 * ENDPOINT:
 * DELETE /api/workspaces/{workspaceId}
 * 
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - Użytkownik MUSI być OWNEREM workspace'a
 * 
 * PARAMETRY:
 * - workspaceId: ID workspace'a (number)
 * 
 * ZWRACA:
 * { message: "Workspace został usunięty" }
 * 
 * KASKADOWE USUWANIE:
 * Backend automatycznie usuwa też:
 * - Wszystkie członkostwa
 * - Wszystkie tablice
 * - Wszystkie zaproszenia
 * 
 * BŁĘDY:
 * - 401: Niezalogowany
 * - 403: Użytkownik nie jest ownerem
 * - 404: Workspace nie istnieje
 * 
 * PRZYKŁAD UŻYCIA:
 * await deleteWorkspace(1);
 * console.log('Workspace usunięty!');
 */
export const deleteWorkspace = async (workspaceId: number): Promise<{ message: string }> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Musisz być zalogowany');
  }
  
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse(response);
};

/**
 * ───────────────────────────────────────────────────────────────────────────
 * ⭐ TOGGLE ULUBIONY
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Zmienia status ulubionego dla workspace'a
 * 
 * ENDPOINT:
 * PATCH /api/workspaces/{workspaceId}/favourite
 * 
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - Użytkownik MUSI być członkiem workspace'a
 * 
 * PARAMETRY:
 * - workspaceId: ID workspace'a (number)
 * - isFavourite: true = ulubiony, false = nie ulubiony (boolean)
 * 
 * ZWRACA:
 * { message: "...", is_favourite: true/false }
 * 
 * LOGIKA:
 * Zmienia is_favourite w workspace_members (każdy użytkownik ma SWÓJ status!)
 * 
 * PRZYKŁAD UŻYCIA:
 * await toggleWorkspaceFavourite(1, true);  // Dodaj do ulubionych
 * await toggleWorkspaceFavourite(1, false); // Usuń z ulubionych
 */
export const toggleWorkspaceFavourite = async (
  workspaceId: number,
  isFavourite: boolean
): Promise<{ message: string; is_favourite: boolean }> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Musisz być zalogowany');
  }
  
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/favourite`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ is_favourite: isFavourite })
  });
  
  return handleResponse(response);
};


/**
 * ───────────────────────────────────────────────────────────────────────────
 * 🔥 USTAW AKTYWNY WORKSPACE
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Ustaw workspace jako aktywny dla użytkownika
 * 
 * ENDPOINT:
 * PATCH /api/workspaces/{workspaceId}/set-active
 * 
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - Użytkownik MUSI mieć dostęp do workspace'a
 * 
 * PARAMETRY:
 * - workspaceId: ID workspace'a (number)
 * 
 * ZWRACA:
 * { message: "...", active_workspace_id: number }
 * 
 * LOGIKA:
 * Zapisuje active_workspace_id w tabeli users
 * 
 * PRZYKŁAD UŻYCIA:
 * await setActiveWorkspace(1);  // Ustaw workspace 1 jako aktywny
 */
export const setActiveWorkspace = async (workspaceId: number): Promise<void> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Musisz być zalogowany');
  }
  
  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/set-active`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  return handleResponse(response);
};

/**
 * Tworzy zaproszenie do workspace'a
 */
export const createInvite = async (
  workspaceId: number, 
  invitedUserId: number
): Promise<any> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Musisz być zalogowany');
  }
  
  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/${workspaceId}/invite`, 
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        invited_user_id: invitedUserId
      })
    }
  );
  
  return handleResponse(response);
};

/**
 * Pobiera zaproszenia oczekujące
 */
export const fetchPendingInvites = async (): Promise<PendingInvite[]> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Musisz być zalogowany');
  }
  
  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/invites/pending`, 
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return handleResponse(response);
};

/**
 * Akceptuje zaproszenie
 */
export const acceptInvite = async (token: string): Promise<any> => {
  const authToken = getToken();
  
  if (!authToken) {
    throw new Error('Musisz być zalogowany');
  }
  
  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/invites/accept/${token}`, 
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return handleResponse(response);
};

/**
 * Odrzuca zaproszenie
 */
export const rejectInvite = async (token: string): Promise<any> => {
  const authToken = getToken();
  
  if (!authToken) {
    throw new Error('Musisz być zalogowany');
  }
  
  const response = await fetch(
    `${API_BASE_URL}/api/workspaces/invites/${token}`, 
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return handleResponse(response);
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 PODSUMOWANIE FUNKCJI
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * POBIERANIE:
 * ✅ fetchWorkspaces() - lista workspace'ów użytkownika
 * ✅ fetchWorkspaceById(id) - jeden workspace
 * 
 * TWORZENIE I EDYCJA:
 * ✅ createWorkspace(data) - nowy workspace
 * ✅ updateWorkspace(id, data) - aktualizacja
 * 
 * USUWANIE:
 * ✅ deleteWorkspace(id) - usunięcie
 * 
 * AUTORYZACJA:
 * ✅ Wszystkie funkcje pobierają token z localStorage
 * ✅ Token dodawany jako: Authorization: Bearer TOKEN
 * 
 * OBSŁUGA BŁĘDÓW:
 * ✅ handleResponse() sprawdza błędy i rzuca Error
 * ✅ Komunikaty błędów z backendu (data.detail)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */