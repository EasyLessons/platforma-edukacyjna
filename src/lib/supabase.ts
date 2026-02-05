/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        SUPABASE CLIENT
 *                  Konfiguracja połączenia z Supabase
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🎯 CEL:
 * Ten plik tworzy klienta Supabase do komunikacji z backendem Supabase.
 * Używany do synchronizacji tablicy w czasie rzeczywistym (Realtime API).
 *
 * 📡 UŻYWANE W:
 * - BoardRealtimeContext.tsx → synchronizacja elementów tablicy
 * - WhiteboardCanvas.tsx → realtime updates
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
      eventsPerSecond: 10, // Domyślna wartość - zbyt dużo może powodować niestabilność
    },
    // 🛡️ Dodatkowa konfiguracja dla stabilności
    heartbeatIntervalMs: 25000, // Heartbeat co 25s (domyślnie 30s)
    reconnectAfterMs: (tries: number) => {
      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      return Math.min(1000 * Math.pow(2, tries), 30000);
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
