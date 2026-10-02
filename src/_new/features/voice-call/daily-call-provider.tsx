'use client';

/**
 * Rozmowa przy tablicy na Daily Prebuilt (iframe z `DailyIframe.createFrame`).
 *
 * Provider trzyma JEDNĄ instancję rozmowy na tablicę i renderuje (portalem do <body>)
 * pływające okno z ramką Daily oraz komunikaty. Przycisk "Rozmowa" (`CallButton`) może
 * stać w dowolnym miejscu drzewa - w starym silniku w pasku `online-users`, w Excalidraw
 * w prawym górnym rogu.
 *
 * Zasady, których pilnuje ten plik:
 *  - `@daily-co/daily-js` ładuje się dynamicznie dopiero po kliknięciu (nie trafia do
 *    głównego bundla tablicy),
 *  - token rozmowy żyje tylko w zmiennej lokalnej `start()` - nie trafia do stanu Reacta,
 *    logów ani adresu naszej strony (daily-js sam dokleja go do adresu ramki na domenie
 *    Daily jako `?t=` - tak działa Prebuilt). Token jest ważny 5 min i służy tylko do wejścia,
 *    więc KAŻDE dołączenie (także ponowne po rozłączeniu) pobiera nowy z endpointu,
 *  - serwera nic nie odpytuje samo: kolejna próba to zawsze kliknięcie (limit żądań backendu),
 *  - pokój ma limit czasu i wyrzuca uczestników po jego upływie - to zwykły koniec rozmowy
 *    (komunikat, panel wraca do stanu początkowego), nie błąd,
 *  - nikt nie jest prowadzącym spotkania Daily (backend nie nadaje `is_owner` ani `canAdmin`),
 *    więc UI nie ma funkcji prowadzącego; nauczyciel i uczeń widzą ten sam przycisk "Rozmowa",
 *  - ramka Daily siedzi w kontenerze, który jest w DOM przez cały czas życia providera;
 *    zwinięcie okna tylko go chowa (odmontowanie albo `display: none` zrywa rozmowę),
 *  - każda ścieżka błędu kończy się komunikatem w stronie, nigdy wyjątkiem.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { DailyCall } from '@daily-co/daily-js';

import { createLogger } from '@/_new/lib/logger';
// Ten sam test wsparcia przeglądarki co w starym czacie (http, przeglądarka w aplikacji,
// brak mediaDevices). Przy usuwaniu `features/voice-chat` plik mediaSupport.ts przenieść tutaj.
import { getVoiceSupportIssue } from '@/_new/features/voice-chat/mediaSupport';
import { createBoardCall } from './api/callApi';
import { DailyCallContext } from './call-context';
import type { CallNotice, CallStatus, DailyCallContextValue } from './call-context';
import {
  CALL_MESSAGES,
  describeError,
  noticeFromDailyError,
  noticeFromStartError,
} from './call-errors';
import { CallPanel } from './components/call-panel';
import { CallNoticeToast } from './components/call-notice';

const log = createLogger('voice-call/daily-call-provider');

/** Uprawnienia, których ramka Daily potrzebuje (createFrame ustawia je sam - tu tylko pilnujemy). */
const REQUIRED_IFRAME_ALLOW = ['microphone', 'camera', 'autoplay', 'display-capture'];

/** Ile czekamy na grzeczne wyjście z rozmowy, zanim usuniemy ramkę siłą. */
const DESTROY_TIMEOUT_MS = 3000;

