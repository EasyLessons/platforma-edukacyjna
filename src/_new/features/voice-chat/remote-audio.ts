/**
 * Element <audio> dla zdalnego strumienia peera: tworzenie, podmiana bez wycieku,
 * zwalnianie. Wydzielone z useWebRTCConnections (ontrack), semantyka 1:1.
 */
import type { PeerConnection } from './types';

interface AttachOptions {
  stream: MediaStream;
  volume: number;
  /** Id naszego lokalnego strumienia - zabezpieczenie przed odtworzeniem samego siebie (echo). */
  localStreamId: string | null;
  remoteUsername: string;
  /** iOS: play() poza gestem uzytkownika rzuca NotAllowedError - UI pokazuje "Wlacz dzwiek". */
  onAudioBlocked?: () => void;
}

/**
 * Tworzy grajacy element <audio> dla zdalnego strumienia. Zwraca null, gdy strumien
 * jest naszym wlasnym (feedback loop).
 */
export function attachRemoteAudio({
  stream,
  volume,
  localStreamId,
  remoteUsername,
  onAudioBlocked,
}: AttachOptions): HTMLAudioElement | null {
  console.log(`🎤 [VOICE] ✅ Otrzymano audio stream od ${remoteUsername}`);

  const audio = new Audio();
  audio.srcObject = stream;
  audio.volume = volume;
  audio.muted = false; // to jest remote stream, wiec nie mute

  if (localStreamId && stream.id === localStreamId) {
    console.log(`🎤 [VOICE] ⚠️ Ignoruję własny stream (zapobieganie echo)`);
    return null;
  }

  audio.autoplay = true;
  audio.setAttribute('playsinline', '');
  audio.play().catch((err) => {
    console.error('🎤 [VOICE] ❌ Błąd odtwarzania audio:', err);
    if ((err as { name?: string } | null)?.name === 'NotAllowedError') {
      onAudioBlocked?.();
    }
  });

  return audio;
}

/** Zatrzymuje i odpina strumien od elementu (przed zamknieciem pc albo podmiana). */
export function detachAudio(audio: HTMLAudioElement | undefined): void {
  if (!audio) return;
  audio.pause();
  audio.srcObject = null;
}

/** Podmienia element audio polaczenia, pauzujac poprzedni (wyciek przy ponownym ontrack). */
export function replaceAudioElement(conn: PeerConnection, audio: HTMLAudioElement): void {
  if (conn.audioElement && conn.audioElement !== audio) {
    detachAudio(conn.audioElement);
  }
  conn.audioElement = audio;
}

/** Zamyka polaczenie razem z jego elementem audio. */
export function closePeerConnection(conn: PeerConnection): void {
  detachAudio(conn.audioElement);
  conn.pc.close();
}
