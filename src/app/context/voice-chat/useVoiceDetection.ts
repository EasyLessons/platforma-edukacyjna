import { useCallback, useRef, MutableRefObject } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useVoiceDetection(
  localStreamRef: MutableRefObject<MediaStream | null>,
  channelRef: MutableRefObject<RealtimeChannel | null>,
  userId: number | undefined,
  setIsSpeaking: (speaking: boolean) => void
) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const speakingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startVoiceDetection = useCallback(() => {
    if (!localStreamRef.current) return;

    audioContextRef.current = new AudioContext();
    analyserRef.current = audioContextRef.current.createAnalyser();

    const source = audioContextRef.current.createMediaStreamSource(localStreamRef.current);
    source.connect(analyserRef.current);

    analyserRef.current.fftSize = 256;
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let wasSpeaking = false;

    speakingCheckIntervalRef.current = setInterval(() => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(dataArray);

      // Oblicz średnią głośność
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const speaking = average > 30; // Próg detekcji

      if (speaking !== wasSpeaking) {
        wasSpeaking = speaking;
        setIsSpeaking(speaking);

        // Broadcast speaking status
        channelRef.current?.send({
          type: 'broadcast',
          event: 'voice-speaking',
          payload: {
            type: 'voice-speaking',
            userId: userId,
            isSpeaking: speaking,
          },
        });
      }
    }, 100);
  }, [userId, localStreamRef, channelRef, setIsSpeaking]);

  const stopVoiceDetection = useCallback(() => {
    if (speakingCheckIntervalRef.current) {
      clearInterval(speakingCheckIntervalRef.current);
      speakingCheckIntervalRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
  }, []);

  return { startVoiceDetection, stopVoiceDetection };
}