function ensureIframeAllow(iframe: HTMLIFrameElement | null): void {
  if (!iframe) return;
  const current = (iframe.getAttribute('allow') ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  const missing = REQUIRED_IFRAME_ALLOW.filter((name) => !current.includes(name));
  if (missing.length) iframe.setAttribute('allow', [...current, ...missing].join('; '));
}

/**
 * Zamyka instancję Daily. `destroy()` czeka w środku na odpowiedź ramki na "leave" - jeśli
 * ramka nie odpowie (nie załadowała się, strona Daily wisi), obietnica nigdy by się nie
 * rozstrzygnęła, a instancja zostałaby w rejestrze daily-js. Po limicie czasu usuwamy więc
 * ramkę z DOM i wołamy `destroy()` drugi raz - bez ramki kończy się od razu.
 */
async function destroyCall(call: DailyCall): Promise<void> {
  const attempt = () =>
    call.isDestroyed()
      ? Promise.resolve()
      : call.destroy().catch((err: unknown) => {
          log.warn('Błąd przy zamykaniu rozmowy', describeError(err));
        });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), DESTROY_TIMEOUT_MS);
  });
  try {
    const late = await Promise.race([attempt().then(() => false), timedOut]);
    if (late) {
      log.warn('Rozmowa nie zamknęła się w limicie czasu - usuwam ramkę');
      call.iframe()?.remove();
      void attempt();
    }
  } catch (err) {
    log.warn('Błąd przy zamykaniu rozmowy', describeError(err));
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

export interface DailyCallProviderProps {
  /** Liczbowe id tablicy; null (demo, brak id) = rozmowa niedostępna, przycisk się nie renderuje. */
  boardId: number | null;
  children: ReactNode;
}

export function DailyCallProvider({ boardId, children }: DailyCallProviderProps) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [notice, setNotice] = useState<CallNotice | null>(null);
  // Portal do <body> tylko w przeglądarce (strona tablicy jest też renderowana na serwerze).
  const isClient = useSyncExternalStore(subscribeNever, onClient, onServer);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const callRef = useRef<DailyCall | null>(null);
  /** Podbijany przy każdym zamknięciu - start() rozpoznaje po nim, że jego wynik jest już nieaktualny. */
  const generationRef = useRef(0);
  const startingRef = useRef(false);
  const destroyingRef = useRef<Promise<void> | null>(null);

  const teardown = useCallback(() => {
    generationRef.current += 1;
    startingRef.current = false;
    const call = callRef.current;
    callRef.current = null;
    if (call) {
      const pending: Promise<void> = destroyCall(call).finally(() => {
        if (destroyingRef.current === pending) destroyingRef.current = null;
      });
      destroyingRef.current = pending;
    }
    setStatus('idle');
    setIsJoined(false);
    setIsMuted(false);
    setMinimized(false);
  }, []);

  // Zmiana tablicy i odmontowanie kończą rozmowę. W StrictMode (dev) cleanup odpala się
  // także zaraz po pierwszym montażu - wtedy nie ma jeszcze czego zamykać.
  useEffect(() => {
    return () => {
      teardown();
      setNotice(null);
    };
  }, [boardId, teardown]);

  const start = useCallback(async () => {
    if (boardId == null) return;
    if (callRef.current) {
      setMinimized(false);
      return;
    }
    // Podwójne kliknięcie: druga próba nie może stworzyć drugiej instancji.
    if (startingRef.current) return;

    setNotice(null);
    const issue = getVoiceSupportIssue();
    if (issue) {
      setNotice({ kind: 'unsupported', message: issue.message, retry: false });
      return;
    }

    startingRef.current = true;
    const generation = generationRef.current;
    const isStale = () => generation !== generationRef.current;
    setStatus('loading');

    try {
      const session = await createBoardCall(boardId);
      if (isStale()) return;

      const { default: Daily } = await import('@daily-co/daily-js');
      // Poprzednia rozmowa mogła się jeszcze zamykać (szybkie "rozłącz" -> "rozmowa").
      if (destroyingRef.current) await destroyingRef.current;
      if (isStale()) return;

      const container = frameRef.current;
      if (!container) throw new Error('Brak kontenera na okno rozmowy');

      const call = Daily.createFrame(container, {
        lang: 'pl',
        showLeaveButton: true,
        showFullscreenButton: false,
        // Domyślnie samo audio; kamerę użytkownik włącza w oknie Daily.
        startVideoOff: true,
        startAudioOff: false,
        iframeStyle: { width: '100%', height: '100%', border: '0' },
        // O jedną instancję naraz dbamy sami (callRef + startingRef). Flaga chroni przed
        // wyjątkiem "Duplicate DailyIframe instances", gdyby stara instancja nie zdążyła
        // się wyrejestrować.
        allowMultipleCallInstances: true,
      });
      ensureIframeAllow(call.iframe());
      callRef.current = call;
      const isCurrent = () => callRef.current === call;

      call.on('joined-meeting', () => {
        if (!isCurrent()) return;
        setIsJoined(true);
        setIsMuted(!call.localAudio());
      });
      call.on('participant-updated', (event) => {
        if (isCurrent() && event.participant.local) setIsMuted(!event.participant.audio);
      });
      // "Wyjdź" kliknięte w oknie Daily.
      call.on('left-meeting', () => {
        if (isCurrent()) teardown();
      });
      // Błąd krytyczny Daily, m.in. wyrzucenie przy wygaśnięciu pokoju (`exp-room`, `ejected`).
      call.on('error', (event) => {
        if (!isCurrent()) return;
        const type = event.error?.type;
        const ended = noticeFromDailyError(type);
        if (ended.kind === 'error')
          log.warn('Daily zgłosił błąd rozmowy', { type: type ?? 'unknown' });
        else log.info('Rozmowa zakończona przez Daily', { type });
        setNotice(ended);
        teardown();
      });

      setMinimized(false);
      setStatus('active');
      startingRef.current = false;

      // join() rozstrzyga się dopiero po przejściu ekranu wejścia Daily - nie czekamy na nie.
      call.join({ url: session.room_url, token: session.token }).catch((err: unknown) => {
        if (!isCurrent()) return;
        log.warn('Nie udało się dołączyć do rozmowy', describeError(err));
        setNotice({ kind: 'error', message: CALL_MESSAGES.failed, retry: true });
        teardown();
      });
    } catch (err) {
      if (isStale()) return;
      const refusal = noticeFromStartError(err);
      // Odmowa z kontraktu (wyłączone, rozmowa się nie zaczęła, limit) to nie awaria.
      if (refusal.kind === 'error') log.warn('Nie udało się rozpocząć rozmowy', describeError(err));
      else log.info('Rozmowa niedostępna', describeError(err));
      startingRef.current = false;
      setNotice(refusal);
      setStatus('idle');
    }
  }, [boardId, teardown]);

  const toggleMinimized = useCallback(() => setMinimized((value) => !value), []);

  const toggleMute = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    try {
      const muteNow = call.localAudio();
      call.setLocalAudio(!muteNow);
      setIsMuted(muteNow);
    } catch (err) {
      log.warn('Nie udało się przełączyć mikrofonu', describeError(err));
    }
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const value = useMemo<DailyCallContextValue>(
    () => ({
      status,
      isJoined,
      isMuted,
      minimized,
      notice,
      start,
      leave: teardown,
      toggleMinimized,
      toggleMute,
      dismissNotice,
    }),
    [
      status,
      isJoined,
      isMuted,
      minimized,
      notice,
      start,
      teardown,
      toggleMinimized,
      toggleMute,
      dismissNotice,
    ]
  );

  return (
    <DailyCallContext.Provider value={boardId == null ? null : value}>
      {children}
      {isClient &&
        boardId != null &&
        createPortal(
          <>
            <CallPanel
              frameRef={frameRef}
              active={status === 'active'}
              isJoined={isJoined}
              isMuted={isMuted}
              minimized={minimized}
              onToggleMinimized={toggleMinimized}
              onToggleMute={toggleMute}
              onLeave={teardown}
            />
            {notice && (
              <CallNoticeToast
                notice={notice}
                onRetry={() => void start()}
                onDismiss={dismissNotice}
              />
            )}
          </>,
          document.body
        )}
    </DailyCallContext.Provider>
  );
}
