/**
 * status-indicators.tsx
 *
 * Trzy małe badge'e w prawym górnym/dolnym rogu informujące o stanie zapisu i połączenia.
 *
 * Co każdy badge robi:
 *  - SavingIndicator (zielony, spinner) — pojawia się gdy trwa zapis do bazy danych.
 *    Zapis jest debounced (2 sekundy opóźnienia po ostatniej zmianie), więc ten badge
 *    mignie tylko na chwilę po każdej serii rysowania.
 *  - UnsavedIndicator (żółty) — liczy elementy które zostały zmienione ale jeszcze
 *    nie zapisane (czekają na debounce). Informuje użytkownika że nie powinien zamykać
 *    zakładki zanim nie zniknie.
 *  - ConnectionIndicator (żółty, puls) — pojawia się w prawym DOLNYM rogu gdy WebSocket
 *    Supabase Realtime się rozłączy. Supabase automatycznie próbuje reconnect.
 *
 * Wydzielono z: WhiteboardCanvas.tsx linie 4075–4108 (był inline JSX w return).
 */

// ─── Typy ────────────────────────────────────────────────────────────────────

interface StatusIndicatorsProps {
  isSaving: boolean;
  unsavedCount: number;
  isConnected: boolean;
}

// ─── Komponent ───────────────────────────────────────────────────────────────

export function StatusIndicators({ isSaving, unsavedCount, isConnected }: StatusIndicatorsProps) {
  return (
    <>
      {/* Zapis w toku */}
      {isSaving && (
        <div className="absolute top-20 right-4 bg-green-100 text-green-700 px-4 py-2 rounded-lg shadow-md flex items-center gap-2 z-50">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600" />
          <span className="text-sm font-medium">Zapisywanie...</span>
        </div>
      )}

      {/* Niezapisane zmiany — widoczne tylko gdy nie trwa właśnie zapis */}
      {unsavedCount > 0 && !isSaving && (
        <div className="absolute top-20 right-4 bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg shadow-md flex items-center gap-2 z-50">
          <span className="text-sm font-medium">Niezapisane zmiany: {unsavedCount}</span>
        </div>
      )}

      {/* Brak połączenia z Supabase Realtime */}
      {!isConnected && (
        <div className="absolute bottom-4 right-4 bg-yellow-100 border border-yellow-400 rounded-lg px-3 py-2 shadow-lg z-50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-sm text-yellow-800">Reconnecting...</span>
          </div>
        </div>
      )}
    </>
  );
}
