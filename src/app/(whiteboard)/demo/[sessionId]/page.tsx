/**
 * ============================================================================
 * /demo/[sessionId] - tablica demo bez zakladania konta
 * ============================================================================
 *
 * Osobna trasa zamiast doklejania do /whiteboard?boardId=, bo:
 *  (a) middleware.ts ma matcher tylko na /dashboard/* i /whiteboard/*, wiec
 *      /demo/* przechodzi bez cookie i bez zmian w middleware,
 *  (b) link do wyslania jest czysty: easylesson.app/demo/<id>,
 *  (c) zero ryzyka, ze prawdziwa tablica dostanie boardId w formacie demo.
 *
 * VoiceChatProvider jest tu SWIADOMIE pominiety - WhiteboardCanvas dziala bez
 * niego (useVoiceChat() zwraca null poza providerem, a konsumenci uzywaja
 * `voiceChat?.`), a WebRTC to koszt i 1484 linie legacy, ktorych demo nie
 * potrzebuje.
 *
 * Zapisu do bazy nie ma: boardId to string `demo-...`, wiec kazde parseInt
 * daje NaN i warstwa REST wychodzi wczesniej (use-elements.ts, engine).
 * Jedyne miejsce, ktore tego nie sprawdzalo - markOpened w useRealtimeChannel -
 * dostalo guard isDemoBoard.
 */

'use client';

import { useParams } from 'next/navigation';

import WhiteboardCanvas from '@/_new/features/whiteboard/components/canvas/whiteboard-canvas';
import { useDemoSession } from '@/_new/features/demo/use-demo-session';
import { BoardRealtimeProvider } from '../../../context/BoardRealtimeContext';

export default function DemoBoardPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = typeof params?.sessionId === 'string' ? params.sessionId : '';

  const { boardId, guest, isLoading } = useDemoSession(sessionId);

  if (!sessionId) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-600">
        Nieprawidlowy link do demo.
      </div>
    );
  }

  if (isLoading || !guest) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-600">
        Przygotowuje tablice...
      </div>
    );
  }

  return (
    <BoardRealtimeProvider boardId={boardId} identity={guest}>
      <div className="relative h-screen w-screen overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-sm text-white shadow">
          Tryb demo - nic sie nie zapisuje. Jestes tu jako {guest.username}.
        </div>

        <WhiteboardCanvas boardId={boardId} userRole="editor" />
      </div>
    </BoardRealtimeProvider>
  );
}
