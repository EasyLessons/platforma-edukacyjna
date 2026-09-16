/**
 * Uwierzytelnianie żądań do /api/chat.
 *
 * Czat AI to Route Handler Next.js, a nie endpoint FastAPI, więc nie ma
 * dostępu do `get_current_user`. Zamiast kopiować tu sekret JWT i logikę
 * weryfikacji, przekazujemy token do backendu (`GET /api/v1/auth/me`), który
 * sprawdza dokładnie to samo co przy każdym innym chronionym endpoincie:
 * podpis, wygaśnięcie, istnienie usera i `is_active`.
 *
 * Koszt: jedno dodatkowe żądanie na wiadomość. Wobec wywołania Gemini, które
 * trwa sekundy, jest to pomijalne.
 *
 * Zasada: przy każdej niepewności ODMAWIAMY (fail closed). Endpoint woła płatne
 * API — niedostępny backend nie może oznaczać "wpuść wszystkich".
 */

const AUTH_CHECK_TIMEOUT_MS = 5_000;

/**
 * Adres backendu widziany z SERWERA Next.js, nie z przeglądarki.
 *
 * W docker-compose NEXT_PUBLIC_API_URL to http://localhost:8000 — poprawne dla
 * przeglądarki, ale z wnętrza kontenera frontendu "localhost" to sam kontener.
 * Stąd osobna, serwerowa zmienna BACKEND_INTERNAL_URL (w compose:
 * http://backend:8000). Na Vercelu nie jest potrzebna — tam publiczny adres
 * backendu jest osiągalny także z serwera.
 */
export function getBackendUrl(): string {
  return (
    process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  );
}

export type ChatAuthResult =
  | { ok: true; userId: number | null }
  | { ok: false; status: 401 | 503; error: 'unauthorized' | 'auth_unavailable' };

export async function authenticateChatRequest(
  authorizationHeader: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<ChatAuthResult> {
  const match = authorizationHeader?.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }

  let response: Response;
  try {
    response = await fetchImpl(`${getBackendUrl()}/api/v1/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${match[1]}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(AUTH_CHECK_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, status: 503, error: 'auth_unavailable' };
  }

  // 401 — zły/wygasły token, 403 — konto niezweryfikowane, 404 — user usunięty.
  // Dla wołającego to wszystko znaczy to samo: nie masz prawa do czatu.
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }

  if (!response.ok) {
    return { ok: false, status: 503, error: 'auth_unavailable' };
  }

  // userId przyda się przy limitach per user (docs/plan-subskrypcje.md).
  // Brak go w odpowiedzi nie jest powodem do odmowy — backend już potwierdził token.
  try {
    const body = await response.json();
    const id = body?.data?.user?.id;
    return { ok: true, userId: typeof id === 'number' ? id : null };
  } catch {
    return { ok: true, userId: null };
  }
}
