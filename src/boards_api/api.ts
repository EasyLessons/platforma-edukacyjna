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
  settings?: {
    ai_enabled: boolean;
    grid_visible: boolean;
    smartsearch_visible: boolean;
    toolbar_visible: boolean;
  } | null;
  last_modified: string; // ISO 8601 string
  last_modified_by: string | null;
  last_opened: string | null; // ISO 8601 string
  created_at: string; // ISO 8601 string
  created_by: string;
}

/**
 * Dane do tworzenia nowej tablicy
 */
export interface BoardCreate {
  name: string;
  workspace_id: number;
  icon?: string; // Domyślnie "PenTool"
  bg_color?: string; // Domyślnie "bg-gray-500"
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

/**
 * Użytkownik online na tablicy
 */
export interface OnlineUser {
  user_id: number;
  username: string;
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
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
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
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
};

/**
 * ───────────────────────────────────────────────────────────────────────────
 * � POBIERANIE POJEDYNCZEJ TABLICY
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Pobiera szczegóły pojedynczej tablicy po ID
 *
 * ENDPOINT:
 * GET /api/boards/{boardId}
 *
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany (opcjonalne dla demo-board)
 *
 * PARAMETRY:
 * - boardId: ID tablicy (number) lub "demo-board"
 *
 * ZWRACA:
 * Board (pełne dane tablicy) lub null jeśli nie znaleziono
 *
 * PRZYKŁAD UŻYCIA:
 * const board = await fetchBoardById(1);
 * console.log(`Nazwa tablicy: ${board?.name}`);
 */
export const fetchBoardById = async (boardId: string | number): Promise<Board | null> => {
  // Demo board - zwróć mock data
  if (boardId === 'demo-board') {
    return {
      id: 0,
      name: 'Demo Tablica',
      icon: 'PenTool',
      bg_color: 'bg-blue-500',
      workspace_id: 0,
      owner_id: 0,
      owner_username: 'Demo',
      is_favourite: false,
      last_modified: new Date().toISOString(),
      last_modified_by: null,
      last_opened: new Date().toISOString(),
      created_at: new Date().toISOString(),
      created_by: 'Demo',
    };
  }

  const token = getToken();

  if (!token) {
    console.warn('Brak tokenu - nie można pobrać tablicy');
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      // Dodaj timeout — Neon DB (free tier) potrzebuje ~20s na cold start, retry logic ~3s extra
      signal: AbortSignal.timeout(60000), // 60s timeout
    });

    if (!response.ok) {
      console.warn(`❌ Board fetch failed with status ${response.status}`);
      return null;
    }

    return handleResponse(response);
  } catch (error) {
    // Loguj dokładniejszy błąd
    if (error instanceof Error) {
      console.error('❌ Error fetching board:', error.message);
      if (error.name === 'AbortError') {
        console.error('⏱️ Request timed out after 10s');
      }
    } else {
      console.error('❌ Error fetching board:', error);
    }
    return null;
  }
};

/**
 * ───────────────────────────────────────────────────────────────────────────
 * �🗑️ USUWANIE TABLICY
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
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
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

  const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}/toggle-favourite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ is_favourite: isFavourite }),
  });

  return handleResponse(response);
};

/**
 * Dane do aktualizacji tablicy (wszystkie opcjonalne)
 */
export interface BoardUpdate {
  name?: string;
  icon?: string;
  bg_color?: string;
}

/**
 * ───────────────────────────────────────────────────────────────────────────
 * ✏️ AKTUALIZACJA TABLICY
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Aktualizuje dane tablicy (nazwę, ikonę, kolor)
 *
 * ENDPOINT:
 * PUT /api/boards/{boardId}
 *
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - Użytkownik MUSI być właścicielem tablicy
 *
 * PARAMETRY:
 * - boardId: ID tablicy (number)
 * - data: BoardUpdate {
 *     name?: string (1-50 znaków),
 *     icon?: string (nazwa ikony),
 *     bg_color?: string (kolor tła)
 *   }
 *
 * ZWRACA:
 * Board (pełne dane zaktualizowanej tablicy)
 *
 * BŁĘDY:
 * - 401: Niezalogowany
 * - 403: Użytkownik nie jest właścicielem
 * - 404: Tablica nie istnieje
 * - 422: Błąd walidacji
 *
 * PRZYKŁAD UŻYCIA:
 * const updated = await updateBoard(1, { name: "Nowa nazwa" });
 * console.log(`Zaktualizowano: ${updated.name}`);
 */
