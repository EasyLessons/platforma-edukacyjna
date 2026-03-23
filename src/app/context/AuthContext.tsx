/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║                          AUTH CONTEXT                                      ║
 * ║                    "Mózg Logowania" Aplikacji                              ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 *
 * 🎯 CEL:
 * Ten plik zarządza stanem logowania w całej aplikacji. Jest jak "recepcjonista"
 * który pamięta kto jest zalogowany i informuje wszystkie komponenty o zmianach.
 *
 * 🔑 GŁÓWNE FUNKCJE:
 * - Sprawdza przy starcie aplikacji czy użytkownik jest zalogowany
 * - Przechowuje informacje o zalogowanym użytkowniku
 * - Udostępnia funkcje login() i logout() dla całej aplikacji
 * - Reaguje automatycznie na zmiany stanu logowania
 *
 * 📦 UŻYWANE W:
 * - layout.tsx → pokazuje właściwy header (Header vs AuthHeader)
 * - login/page.tsx → wywołuje login() po pomyślnym logowaniu
 * - AuthHeader.tsx → wywołuje logout() i pokazuje dane użytkownika
 *
 * 🔄 JAK TO DZIAŁA?
 * 1. Aplikacja się uruchamia
 * 2. AuthProvider sprawdza localStorage (czy jest token?)
 * 3. Jeśli jest token → użytkownik ZALOGOWANY
 * 4. Jeśli brak tokena → użytkownik NIEZALOGOWANY
 * 5. Wszystkie komponenty mogą odczytać stan przez useAuth()
 */

'use client';
// ☝️ To mówi Next.js: "Ten kod działa w PRZEGLĄDARCE, nie na serwerze"
// Potrzebne bo używamy useState, useEffect i localStorage (które są tylko w przeglądarce)

// ═══════════════════════════════════════════════════════════════════════════
// 📥 IMPORTY
// ═══════════════════════════════════════════════════════════════════════════

import {
  createContext, // Tworzy "pudełko" które może przechowywać dane
  useContext, // Pozwala "otworzyć pudełko" i przeczytać dane
  useState, // Tworzy zmienną która może się zmieniać (reaktywną)
  useEffect, // Wykonuje kod gdy coś się zmienia lub przy starcie
  ReactNode, // Typ TypeScript dla komponentów React
} from 'react';

// Importujemy funkcje do zarządzania tokenem i danymi użytkownika
// Te funkcje są zdefiniowane w api.ts i operują na localStorage
import {
  getAccessToken as getToken,
  setAccessToken as saveToken,
  removeAccessToken as removeToken,
  getStoredUser as getUser,
  setStoredUser as saveUser,
  removeStoredUser as removeUser,
} from '@/_new/lib/auth';
import type { User } from '@/_new/shared/types/user';

// ═══════════════════════════════════════════════════════════════════════════
// 📝 DEFINICJA TYPÓW
// ═══════════════════════════════════════════════════════════════════════════

/**
 * AuthContextType - Definicja danych które będą dostępne w Context
 *
 * To jest jak "menu" w restauracji - opisuje co możesz zamówić (jakie dane możesz pobrać)
 */
interface AuthContextType {
  isLoggedIn: boolean;
  // ☝️ Czy użytkownik jest zalogowany? true = TAK, false = NIE
  // Przykład: if (isLoggedIn) { pokazAuthHeader() } else { pokazHeader() }

  user: User | null;
  // ☝️ Dane zalogowanego użytkownika (email, username, itp.) lub null jeśli niezalogowany
  // Przykład: user.username → "Mati"

  loading: boolean;
  // ☝️ Czy właśnie sprawdzamy stan logowania? true = sprawdzamy, false = gotowe
  // Używane żeby pokazać "Ładowanie..." zamiast migania między headerami

  login: (token: string, userData: User) => void;
  // ☝️ Funkcja do ZALOGOWANIA użytkownika
  // Wywołujesz ją po pomyślnym logowaniu: login(token, userData)
  // Zapisuje token i dane użytkownika, zmienia isLoggedIn na true

