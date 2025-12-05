/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        WORKSPACE CONTEXT
 *                  "Mózg Workspace'ów" Aplikacji
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🎯 CEL:
 * Ten plik zarządza workspace'ami w całej aplikacji. Jest jak "bibliotekarz"
 * który pamięta wszystkie workspace'y użytkownika i informuje komponenty o zmianach.
 * 
 * 🔑 GŁÓWNE FUNKCJE:
 * - Pobiera workspace'y z backendu przy starcie
 * - Przechowuje listę workspace'ów w stanie
 * - Udostępnia funkcje do tworzenia/edycji/usuwania
 * - Automatycznie odświeża listę po zmianach
 * 
 * 📦 UŻYWANE W:
 * - layout.tsx → opakowuje aplikację w WorkspaceProvider
 * - dashboard/page.tsx → wyświetla listę workspace'ów
 * - komponenty → tworzą/edytują/usuwają workspace'y
 * 
 * 🔄 JAK TO DZIAŁA?
 * 1. Aplikacja się uruchamia
 * 2. WorkspaceProvider pobiera workspace'y z backendu
 * 3. Workspace'y zapisane w stanie (workspaces)
 * 4. Komponenty odczytują przez useWorkspaces()
 * 5. Po zmianach (create/update/delete) → automatyczne odświeżenie
 */

'use client';
// ☝️ Ten kod działa w PRZEGLĄDARCE (nie na serwerze)

// ═══════════════════════════════════════════════════════════════════════════
// 📥 IMPORTY
// ═══════════════════════════════════════════════════════════════════════════

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode
} from 'react';

// Importujemy funkcje API i typy
import {
  fetchWorkspaces,
  fetchWorkspaceById,
  createWorkspace as apiCreateWorkspace,
  updateWorkspace as apiUpdateWorkspace,
  deleteWorkspace as apiDeleteWorkspace,
  toggleWorkspaceFavourite as apiToggleFavourite,
  Workspace,
  WorkspaceCreate,
  WorkspaceUpdate
} from '../../workspace_api/api';

// Importujemy AuthContext żeby sprawdzić czy użytkownik zalogowany
import { useAuth } from './AuthContext';


// ═══════════════════════════════════════════════════════════════════════════
// 📝 DEFINICJA TYPÓW
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WorkspaceContextType - Definicja danych dostępnych w Context
 * 
 * To jak "menu" - opisuje co możesz pobrać z Context
 */
interface WorkspaceContextType {
  workspaces: Workspace[];
  // ☝️ Lista wszystkich workspace'ów użytkownika
  // Przykład: [{ id: 1, name: "Praca", ... }, { id: 2, name: "Szkoła", ... }]
  
  activeWorkspace: Workspace | null;
  // ☝️ Aktywny workspace (wybrany przez użytkownika)
  // null = brak wybranego
  
  setActiveWorkspace: (workspace: Workspace | null) => void;
  // ☝️ Funkcja do ustawienia aktywnego workspace'a
  // Przykład: setActiveWorkspace(workspace);
  
  loading: boolean;
  // ☝️ Czy właśnie pobieramy workspace'y z backendu?
  // true = ładowanie, false = gotowe
  
  error: string | null;
  // ☝️ Komunikat błędu (jeśli wystąpił) lub null
  // Przykład: "Nie udało się pobrać workspace'ów"
  
  refreshWorkspaces: () => Promise<void>;
  // ☝️ Funkcja do ODŚWIEŻENIA listy workspace'ów
  // Wywołujesz gdy chcesz pobrać najnowsze dane z backendu
  // Przykład: await refreshWorkspaces();
  
  getWorkspaceById: (id: number) => Promise<Workspace>;
  // ☝️ Funkcja do pobrania JEDNEGO workspace'a
  // Przykład: const workspace = await getWorkspaceById(1);
  
  createWorkspace: (data: WorkspaceCreate) => Promise<Workspace>;
  // ☝️ Funkcja do TWORZENIA nowego workspace'a
  // Przykład: const newWorkspace = await createWorkspace({ name: "Moja Firma" });
  
  updateWorkspace: (id: number, data: WorkspaceUpdate) => Promise<Workspace>;
  // ☝️ Funkcja do AKTUALIZACJI workspace'a
  // Przykład: await updateWorkspace(1, { name: "Zmieniona Nazwa" });
  
  deleteWorkspace: (id: number) => Promise<void>;
  // ☝️ Funkcja do USUWANIA workspace'a
  // Przykład: await deleteWorkspace(1);

