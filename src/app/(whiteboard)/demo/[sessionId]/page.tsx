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
import {
  BoardHeaderFrame,
  BoardLogoButton,
} from '@/_new/features/whiteboard/components/layout/board-header';
import { useWhiteboardUiMetrics } from '@/_new/features/whiteboard/hooks/use-whiteboard-ui-metrics';
import { BoardRealtimeProvider } from '../../../context/BoardRealtimeContext';

export default function DemoBoardPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = typeof params?.sessionId === 'string' ? params.sessionId : '';

  const { boardId, guest, isLoading } = useDemoSession(sessionId);
  const metrics = useWhiteboardUiMetrics();

  if (!sessionId) {
    return (
      <div className="flex h-dvh items-center justify-center text-gray-600">
        Nieprawidlowy link do demo.
      </div>
    );
  }

  if (isLoading || !guest) {
    return (
      <div className="flex h-dvh items-center justify-center text-gray-600">
        Przygotowuje tablice...
      </div>
    );
  }

  return (
    <BoardRealtimeProvider boardId={boardId} identity={guest}>
      <div className="relative h-dvh w-screen overflow-hidden">
        {/*
          Powrot na landing. Demo jest czesto pierwszym kontaktem ze strona, a bez
          tego przycisku z tablicy nie da sie wyjsc inaczej niz "wstecz".

          Logo i ramka to TE SAME komponenty, ktorych uzywa BoardHeader na zwyklej
          tablicy — zeby demo wygladalo identycznie. Jedyne roznice sa celowe:
          prowadzi na "/" zamiast do panelu, i jest widoczne przy kazdej szerokosci
          (BoardHeader ponizej 1300 px chowa logo, a w demo to jedyna droga powrotu).
        */}
        <BoardHeaderFrame compact={!metrics.showFullHeader}>
          <BoardLogoButton
            href="/"
            tooltip="Wróć na stronę główną"
            compact={metrics.isPhoneLayout}
          />
        </BoardHeaderFrame>

        <WhiteboardCanvas boardId={boardId} userRole="editor" />
      </div>
    </BoardRealtimeProvider>
  );
}
