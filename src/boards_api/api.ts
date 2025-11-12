/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        BOARDS API SERVICE
 *                   Komunikacja z backendem dla tablic
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🎯 CEL:
 * Funkcje do komunikacji z backendem FastAPI dla operacji na tablicach
 * 
 * 📡 FUNKCJE:
 * - fetchBoards() → Pobiera listę tablic w workspace
 * - createBoard() → Tworzy nową tablicę
 * - deleteBoard() → Usuwa tablicę
 * - toggleBoardFavourite() → Zmienia status ulubionej
 */

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 KONFIGURACJA
// ═══════════════════════════════════════════════════════════════════════════

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ HELPER - Pobieranie tokenu
// ═══════════════════════════════════════════════════════════════════════════

const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('access_token');
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// 🛡️ HELPER - Obsługa błędów
// ═══════════════════════════════════════════════════════════════════════════

const handleResponse = async (response: Response) => {
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const errorMessage = data.detail || 'Wystąpił błąd';
    throw new Error(errorMessage);
  }
  
  return data;
};

// ═══════════════════════════════════════════════════════════════════════════
// 📝 TYPY TYPESCRIPT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tablica z backendu (pełne dane)
 * 
 * UWAGA: Daty są w formacie ISO 8601 string (np. "2025-11-12T23:15:00Z")
 */
export interface Board {
  id: number;
  name: string;
  icon: string;
  bg_color: string;
  workspace_id: number;
  owner_id: number;
  owner_username: string;
  is_favourite: boolean;
  last_modified: string;  // ISO 8601 string
  last_modified_by: string | null;
  last_opened: string | null;  // ISO 8601 string
  created_at: string;  // ISO 8601 string
  created_by: string;
}

/**
 * Dane do tworzenia nowej tablicy
 */
export interface BoardCreate {
  name: string;
  workspace_id: number;
  icon?: string;  // Domyślnie "PenTool"
  bg_color?: string;  // Domyślnie "bg-gray-500"
}

/**
 * Odpowiedź z listą tablic
 */
export interface BoardListResponse {
  boards: Board[];
  total: number;
  limit: number;
  offset: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 📡 API FUNKCJE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 📋 POBIERANIE LISTY TABLIC
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Pobiera tablice z konkretnego workspace
 * 
 * ENDPOINT:
 * GET /api/boards?workspace_id={workspaceId}&limit={limit}&offset={offset}
 * 
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - Użytkownik MUSI mieć dostęp do workspace
 * 
 * PARAMETRY:
 * - workspaceId: ID workspace (number)
 * - limit: Limit wyników (domyślnie 10)
 * - offset: Offset dla paginacji (domyślnie 0)
 * 
 * ZWRACA:
 * BoardListResponse {
 *   boards: Board[],
 *   total: number,
 *   limit: number,
 *   offset: number
 * }
 * 
 * BŁĘDY:
 * - 401: Niezalogowany
 * - 404: Workspace nie istnieje lub brak dostępu
 * 
 * PRZYKŁAD UŻYCIA:
 * const data = await fetchBoards(1, 10, 0);
 * console.log(`Znaleziono ${data.total} tablic`);
 */
export const fetchBoards = async (
  workspaceId: number,
  limit: number = 10,
  offset: number = 0
): Promise<BoardListResponse> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Musisz być zalogowany żeby pobierać tablice');
  }
  
  const response = await fetch(
    `${API_BASE_URL}/api/boards?workspace_id=${workspaceId}&limit=${limit}&offset=${offset}`,
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
 * ───────────────────────────────────────────────────────────────────────────
 * ➕ TWORZENIE NOWEJ TABLICY
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Tworzy nową tablicę w workspace
 * 
 * ENDPOINT:
 * POST /api/boards
 * 
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - workspace_id MUSI istnieć
 * - Użytkownik MUSI mieć dostęp do workspace
 * 
 * PARAMETRY:
 * - data: BoardCreate {
 *     name: string (1-50 znaków),
 *     workspace_id: number,
 *     icon?: string (domyślnie "PenTool"),
 *     bg_color?: string (domyślnie "bg-gray-500")
 *   }
 * 
 * ZWRACA:
 * Board (pełne dane utworzonej tablicy)
 * 
 * LOGIKA BACKENDU:
 * - Tworzy tablicę w bazie
 * - Automatycznie dodaje twórcę do board_users
 * - Ustawia created_by, owner_id
 * 
 * BŁĘDY:
 * - 401: Niezalogowany
 * - 404: Workspace nie istnieje
 * - 422: Błąd walidacji (np. za długa nazwa)
 * 
 * PRZYKŁAD UŻYCIA:
 * const newBoard = await createBoard({
 *   name: "Moja tablica",
 *   workspace_id: 1,
 *   icon: "PenTool",
 *   bg_color: "bg-blue-500"
 * });
 * console.log(`Utworzono tablicę ID: ${newBoard.id}`);
 */
export const createBoard = async (data: BoardCreate): Promise<Board> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Musisz być zalogowany żeby tworzyć tablice');
  }
  
  const response = await fetch(`${API_BASE_URL}/api/boards`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  return handleResponse(response);
};

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 🗑️ USUWANIE TABLICY
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Usuwa tablicę
 * 
 * ENDPOINT:
 * DELETE /api/boards/{boardId}
 * 
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - Użytkownik MUSI być właścicielem tablicy
 * 
 * PARAMETRY:
 * - boardId: ID tablicy (number)
 * 
 * ZWRACA:
 * void (lub error jeśli się nie udało)
 * 
 * KASKADOWE USUWANIE:
 * Backend automatycznie usuwa:
 * - Wszystkie elementy tablicy (board_elements)
 * - Wszystkie powiązania użytkowników (board_users)
 * 
 * BŁĘDY:
 * - 401: Niezalogowany
 * - 403: Użytkownik nie jest właścicielem
 * - 404: Tablica nie istnieje
 * 
 * PRZYKŁAD UŻYCIA:
 * await deleteBoard(1);
 * console.log('Tablica usunięta!');
 */
export const deleteBoard = async (boardId: number): Promise<void> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Musisz być zalogowany żeby usuwać tablice');
  }
  
  const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`, {
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
 * ⭐ ZMIANA STATUSU ULUBIONEJ
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * Zmienia status ulubionej dla tablicy
 * 
 * ENDPOINT:
 * POST /api/boards/{boardId}/toggle-favourite
 * 
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - Użytkownik MUSI mieć dostęp do tablicy
 * 
 * PARAMETRY:
 * - boardId: ID tablicy (number)
 * - isFavourite: true = ulubiona, false = nie ulubiona (boolean)
 * 
 * ZWRACA:
 * void (lub error jeśli się nie udało)
 * 
 * LOGIKA:
 * Zmienia is_favourite w board_users (każdy użytkownik ma SWÓJ status!)
 * 
 * BŁĘDY:
 * - 401: Niezalogowany
 * - 404: Nie masz dostępu do tablicy
 * 
 * PRZYKŁAD UŻYCIA:
 * await toggleBoardFavourite(1, true);  // Dodaj do ulubionych
 * await toggleBoardFavourite(1, false); // Usuń z ulubionych
 */
export const toggleBoardFavourite = async (
  boardId: number,
  isFavourite: boolean
): Promise<void> => {
  const token = getToken();
  
  if (!token) {
    throw new Error('Musisz być zalogowany');
  }
  
  const response = await fetch(
    `${API_BASE_URL}/api/boards/${boardId}/toggle-favourite`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ is_favourite: isFavourite })
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
 * ✅ fetchBoards(workspaceId, limit, offset) - lista tablic
 * 
 * TWORZENIE:
 * ✅ createBoard(data) - nowa tablica
 * 
 * USUWANIE:
 * ✅ deleteBoard(boardId) - usunięcie tablicy
 * 
 * ZMIANA STATUSU:
 * ✅ toggleBoardFavourite(boardId, isFavourite) - ulubiona
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
