/**
 * Wybór dostawcy rozmowy przy tablicy: `NEXT_PUBLIC_VOICE_PROVIDER=legacy` zostawia stary
 * czat głosowy (WebRTC P2P + TURN Xirsys, `features/voice-chat`), każda inna wartość
 * (albo brak zmiennej) włącza Daily (`features/voice-call`).
 *
 * Zmienna `NEXT_PUBLIC_*` jest wklejana przez Next.js w czasie builda, więc zmiana
 * wymaga przebudowania (na Vercelu: nowy deploy po zmianie zmiennej).
 * `legacy` to wyjście awaryjne do czasu usunięcia starego czatu (osobny PR).
 */

export type VoiceProvider = 'daily' | 'legacy';

export function resolveVoiceProvider(value: string | undefined): VoiceProvider {
  return value?.trim().toLowerCase() === 'legacy' ? 'legacy' : 'daily';
}

export const VOICE_PROVIDER: VoiceProvider = resolveVoiceProvider(
  process.env.NEXT_PUBLIC_VOICE_PROVIDER
);

export const isDailyVoice = VOICE_PROVIDER === 'daily';
