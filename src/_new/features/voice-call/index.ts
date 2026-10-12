/**
 * Publiczne API feature'a `voice-call` - rozmowa przy tablicy na Daily Prebuilt
 * (`@daily-co/daily-js`, ramka z `DailyIframe.createFrame`).
 *
 * Włączany flagą `NEXT_PUBLIC_VOICE_PROVIDER` (config/voice-provider.ts): domyślnie `daily`,
 * `legacy` = stary czat z `features/voice-chat`. Provider montuje strona tablicy
 * (src/app/(whiteboard)/whiteboard/page.tsx) wokół obu silników; `CallButton` stoi w pasku
 * `online-users` (stary silnik) i w prawym górnym rogu Excalidraw.
 * Przepływ: docs/architecture/pipelines.md par. 5.
 */

export { isDailyVoice, VOICE_PROVIDER, resolveVoiceProvider } from './config/voice-provider';
export type { VoiceProvider } from './config/voice-provider';
export { DailyCallProvider } from './daily-call-provider';
export { CallButton } from './components/call-button';
export { useDailyCall } from './call-context';
export type { CallNotice, CallStatus, DailyCallContextValue } from './call-context';
