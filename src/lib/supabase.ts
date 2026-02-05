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

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://shqfitnzlrtpqgabtzgv.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNocWZpdG56bHJ0cHFnYWJ0emd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MTQxMTUsImV4cCI6MjA3ODI5MDExNX0.XxFU28lAjvjig_SzeGsydp_BVvcLTabhfzcK83r_HjI';

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
      eventsPerSecond: 25, // Zwiększono z 10 dla lepszej responsywności
    },
  },
  // 🛡️ Lepsza konfiguracja dla stabilności połączenia
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
