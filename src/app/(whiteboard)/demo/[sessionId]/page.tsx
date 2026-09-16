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

import { GraduationCap } from 'lucide-react';

import Link from 'next/link';
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
        {/*
          Powrot na landing. Demo jest czesto pierwszym kontaktem ze strona,
          a bez tego linku z tablicy nie da sie wyjsc inaczej niz przyciskiem
          wstecz. `z-50` trzyma go nad plotnem, `pointer-events-auto` jest
          jawne, bo rodzic bywa przykrywany warstwami canvasu.
        */}
        <Link
          href="/"
          aria-label="EasyLesson - strona glowna"
          className="pointer-events-auto absolute left-4 top-3 z-50 flex items-center gap-2 rounded-xl bg-white/90 px-3 py-2 text-sm font-semibold text-gray-800 shadow-md backdrop-blur-sm transition-colors hover:bg-white"
        >
          <GraduationCap className="h-5 w-5 text-blue-600" />
          <span>EasyLesson</span>
        </Link>

        <WhiteboardCanvas boardId={boardId} userRole="editor" />
      </div>
    </BoardRealtimeProvider>
  );
}