  logout: () => void;
  // ☝️ Funkcja do WYLOGOWANIA użytkownika
  // Wywołujesz ją gdy użytkownik klika "Wyloguj": logout()
  // Usuwa token i dane użytkownika, zmienia isLoggedIn na false
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎁 STWORZENIE CONTEXT (PUDEŁKA)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * AuthContext - "Pudełko" które będzie przechowywać dane o logowaniu
 *
 * Na początku jest undefined (puste), bo dane pojawią się dopiero w AuthProvider
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════
// 📦 AUTHPROVIDER - Komponent który "trzyma" dane
// ═══════════════════════════════════════════════════════════════════════════

/**
 * AuthProvider - To jest jak "menedżer" który zarządza stanem logowania
 *
 * ROLA: Opakowuje całą aplikację i udostępnia dane o logowaniu wszystkim komponentom
 *
 * UŻYCIE:
 * W layout.tsx opakowujesz aplikację:
 * <AuthProvider>
 *   <LayoutContent />
 * </AuthProvider>
 *
 * @param children - Komponenty które będą miały dostęp do danych z Context
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  // ───────────────────────────────────────────────────────────────────────
  // 📊 STANY (zmienne które mogą się zmieniać)
  // ───────────────────────────────────────────────────────────────────────

  /**
   * isLoggedIn - Czy użytkownik jest zalogowany?
   *
   * Na początku: false (zakładamy że niezalogowany)
   * Po sprawdzeniu tokena: true lub false (w zależności czy token istnieje)
   * Po zalogowaniu: true
   * Po wylogowaniu: false
   */
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  /**
   * user - Dane zalogowanego użytkownika
   *
   * Na początku: null (brak użytkownika)
   * Po sprawdzeniu tokena: obiekt User lub null
   * Po zalogowaniu: obiekt User (z id, username, email, itp.)
   * Po wylogowaniu: null
   *
   * Przykład obiektu User:
   * {
   *   id: 1,
   *   username: "mati",
   *   email: "mati@example.com",
   *   full_name: "Mateusz Kowalski",
   *   is_active: true,
   *   created_at: "2024-01-01T10:00:00"
   * }
   */
  const [user, setUser] = useState<User | null>(null);

  /**
   * loading - Czy właśnie sprawdzamy stan logowania?
   *
   * Na początku: true (sprawdzamy localStorage)
   * Po sprawdzeniu: false (już wiemy czy zalogowany czy nie)
   *
   * Używane do pokazania "Ładowanie..." zamiast migania między headerami
   */
  const [loading, setLoading] = useState(true);

  // ───────────────────────────────────────────────────────────────────────
  // 🔍 SPRAWDZENIE PRZY STARCIE APLIKACJI
  // ───────────────────────────────────────────────────────────────────────

  /**
   * useEffect - Kod który wykonuje się JEDEN RAZ przy starcie aplikacji
   *
   * KIEDY SIĘ WYKONUJE?
   * - Gdy aplikacja się ładuje po raz pierwszy
   * - Gdy użytkownik odświeża stronę (F5)
   *
   * CO ROBI?
   * 1. Sprawdza czy w localStorage jest token
   * 2. Sprawdza czy w localStorage są dane użytkownika
   * 3. Jeśli OBA są → użytkownik ZALOGOWANY
   * 4. Jeśli któregoś brak → użytkownik NIEZALOGOWANY
   * 5. Kończy "ładowanie"
   *
   * [] na końcu = "wykonaj TYLKO RAZ przy starcie"
   */
  useEffect(() => {
    console.log('🔍 AuthContext: Sprawdzam localStorage przy starcie...');
    
    // Krok 1: Pobierz token z localStorage
    // getToken() zwraca token (string) lub null jeśli go nie ma
    const token = getToken();

    // Krok 2: Pobierz dane użytkownika z localStorage
    // getUser() zwraca obiekt User lub null jeśli go nie ma
    const userData = getUser();

    console.log('🔍 AuthContext: token:', token ? '✅ Jest' : '❌ Brak');
    console.log('🔍 AuthContext: userData:', userData ? '✅ Jest' : '❌ Brak');
    if (userData) {
      console.log('👤 AuthContext: userData =', userData);
    }

    // Krok 3: Sprawdź czy OBA istnieją
    if (token && userData) {
      // ✅ JEST TOKEN i DANE → Użytkownik ZALOGOWANY

      // Ustaw isLoggedIn na true (aplikacja wie że zalogowany)
      setIsLoggedIn(true);

      // Zapisz dane użytkownika do stanu (żeby komponenty mogły je odczytać)
      setUser(userData);

      console.log('✅ AuthContext: Użytkownik ZALOGOWANY:', userData.username);
    } else {
      // ❌ BRAK TOKENA lub DANYCH → Użytkownik NIEZALOGOWANY

      // Ustaw isLoggedIn na false
      setIsLoggedIn(false);

      // Ustaw user na null (brak użytkownika)
      setUser(null);

      console.log('❌ AuthContext: Użytkownik NIEZALOGOWANY');
    }

    // Krok 4: Zakończ ładowanie (przestań pokazywać "Ładowanie...")
    setLoading(false);
  }, []);
  // ☝️ [] = "wykonaj ten kod TYLKO RAZ przy starcie aplikacji"
  // Gdyby tu było [isLoggedIn], wykonywałby się za każdym razem gdy isLoggedIn się zmienia