export const updateBoard = async (boardId: number, data: BoardUpdate): Promise<Board> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany żeby aktualizować tablice');
  }

  const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return handleResponse(response);
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 BOARD ELEMENTS - Zapisywanie i ładowanie rysunków
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Element tablicy (rysunek, kształt, tekst, obraz)
 *
 * STRUKTURA:
 * - element_id: UUID z frontendu (unikalny ID elementu)
 * - type: Typ elementu ("path", "rect", "text", "image", etc.)
 * - data: Pełne dane elementu (cały obiekt DrawingElement)
 */
export interface BoardElement {
  element_id: string;
  type: string;
  data: any;
}

/**
 * Element tablicy z informacją o autorze (z API GET /elements)
 */
export interface BoardElementWithAuthor extends BoardElement {
  created_by_id: number | null;
  created_by_username: string | null;
  created_at: string | null;
}

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 💾 ZAPIS BATCH - Zapisz wiele elementów naraz
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Zapisuje wiele elementów w 1 request (optymalizacja)
 *
 * ENDPOINT:
 * POST /api/boards/{boardId}/elements/batch
 *
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - Użytkownik MUSI mieć dostęp do tablicy (workspace member)
 * - Lista elementów NIE może być pusta
 * - Maksymalnie 100 elementów w batch
 *
 * PARAMETRY:
 * - boardId: ID tablicy (number)
 * - elements: Lista elementów BoardElement[]
 *
 * ZWRACA:
 * {
 *   success: boolean,
 *   saved: number (ilość zapisanych)
 * }
 *
 * LOGIKA BACKENDU:
 * - Jeśli element_id istnieje → UPDATE
 * - Jeśli element_id nowy → INSERT
 * - Używa transakcji (commit na końcu)
 *
 * BŁĘDY:
 * - 400: Lista pusta lub > 100 elementów
 * - 401: Niezalogowany
 * - 403: Brak dostępu do tablicy
 * - 404: Tablica nie istnieje
 *
 * PRZYKŁAD UŻYCIA:
 * const elements = [
 *   {
 *     element_id: "uuid-123",
 *     type: "path",
 *     data: { id: "uuid-123", type: "path", points: [...], color: "#000" }
 *   }
 * ];
 * const result = await saveBoardElementsBatch(1, elements);
 * console.log(`Zapisano ${result.saved} elementów`);
 */
export const saveBoardElementsBatch = async (
  boardId: number,
  elements: BoardElement[]
): Promise<{ success: boolean; saved: number }> => {
  const token = getToken();
  if (!token) throw new Error('Brak autoryzacji');

  const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}/elements/batch`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(elements),
  });

  return handleResponse(response);
};

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 📥 ŁADOWANIE - Załaduj wszystkie elementy tablicy
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Pobiera wszystkie elementy z bazy danych
 *
 * ENDPOINT:
 * GET /api/boards/{boardId}/elements
 *
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - Użytkownik MUSI mieć dostęp do tablicy
 *
 * PARAMETRY:
 * - boardId: ID tablicy (number)
 *
 * ZWRACA:
 * {
 *   elements: BoardElementWithAuthor[]
 * }
 *
 * FILTROWANIE:
 * - Backend zwraca tylko is_deleted == False
 * - Sortowanie po created_at ASC (najstarsze pierwsze)
 *
 * BŁĘDY:
 * - 401: Niezalogowany
 * - 403: Brak dostępu
 * - 404: Tablica nie istnieje
 *
 * PRZYKŁAD UŻYCIA:
 * const data = await loadBoardElements(1);
 * const elements = data.elements.map(e => e.data);
 * setElements(elements);
 */
export const loadBoardElements = async (
  boardId: number
): Promise<{ elements: BoardElementWithAuthor[] }> => {
  const token = getToken();
  if (!token) throw new Error('Brak autoryzacji');

  const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}/elements`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(60000), // 60s timeout — Neon DB cold start może trwać ~20s + backend retry ~3s
  });

  return handleResponse(response);
};

