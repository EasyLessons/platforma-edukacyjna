/**
 * Publiczne API feature'a `voice-chat` (WebRTC P2P + sygnalizacja przez Supabase
 * Broadcast). Przeniesione z src/app/context (PR-B1 z docs/architecture/REFAKTOR-PLAN.md).
 *
 * Provider montuje strona tablicy (src/app/(whiteboard)/whiteboard/page.tsx);
 * komponenty UI (panel rozmowy, ustawienia, komunikat o braku wsparcia) uzywa
 * features/whiteboard/components/canvas/online-users.tsx. Przeplyw: docs/architecture/pipelines.md par. 5.
 */

export { VoiceChatProvider, useVoiceChat, useVoiceChatRequired } from './VoiceChatContext';
export type {
  VoiceParticipant,
  VoiceSettings,
  VoiceChatContextType,
  PeerConnection,
  VoiceEvent,
} from './VoiceChatContext';
export type { VoiceError } from './mediaSupport';

export { default } from './components/voice-chat';
export { default as VoiceChat } from './components/voice-chat';
export { default as VoiceChatSettings } from './components/voice-chat-settings';
export { VoiceChatNotice } from './components/voice-chat-notice';