  // ───────────────────────────────────────────────────────────────────────
  // 🔐 FUNKCJA LOGOWANIA
  // ───────────────────────────────────────────────────────────────────────

  /**
   * login - Funkcja do zalogowania użytkownika
   *
   * KIEDY UŻYWAĆ?
   * Po pomyślnym logowaniu w login/page.tsx:
   *
   * const response = await loginUser({ login, password });
   * login(response.access_token, response.user); ← TU!
   *
   * CO ROBI?
   * 1. Zapisuje token do localStorage (i cookies)
   * 2. Zapisuje dane użytkownika do localStorage
   * 3. Zmienia isLoggedIn na true
   * 4. Zapisuje dane użytkownika do stanu
   * 5. Layout.tsx automatycznie reaguje i pokazuje AuthHeader!
   *
   * @param token - Token JWT z backendu (string)
   * @param userData - Dane użytkownika z backendu (obiekt User)
   */
  const login = (token: string, userData: User) => {
    // Krok 1: Zapisz token do localStorage (funkcja z api.ts)
    // saveToken() zapisuje też do cookies dla middleware
    saveToken(token);

    // Krok 2: Zapisz dane użytkownika do localStorage (funkcja z api.ts)
    // Zamienia obiekt na JSON i zapisuje
    saveUser(userData);

    // Krok 3: Zmień stan na "zalogowany"
    setIsLoggedIn(true);

    // Krok 4: Zapisz dane użytkownika do stanu (żeby komponenty mogły je odczytać)
    setUser(userData);

    // 📝 Możesz odkomentować:
    // console.log('🔐 Zalogowano użytkownika:', userData.username);
  };

  // ───────────────────────────────────────────────────────────────────────
  // 🚪 FUNKCJA WYLOGOWANIA
  // ───────────────────────────────────────────────────────────────────────

  /**
   * logout - Funkcja do wylogowania użytkownika
   *
   * KIEDY UŻYWAĆ?
   * Gdy użytkownik klika "Wyloguj" w AuthHeader.tsx:
   *
   * const handleLogout = () => {
   *   logout(); ← TU!
   *   router.push('/');
   * };
   *
   * CO ROBI?
   * 1. Usuwa token z localStorage (i cookies)
   * 2. Usuwa dane użytkownika z localStorage
   * 3. Zmienia isLoggedIn na false
   * 4. Ustawia user na null
   * 5. Layout.tsx automatycznie reaguje i pokazuje Header!
   */
  const logout = () => {
    // Krok 1: Usuń token z localStorage (funkcja z api.ts)
    // removeToken() usuwa też z cookies
    removeToken();

    // Krok 2: Usuń dane użytkownika z localStorage (funkcja z api.ts)
    removeUser();

    // Krok 3: Zmień stan na "wylogowany"
    setIsLoggedIn(false);

    // Krok 4: Wyczyść dane użytkownika
    setUser(null);

    // 📝 Możesz odkomentować:
    // console.log('🚪 Wylogowano użytkownika');
  };