/**
 * ───────────────────────────────────────────────────────────────────────────
 * 🗑️ USUWANIE - Usuń element (soft delete)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Usuwa element (ustawia is_deleted = True)
 *
 * ENDPOINT:
 * DELETE /api/boards/{boardId}/elements/{elementId}
 *
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - Użytkownik MUSI mieć dostęp do tablicy
 *
 * PARAMETRY:
 * - boardId: ID tablicy (number)
 * - elementId: UUID elementu (string)
 *
 * ZWRACA:
 * {
 *   success: boolean
 * }
 *
 * LOGIKA:
 * - Soft delete (is_deleted = True)
 * - Element fizycznie pozostaje w bazie
 * - GET /elements nie zwróci usuniętych
 *
 * BŁĘDY:
 * - 401: Niezalogowany
 * - 403: Brak dostępu
 * - 404: Element nie znaleziony
 *
 * PRZYKŁAD UŻYCIA:
 * await deleteBoardElement(1, "uuid-123");
 * console.log('Element usunięty');
 */
export const deleteBoardElement = async (
  boardId: number,
  elementId: string
): Promise<{ success: boolean }> => {
  const token = getToken();
  if (!token) throw new Error('Brak autoryzacji');

  const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}/elements/${elementId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse(response);
};

/**
 * ───────────────────────────────────────────────────────────────────────────
 * � POBIERANIE UŻYTKOWNIKÓW ONLINE NA TABLICY
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Pobiera listę użytkowników którzy są obecnie online na danej tablicy
 *
 * ENDPOINT:
 * GET /api/boards/{boardId}/online-users?limit={limit}&offset={offset}
 *
 * WYMAGANIA:
 * - Użytkownik MUSI być zalogowany
 * - Użytkownik MUSI mieć dostęp do tablicy
 *
 * PARAMETRY:
 * - boardId: ID tablicy (number)
 * - limit: Limit wyników (domyślnie 50)
 * - offset: Offset dla paginacji (domyślnie 0)
 *
 * ZWRACA:
 * OnlineUser[] - tablica użytkowników z user_id i username
 *
 * PRZYKŁAD UŻYCIA:
 * const users = await fetchBoardOnlineUsers(1);
 * console.log(users); // [{ user_id: 5, username: "mati" }, ...]
 */
export const fetchBoardOnlineUsers = async (
  boardId: number,
  limit: number = 50,
  offset: number = 0
): Promise<OnlineUser[]> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(
    `${API_BASE_URL}/api/boards/${boardId}/online-users?limit=${limit}&offset=${offset}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return handleResponse(response);
};

/**
 * ─────────────────────────────────────────────────────────────────────────── * ✅ OZNACZENIE UŻYTKOWNIKA JAKO ONLINE NA TABLICY
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Wywołaj gdy użytkownik otwiera tablicę
 */
export const markUserOnline = async (boardId: number): Promise<void> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}/online`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse(response);
};

/**
 * ───────────────────────────────────────────────────────────────────────────
 * ❌ OZNACZENIE UŻYTKOWNIKA JAKO OFFLINE NA TABLICY
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Wywołaj gdy użytkownik zamyka tablicę
 */
export const markUserOffline = async (boardId: number): Promise<void> => {
  const token = getToken();

  if (!token) {
    throw new Error('Musisz być zalogowany');
  }

  const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}/online`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse(response);
};

/**
 * ─────────────────────────────────────────────────────────────────────────── * �🔗 DOŁĄCZENIE DO WORKSPACE PRZEZ TABLICĘ
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Automatyczne dołączenie do workspace przez link do tablicy.
 * Jeśli użytkownik nie jest członkiem - zostaje dodany jako member.
 */
export const joinBoardWorkspace = async (
  boardId: number
): Promise<{
  success: boolean;
  already_member: boolean;
  workspace_id: number;
  board_id: number;
  owner_id?: number;
  is_owner?: boolean;
  user_role?: string;
  message?: string;
}> => {
  const token = getToken();

  if (!token) {
    throw new Error('Brak tokenu autoryzacji');
  }

  const response = await fetch(`${API_BASE_URL}/api/boards/${boardId}/join`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return handleResponse(response);
};

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 PODSUMOWANIE FUNKCJI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BOARDS:
 * ✅ fetchBoards(workspaceId, limit, offset) - lista tablic
 * ✅ createBoard(data) - nowa tablica
 * ✅ deleteBoard(boardId) - usunięcie tablicy
 * ✅ toggleBoardFavourite(boardId, isFavourite) - ulubiona
 * ✅ fetchBoardOnlineUsers(boardId, limit, offset) - użytkownicy online
 * ✅ joinBoardWorkspace(boardId) - dołączenie do workspace przez tablicę
 *
 * BOARD ELEMENTS:
 * ✅ saveBoardElementsBatch(boardId, elements) - zapis batch
 * ✅ loadBoardElements(boardId) - ładowanie wszystkich
 * ✅ deleteBoardElement(boardId, elementId) - usunięcie
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
