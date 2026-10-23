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
 * Tablica to Excalidraw (jedyny silnik; stary zostaje usuniety). Gosc laczy sie z whiteboard-sync
 * BEZ tokenu - serwer wpuszcza tylko dokumenty `demo-<id>`, nie zapisuje ich w bazie, ogranicza
 * liczbe osob i elementow oraz wygasza sesje po kilku godzinach (whiteboard-sync/src/demo.ts).
 * Druga osoba wchodzi tym samym linkiem i widzi tablice na zywo, dopoki ktos jest polaczony.
 *
 * VoiceChatProvider jest tu SWIADOMIE pominiety - demo nie potrzebuje rozmowy glosowej.
 */

'use client';

import { useParams } from 'next/navigation';

import { useDemoSession } from '@/_new/features/demo/use-demo-session';
import { DEMO_ELEMENT_LIMIT } from '@/_new/features/demo/demo-limits';
import {
  BoardHeaderFrame,
  BoardLogoButton,
} from '@/_new/features/whiteboard/components/layout/board-header';
import { useWhiteboardUiMetrics } from '@/_new/features/whiteboard/hooks/use-whiteboard-ui-metrics';
import { ExcalidrawWhiteboard } from '@/_new/features/board-engine/components/excalidraw-whiteboard';

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
        <BoardLogoButton href="/" tooltip="Wróć na stronę główną" compact={metrics.isPhoneLayout} />
      </BoardHeaderFrame>
      <ExcalidrawWhiteboard
        boardId={boardId}
        userRole="editor"
        guest={guest}
        elementLimit={DEMO_ELEMENT_LIMIT}
      />
    </div>
  );
}