  // ───────────────────────────────────────────────────────────────────────
  // 📤 UDOSTĘPNIENIE DANYCH (PROVIDER)
  // ───────────────────────────────────────────────────────────────────────

  /**
   * AuthContext.Provider - "Nadajnik" który rozgłasza dane do wszystkich komponentów
   *
   * value={{ ... }} - To są dane które będą dostępne w całej aplikacji:
   * - isLoggedIn → czy zalogowany?
   * - user → dane użytkownika
   * - loading → czy sprawdzamy stan?
   * - login → funkcja do logowania
   * - logout → funkcja do wylogowania
   *
   * {children} - Wszystkie komponenty które są "owinięte" w AuthProvider
   */
  return (
    <AuthContext.Provider value={{ isLoggedIn, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🪝 HOOK DO UŻYWANIA CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * useAuth - Hook który pozwala "otworzyć pudełko" i odczytać dane
 *
 * UŻYCIE:
 * W dowolnym komponencie:
 *
 * import { useAuth } from '../context/AuthContext';
 *
 * function MojKomponent() {
 *   const { isLoggedIn, user, login, logout } = useAuth();
 *
 *   if (isLoggedIn) {
 *     return <div>Witaj {user.username}!</div>;
 *   }
 *
 *   return <div>Nie jesteś zalogowany</div>;
 * }
 *
 * OCHRONA PRZED BŁĘDAMI:
 * Jeśli użyjesz useAuth() poza AuthProvider, dostaniesz czytelny błąd
 */
export function useAuth() {
  // Próbuj odczytać Context
  const context = useContext(AuthContext);

  // Jeśli Context jest undefined = nie jesteś w AuthProvider!
  if (!context) {
    throw new Error(
      '❌ useAuth musi być użyty wewnątrz AuthProvider! ' +
        'Upewnij się że Twój komponent jest owinięty w <AuthProvider>...</AuthProvider>'
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
 * import { AuthProvider } from './context/AuthContext';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <AuthProvider>
 *       <LayoutContent>{children}</LayoutContent>
 *     </AuthProvider>
 *   );
 * }
 *
 * ───────────────────────────────────────────────────────────────────────────
 *
 * 2. SPRAWDZENIE CZY ZALOGOWANY (layout.tsx):
 *
 * import { useAuth } from './context/AuthContext';
 *
 * function LayoutContent({ children }) {
 *   const { isLoggedIn, loading } = useAuth();
 *
 *   if (loading) return <div>Ładowanie...</div>;
 *
 *   return (
 *     <>
 *       {isLoggedIn ? <AuthHeader /> : <Header />}
 *       {children}
 *     </>
 *   );
 * }
 *
 * ───────────────────────────────────────────────────────────────────────────
 *
 * 3. LOGOWANIE (login/page.tsx):
 *
 * import { useAuth } from '../context/AuthContext';
 * import { loginUser } from '../../auth_api/api';
 *
 * function LoginPage() {
 *   const { login } = useAuth();
 *
 *   const handleSubmit = async (e) => {
 *     const response = await loginUser({ login, password });
 *     login(response.access_token, response.user); // ← Użyj funkcji login
 *     router.push('/dashboard');
 *   };
 * }
 *
 * ───────────────────────────────────────────────────────────────────────────
 *
 * 4. WYLOGOWANIE (AuthHeader.tsx):
 *
 * import { useAuth } from '../context/AuthContext';
 *
 * function AuthHeader() {
 *   const { logout, user } = useAuth();
 *
 *   const handleLogout = () => {
 *     logout(); // ← Użyj funkcji logout
 *     router.push('/');
 *   };
 *
 *   return (
 *     <header>
 *       <span>Witaj, {user.username}!</span>
 *       <button onClick={handleLogout}>Wyloguj</button>
 *     </header>
 *   );
 * }
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
