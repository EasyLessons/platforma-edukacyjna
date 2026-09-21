/**
 * Stan ustawien voice chatu + updateSettings z natychmiastowym zastosowaniem:
 * glosnosc glosnikow (elementy <audio> peerow), push-to-talk (track.enabled),
 * echo/noise (applyConstraints na zywym torze). Wydzielone z VoiceChatContext, 1:1.
 */
import { useCallback, useRef, useState, type MutableRefObject } from 'react';
import type { PeerConnection, VoiceSettings } from './types';
import { loadVoiceSettings, saveVoiceSettings } from './voice-settings-storage';

/**
 * `getPeerConnections` to getter (nie ref), bo mapa polaczen powstaje w
 * useWebRTCConnections, ktory z kolei potrzebuje `settings` - getter przecina
 * ten cykl inicjalizacji. Trzymany w ref, zeby updateSettings bylo stabilne.
 */
export function useVoiceSettings(
  getPeerConnections: () => Map<number, PeerConnection>,
  localStreamRef: MutableRefObject<MediaStream | null>
) {
  const [settings, setSettings] = useState<VoiceSettings>(loadVoiceSettings);
  const getPeerConnectionsRef = useRef(getPeerConnections);
  getPeerConnectionsRef.current = getPeerConnections;

  const updateSettings = useCallback(
    (newSettings: Partial<VoiceSettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...newSettings };
        saveVoiceSettings(updated);

        if (newSettings.speakerVolume !== undefined) {
          getPeerConnectionsRef.current().forEach((peerConn) => {
            if (peerConn.audioElement) {
              peerConn.audioElement.volume = newSettings.speakerVolume!;
            }
          });
        }

        if (newSettings.pushToTalk !== undefined && localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            // Jesli przelaczono na push-to-talk, wycisz
            audioTrack.enabled = !newSettings.pushToTalk;
          }
        }

        // Echo cancellation / noise suppression w TRAKCIE rozmowy: applyConstraints
        // na zywym torze (best effort - jesli przegladarka nie wspiera zmiany w locie,
        // nowa wartosc i tak trafi do getUserMedia przy nastepnym dolaczeniu).
        if (
          (newSettings.echoCancellation !== undefined ||
            newSettings.noiseSupression !== undefined) &&
          localStreamRef.current
        ) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          audioTrack
            ?.applyConstraints?.({
              echoCancellation: updated.echoCancellation,
              noiseSuppression: updated.noiseSupression,
              autoGainControl: true,
            })
            ?.catch((error: unknown) => {
              console.warn(
                '🎤 [VOICE] applyConstraints nieudane (zadziała od następnego dołączenia):',
                error
              );
            });
        }

        return updated;
      });
    },
    [localStreamRef]
  );

  return { settings, updateSettings };
}
