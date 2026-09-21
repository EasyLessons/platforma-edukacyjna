/**
 * Nazwy domyslnego mikrofonu i glosnikow (enumerateDevices), odswiezane przy
 * `devicechange`. Wydzielone z voice-chat.tsx, 1:1.
 */
import { useCallback, useEffect, useState } from 'react';

const DEFAULT_NAME = 'Domyslne';

export function useAudioDeviceNames() {
  const [inputDeviceName, setInputDeviceName] = useState(DEFAULT_NAME);
  const [outputDeviceName, setOutputDeviceName] = useState(DEFAULT_NAME);

  const refreshDeviceNames = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const input = devices.find((d) => d.kind === 'audioinput');
      const output = devices.find((d) => d.kind === 'audiooutput');
      setInputDeviceName(input?.label || DEFAULT_NAME);
      setOutputDeviceName(output?.label || DEFAULT_NAME);
    } catch {
      setInputDeviceName(DEFAULT_NAME);
      setOutputDeviceName(DEFAULT_NAME);
    }
  }, []);

  useEffect(() => {
    refreshDeviceNames();
    const onDeviceChange = () => refreshDeviceNames();
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
    };
  }, [refreshDeviceNames]);

  return { inputDeviceName, outputDeviceName };
}
