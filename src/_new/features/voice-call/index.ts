/**
 * Publiczne API feature'a `voice-call` - rozmowa przy tablicy na Daily Prebuilt
 * (`@daily-co/daily-js`, ramka z `DailyIframe.createFrame`).
 *
 * Jedyny dostawca rozmowy od etapu F (stary czat WebRTC + Xirsys usunięty, flaga
 * `NEXT_PUBLIC_VOICE_PROVIDER` nie istnieje). Provider montuje strona tablicy
 * (src/app/(whiteboard)/whiteboard/page.tsx); `CallButton` stoi w prawym górnym rogu Excalidraw.
 * Przepływ: docs/architecture/pipelines.md par. 5.
 */

export { DailyCallProvider } from './daily-call-provider';
export { CallButton } from './components/call-button';
export { useDailyCall } from './call-context';
export type { CallNotice, CallStatus, DailyCallContextValue } from './call-context';
