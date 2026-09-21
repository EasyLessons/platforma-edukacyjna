/**
 * Poziom mikrofonu (0-1) do paska w menu mikrofonu. Otwiera osobny capture
 * `getUserMedia({ audio: true })` tylko gdy menu jest otwarte i trwa rozmowa;
 * zwalnia go przy zamknieciu. Wydzielone z voice-chat.tsx, 1:1.
 */
import { useEffect, useState } from 'react';

export function useMicLevelMeter(enabled: boolean): number {
  const [micLevel, setMicLevel] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setMicLevel(0);
      return;
    }

    let isMounted = true;
    let frameId = 0;
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;

    const startMeter = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new AudioContext();

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!isMounted) return;
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((acc, val) => acc + val, 0) / data.length;
          setMicLevel(Math.min(avg / 100, 1));
          frameId = requestAnimationFrame(tick);
        };

        tick();
      } catch {
        setMicLevel(0);
      }
    };

    startMeter();

    return () => {
      isMounted = false;
      if (frameId) cancelAnimationFrame(frameId);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
    };
  }, [enabled]);

  return micLevel;
}