  toggleFavourite: (id: number, isFavourite: boolean) => Promise<void>;
}




// ═══════════════════════════════════════════════════════════════════════════
// 🎁 STWORZENIE CONTEXT (PUDEŁKA)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WorkspaceContext - "Pudełko" które przechowuje dane o workspace'ach
 */
const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);


// ═══════════════════════════════════════════════════════════════════════════
// 📦 WORKSPACEPROVIDER - Komponent który "trzyma" dane
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WorkspaceProvider - Manager który zarządza workspace'ami
 * 
 * ROLA: Opakowuje aplikację i udostępnia workspace'y wszystkim komponentom
 * 
 * UŻYCIE:
 * W layout.tsx:
 * <WorkspaceProvider>
 *   <LayoutContent />
 * </WorkspaceProvider>
 * 
 * @param children - Komponenty które będą miały dostęp do workspace'ów
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState(null);
  
  // ───────────────────────────────────────────────────────────────────────
  // 📊 STANY (zmienne które mogą się zmieniać)
  // ───────────────────────────────────────────────────────────────────────
  
  /**
   * workspaces - Lista workspace'ów użytkownika
   * 
   * Na początku: [] (pusta lista)
   * Po pobraniu z backendu: [workspace1, workspace2, ...]
   * 
   * Przykład:
   * [
   *   { id: 1, name: "Praca", icon: "Briefcase", ... },
   *   { id: 2, name: "Szkoła", icon: "BookOpen", ... }
   * ]
   */
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  
  /**
   * activeWorkspace - Aktywny workspace (wybrany przez użytkownika)
   * 
   * Na początku: null (brak wybranego)
   * Po wyborze: { id: 1, name: "Praca", ... }
   */
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  
  /**
   * loading - Czy właśnie pobieramy dane?
   * 
   * Na początku: true (pobieramy)
   * Po pobraniu: false (gotowe)
   * 
   * Używane do pokazania "Ładowanie..." w UI
   */
  const [loading, setLoading] = useState(true);
  
  /**
   * error - Komunikat błędu (jeśli wystąpił)
   * 
   * Na początku: null (brak błędu)
   * Jeśli błąd: "Nie udało się pobrać workspace'ów"
   */
  const [error, setError] = useState<string | null>(null);
  
  /**
   * Pobierz info o zalogowaniu z AuthContext
   */
  const { isLoggedIn } = useAuth();
  
  // ───────────────────────────────────────────────────────────────────────
  // 🔄 FUNKCJA DO POBIERANIA WORKSPACE'ÓW
  // ───────────────────────────────────────────────────────────────────────
  
  /**
   * loadWorkspaces - Pobiera workspace'y z backendu
   * 
   * KIEDY WYWOŁYWANA?
   * - Przy starcie aplikacji (useEffect)
   * - Po zalogowaniu
   * - Po ręcznym odświeżeniu (refreshWorkspaces)
   * 
   * LOGIKA:
   * 1. Ustaw loading = true
   * 2. Wywołaj fetchWorkspaces() z API
   * 3. Zapisz workspace'y do stanu
   * 4. Jeśli błąd → zapisz komunikat błędu
   * 5. Ustaw loading = false
   */
  const loadWorkspaces = async () => {
    try {
      // Rozpocznij ładowanie
      setLoading(true);
      setError(null);  // Wyczyść poprzednie błędy
      
      // Pobierz workspace'y z backendu
      const response = await fetchWorkspaces();
      
      // Zapisz do stanu
      setWorkspaces(response.workspaces);
      
      // 🆕 Jeśli nie ma aktywnego workspace'a, ustaw ulubiony lub pierwszy
      if (!activeWorkspace && response.workspaces.length > 0) {
        const favouriteWorkspace = response.workspaces.find((w: Workspace) => w.is_favourite);
        setActiveWorkspace(favouriteWorkspace || response.workspaces[0]);
      }
      
      // 📝 Możesz odkomentowaC:
      // console.log(`✅ Pobrano ${response.total} workspace'ów`);
      
    } catch (err) {
      // Błąd! Zapisz komunikat
      const errorMessage = err instanceof Error ? err.message : 'Nie udało się pobrać workspace\'ów';
      setError(errorMessage);
      
      // 📝 Możesz odkomentować:
      // console.error('❌ Błąd pobierania workspace\'ów:', errorMessage);
      
    } finally {
      // Zakończ ładowanie (niezależnie czy sukces czy błąd)
      setLoading(false);
    }
  };
  
  // ───────────────────────────────────────────────────────────────────────
  // 🎬 AUTOMATYCZNE POBIERANIE PRZY STARCIE
  // ───────────────────────────────────────────────────────────────────────
  
  /**
   * useEffect - Pobiera workspace'y gdy użytkownik się zaloguje
   * 
   * KIEDY SIĘ WYKONUJE?
   * - Gdy użytkownik się zaloguje (isLoggedIn zmieni się na true)
   * 
   * DLACZEGO?
   * Żeby automatycznie pobrać workspace'y po zalogowaniu
   * 
   * [isLoggedIn] = "wykonaj gdy isLoggedIn się zmieni"
   */
  useEffect(() => {
    if (isLoggedIn) {
      // Użytkownik zalogowany → pobierz workspace'y
      loadWorkspaces();
    } else {
      // Użytkownik NIEzalogowany → wyczyść workspace'y
      setWorkspaces([]);
      setLoading(false);
    }
  }, [isLoggedIn]);
  
  // ───────────────────────────────────────────────────────────────────────
  // 🔄 FUNKCJA DO RĘCZNEGO ODŚWIEŻANIA
  // ───────────────────────────────────────────────────────────────────────
  
  /**
   * refreshWorkspaces - Odśwież listę workspace'ów
   * 
   * KIEDY UŻYWAĆ?
   * Gdy chcesz RĘCZNIE odświeżyć listę (np. po jakiejś operacji)
   * 
   * PRZYKŁAD:
   * await refreshWorkspaces();
   * console.log('Lista odświeżona!');
   */
  const refreshWorkspaces = async () => {
    await loadWorkspaces();
  };
  
  // ───────────────────────────────────────────────────────────────────────
  // 🔍 POBIERANIE JEDNEGO WORKSPACE'A
  // ───────────────────────────────────────────────────────────────────────
  
  /**
   * getWorkspaceById - Pobiera JEDEN konkretny workspace
   * 
   * PARAMETRY:
   * - id: ID workspace'a
   * 
   * ZWRACA:
   * Workspace (obiekt z pełnymi danymi)
   * 
   * PRZYKŁAD:
   * const workspace = await getWorkspaceById(1);
   * console.log(workspace.name); // "Moja Firma"
   */
  const getWorkspaceById = async (id: number): Promise<Workspace> => {
    try {
      return await fetchWorkspaceById(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Nie udało się pobrać workspace\'a';
      throw new Error(errorMessage);
    }
  };
  
  // ───────────────────────────────────────────────────────────────────────
  // ➕ TWORZENIE NOWEGO WORKSPACE'A
  // ───────────────────────────────────────────────────────────────────────
  
  /**
   * createWorkspace - Tworzy NOWY workspace
   * 
   * PARAMETRY:
   * - data: WorkspaceCreate
   *   {
   *     name: "Moja Firma",
   *     icon: "Building",
   *     bg_color: "bg-blue-500"
   *   }
   * 
   * ZWRACA:
   * Utworzony workspace (Workspace)
   * 
   * LOGIKA:
   * 1. Wywołaj API createWorkspace()
   * 2. DODAJ nowy workspace do stanu (aktualizuj listę)
   * 3. Zwróć utworzony workspace
   * 
   * PRZYKŁAD:
   * const newWorkspace = await createWorkspace({
   *   name: "Moja Firma",
   *   icon: "Building"
   * });
   * console.log(`Utworzono: ${newWorkspace.name}`);
   */
  const createWorkspace = async (data: WorkspaceCreate): Promise<Workspace> => {
    try {
      // Wywołaj API
      const newWorkspace = await apiCreateWorkspace(data);
      
      
      await loadWorkspaces();
      
      // 📝 Możesz odkomentować:
      // console.log('✅ Utworzono workspace:', newWorkspace.name);
      
      return newWorkspace;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Nie udało się utworzyć workspace\'a';
      throw new Error(errorMessage);
    }
  };
  
  // ───────────────────────────────────────────────────────────────────────
  // ✏️ AKTUALIZACJA WORKSPACE'A
  // ───────────────────────────────────────────────────────────────────────
  
  /**
   * updateWorkspace - Aktualizuje workspace
   * 
   * PARAMETRY:
   * - id: ID workspace'a
   * - data: WorkspaceUpdate (opcjonalne pola)
   *   {
   *     name?: "Zmieniona Nazwa",
   *     icon?: "Star",
   *     bg_color?: "bg-yellow-500"
   *   }
   * 
   * ZWRACA:
   * Zaktualizowany workspace (Workspace)
   * 
   * LOGIKA:
   * 1. Wywołaj API updateWorkspace()
   * 2. ZAKTUALIZUJ workspace w stanie (zastąp starym nowym)
   * 3. Zwróć zaktualizowany workspace
   * 
   * PRZYKŁAD:
   * const updated = await updateWorkspace(1, {
   *   name: "Zmieniona Nazwa"
   * });
   * console.log(updated.name); // "Zmieniona Nazwa"
   */
  const updateWorkspace = async (id: number, data: WorkspaceUpdate): Promise<Workspace> => {
    try {
      // Wywołaj API
      const updatedWorkspace = await apiUpdateWorkspace(id, data);
      
      // ZAKTUALIZUJ w stanie (zastąp stary nowym)
      setWorkspaces(prev =>
        prev.map(ws => ws.id === id ? updatedWorkspace : ws)
      );
      
      // 📝 Możesz odkomentować:
      // console.log('✅ Zaktualizowano workspace:', updatedWorkspace.name);
      
      return updatedWorkspace;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Nie udało się zaktualizować workspace\'a';
      throw new Error(errorMessage);
    }
  };
  
  // ───────────────────────────────────────────────────────────────────────
  // 🗑️ USUWANIE WORKSPACE'A
  // ───────────────────────────────────────────────────────────────────────
  
  /**
   * deleteWorkspace - Usuwa workspace
   * 
   * PARAMETRY:
   * - id: ID workspace'a
   * 
   * LOGIKA:
   * 1. Wywołaj API deleteWorkspace()
   * 2. USUŃ workspace ze stanu (filtruj listę)
   * 
   * PRZYKŁAD:
   * await deleteWorkspace(1);
   * console.log('Workspace usunięty!');
   */
  const deleteWorkspace = async (id: number): Promise<void> => {
    try {
      // Wywołaj API
      await apiDeleteWorkspace(id);
      
      // USUŃ ze stanu (filtruj - zostaw tylko te które NIE mają tego ID)
      setWorkspaces(prev => prev.filter(ws => ws.id !== id));
      
      // 📝 Możesz odkomentować:
      // console.log('✅ Usunięto workspace');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Nie udało się usunąć workspace\'a';
      throw new Error(errorMessage);
    }
 };

    // ───────────────────────────────────────────────────────────────────────
  // ⭐ TOGGLE FAVOURITE - DODAJ TU (po deleteWorkspace, przed return)
  // ───────────────────────────────────────────────────────────────────────
  
  /**
   * toggleFavourite - Zmienia status ulubionego
   * 
   * PARAMETRY:
   * - id: ID workspace'a
   * - isFavourite: true = dodaj do ulubionych, false = usuń
   * 
   * LOGIKA:
   * 1. Wywołaj API toggleWorkspaceFavourite()
   * 2. ZAKTUALIZUJ workspace w stanie (zmień is_favourite)
   */
  const toggleFavourite = async (id: number, isFavourite: boolean): Promise<void> => {
    try {
      // 🔥 WYWOŁANIE API
      await apiToggleFavourite(id, isFavourite);
      
      // ZAKTUALIZUJ w stanie (z typowaniem)
      setWorkspaces((prev: Workspace[]) =>
        prev.map((ws: Workspace) => 
          ws.id === id ? { ...ws, is_favourite: isFavourite } : ws
        )
      );
      
      // 📝 Możesz odkomentować:
      // console.log(`✅ Zmieniono status ulubionego dla workspace ID: ${id}`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Nie udało się zmienić statusu';
      throw new Error(errorMessage);
    }
  };

  
  
  // ───────────────────────────────────────────────────────────────────────
  // 📤 UDOSTĘPNIENIE DANYCH (PROVIDER)
  // ───────────────────────────────────────────────────────────────────────
  
  /**
   * WorkspaceContext.Provider - "Nadajnik" który rozgłasza dane
   * 
   * value={{ ... }} - Dane dostępne w całej aplikacji:
   * - workspaces → lista workspace'ów
   * - loading → czy ładowanie?
   * - error → komunikat błędu
   * - refreshWorkspaces → odśwież listę
   * - getWorkspaceById → pobierz jeden
   * - createWorkspace → utwórz nowy
   * - updateWorkspace → zaktualizuj
   * - deleteWorkspace → usuń
   */
  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        loading,
        error,
        
        refreshWorkspaces,
        getWorkspaceById,
        createWorkspace,
        updateWorkspace,
        deleteWorkspace,
        toggleFavourite
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// 🪝 HOOK DO UŻYWANIA CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * useWorkspaces - Hook który pozwala "otworzyć pudełko" i odczytać workspace'y
 * 
 * UŻYCIE:
 * W dowolnym komponencie:
 * 
 * import { useWorkspaces } from '../context/WorkspaceContext';
 * 
 * function MojKomponent() {
 *   const { workspaces, loading, createWorkspace } = useWorkspaces();
 *   
 *   if (loading) return <div>Ładowanie...</div>;
 *   
 *   return (
 *     <div>
 *       <h1>Twoje workspace'y:</h1>
 *       {workspaces.map(ws => (
 *         <div key={ws.id}>{ws.name}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * 
 * OCHRONA PRZED BŁĘDAMI:
 * Jeśli użyjesz useWorkspaces() poza WorkspaceProvider, dostaniesz czytelny błąd
 */
export function useWorkspaces() {
  // Próbuj odczytać Context
  const context = useContext(WorkspaceContext);
  
  // Jeśli Context jest undefined = nie jesteś w WorkspaceProvider!
  if (!context) {
    throw new Error(
      '❌ useWorkspaces musi być użyty wewnątrz WorkspaceProvider! ' +
      'Upewnij się że Twój komponent jest owinięty w <WorkspaceProvider>...</WorkspaceProvider>'
    );
  }
  
  // Zwróć dane z Context
  return context;
}




/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 PRZYKŁADY UŻYCIA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 1. OWINIĘCIE APLIKACJI (layout.tsx):
 * 
 * import { WorkspaceProvider } from './context/WorkspaceContext';
 * 
 * export default function RootLayout({ children }) {
 *   return (
 *     <AuthProvider>
 *       <WorkspaceProvider>
 *         <LayoutContent>{children}</LayoutContent>
 *       </WorkspaceProvider>
 *     </AuthProvider>
 *   );
 * }
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * 2. WYŚWIETLANIE LISTY (dashboard/page.tsx):
 * 
 * import { useWorkspaces } from '../context/WorkspaceContext';
 * 
 * function Dashboard() {
 *   const { workspaces, loading, error } = useWorkspaces();
 *   
 *   if (loading) return <div>Ładowanie workspace'ów...</div>;
 *   if (error) return <div>Błąd: {error}</div>;
 *   
 *   return (
 *     <div>
 *       <h1>Twoje workspace'y ({workspaces.length})</h1>
 *       {workspaces.map(workspace => (
 *         <div key={workspace.id}>
 *           <h2>{workspace.name}</h2>
 *           <p>Członków: {workspace.member_count}</p>
 *           <p>Tablic: {workspace.board_count}</p>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * 3. TWORZENIE WORKSPACE'A (CreateWorkspaceButton.tsx):
 * 
 * import { useWorkspaces } from '../context/WorkspaceContext';
 * 
 * function CreateWorkspaceButton() {
 *   const { createWorkspace } = useWorkspaces();
 *   
 *   const handleCreate = async () => {
 *     try {
 *       const newWorkspace = await createWorkspace({
 *         name: "Moja Firma",
 *         icon: "Building",
 *         bg_color: "bg-blue-500"
 *       });
 *       console.log(`Utworzono: ${newWorkspace.name}`);
 *     } catch (error) {
 *       console.error('Błąd:', error);
 *     }
 *   };
 *   
 *   return <button onClick={handleCreate}>Utwórz Workspace</button>;
 * }
 * 
 * ───────────────────────────────────────────────────────────────────────────
 * 
 * 4. EDYCJA WORKSPACE'A:
 * 
 * import { useWorkspaces } from '../context/WorkspaceContext';
 * 
 * function EditWorkspaceButton({ workspaceId }) {
 *   const { updateWorkspace } = useWorkspaces();
 *   
 *   const handleUpdate = async () => {
 *     try {
 *       await updateWorkspace(workspaceId, {
 *         name: "Zmieniona Nazwa"
 *       });
 *       console.log('Zaktualizowano!');
 *     } catch (error) {
 *       console.error('Błąd:', error);
 *     }
 *   };
 *   
 *   return <button onClick={handleUpdate}>Zmień Nazwę</button>;
 * }
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */