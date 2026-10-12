'use client';

/**
 * Pływające okno rozmowy: belka (wycisz / zwiń / rozłącz) + kontener na ramkę Daily.
 *
 * Kontener ramki (`call-frame`) jest ZAWSZE tym samym elementem DOM - przy zwinięciu
 * dostaje tylko wysokość 0 i `visibility: hidden`. Nie wolno go odmontowywać ani chować
 * przez `display: none`, bo przeglądarka zrywa wtedy połączenie w ramce.
 *
 * Układ: na komputerze okno 360x420 pod paskiem w prawym górnym rogu (tam, gdzie był
 * panel starego czatu; dolne rogi zajmują zoom, Tutor AI i pomoc Excalidraw); na telefonie
 * dolny arkusz na pół ekranu. Zwinięte = sama belka; na telefonie nad dolnymi narzędziami.
 */

import type { RefObject } from 'react';
import { Maximize2, Mic, MicOff, Minimize2, PhoneOff } from 'lucide-react';

interface CallPanelProps {
  frameRef: RefObject<HTMLDivElement | null>;
  active: boolean;
  isJoined: boolean;
  isMuted: boolean;
  minimized: boolean;
  onToggleMinimized: () => void;
  onToggleMute: () => void;
  onLeave: () => void;
}

const barButton =
  'inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40';

const EXPANDED =
  'right-4 top-[84px] h-[420px] max-h-[calc(100dvh-100px)] w-[360px] rounded-2xl ' +
  'max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-[50dvh] max-sm:max-h-none max-sm:w-auto max-sm:rounded-b-none';

const MINIMIZED =
  'right-4 top-[84px] rounded-full ' +
  'max-sm:top-auto max-sm:right-auto max-sm:left-1/2 max-sm:-translate-x-1/2 ' +
  'max-sm:bottom-[calc(76px+env(safe-area-inset-bottom,0px))]';

export function CallPanel({
  frameRef,
  active,
  isJoined,
  isMuted,
  minimized,
  onToggleMinimized,
  onToggleMute,
  onLeave,
}: CallPanelProps) {
  return (
    <section
      aria-label="Rozmowa"
      data-testid="call-panel"
      data-minimized={minimized ? 'true' : 'false'}
      hidden={!active}
      style={active ? undefined : { display: 'none' }}
      className={`fixed z-[1100] flex flex-col overflow-hidden border border-gray-300 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] ${
        minimized ? MINIMIZED : EXPANDED
      }`}
    >
      <div className="flex h-12 shrink-0 items-center gap-1 px-2">
        <span className="flex items-center gap-2 px-2 text-sm font-semibold text-gray-800">
          <span
            className={`h-2 w-2 rounded-full ${isJoined ? 'bg-green-500' : 'animate-pulse bg-gray-400'}`}
          />
          Rozmowa
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onToggleMute}
          disabled={!isJoined}
          aria-pressed={isMuted}
          aria-label={isMuted ? 'Włącz mikrofon' : 'Wycisz mikrofon'}
          title={isMuted ? 'Włącz mikrofon' : 'Wycisz mikrofon'}
          data-testid="call-mute"
          className={`${barButton} ${isMuted ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onToggleMinimized}
          aria-label={minimized ? 'Rozwiń okno rozmowy' : 'Zwiń okno rozmowy'}
          title={minimized ? 'Rozwiń okno rozmowy' : 'Zwiń okno rozmowy'}
          data-testid="call-minimize"
          className={`${barButton} text-gray-700 hover:bg-gray-100`}
        >
          {minimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onLeave}
          aria-label="Rozłącz"
          title="Rozłącz"
          data-testid="call-leave"
          className={`${barButton} bg-red-500 text-white hover:bg-red-600`}
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={frameRef}
        data-testid="call-frame"
        aria-hidden={minimized}
        className={minimized ? 'invisible h-0 overflow-hidden' : 'min-h-0 flex-1'}
      />
    </section>
  );
}
