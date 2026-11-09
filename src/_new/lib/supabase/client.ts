/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        SUPABASE CLIENT
 *                  Konfiguracja połączenia z Supabase
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🎯 CEL:
 * Ten plik tworzy klienta Supabase (Realtime API). Treść tablicy NIE idzie tędy
 * (Yjs + whiteboard-sync, board-engine/yjs) - Supabase zostało dla powiadomień
 * i zmian ról (postgres_changes na workspace_members w stronie tablicy).
 *
 * 🔑 KLUCZE:
 * - NEXT_PUBLIC_SUPABASE_URL → URL projektu Supabase
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY → Publiczny klucz (bezpieczny dla frontendu)
 */

import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 KONFIGURACJA
// ═══════════════════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ⚠️ WALIDACJA: Sprawdź czy zmienne środowiskowe są ustawione
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '❌ Brak zmiennych środowiskowych Supabase!\n' +
      'Ustaw NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_ANON_KEY w pliku .env.local'
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 🚀 KLIENT SUPABASE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Główny klient Supabase - używany w całej aplikacji
 *
 * FUNKCJE:
 * - Realtime channels → synchronizacja na żywo
 * - Broadcast → wysyłanie wiadomości do innych użytkowników
 * - Presence → kto jest online
 *
 * BEZPIECZEŃSTWO:
 * - Używamy `anon key` (publiczny) - bezpieczny dla frontendu
 * - Supabase automatycznie weryfikuje uprawnienia przez RLS (Row Level Security)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 100, // Zwiększone dla płynnego rysowania (domyślnie 10)
    },
    // 🛡️ Konfiguracja dla stabilności - NIE zmieniaj heartbeat (domyślny 30s jest OK)
    // heartbeatIntervalMs jest wewnętrzny - nie nadpisujemy
    reconnectAfterMs: (tries: number) => {
      // Szybki reconnect: 500ms, 1s, 2s, 4s, max 10s
      return Math.min(500 * Math.pow(2, tries), 10000);
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'easylesson-web',
    },
  },
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 PRZYKŁADY UŻYCIA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. TWORZENIE KANAŁU:
 *
 * const channel = supabase.channel('board:123')
 *
 * ───────────────────────────────────────────────────────────────────────────
 *
 * 2. WYSYŁANIE WIADOMOŚCI:
 *
 * await channel.send({
 *   type: 'broadcast',
 *   event: 'element-created',
 *   payload: { element: newElement }
 * })
 *
 * ───────────────────────────────────────────────────────────────────────────
 *
 * 3. ODBIERANIE WIADOMOŚCI:
 *
 * channel.on('broadcast', { event: 'element-created' }, (payload) => {
 *   console.log('Nowy element:', payload.element)
 * })
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
