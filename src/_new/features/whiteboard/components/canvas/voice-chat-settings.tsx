/**
 * ═══════════════════════════════════════════════════════════════════════════
 *                        VOICE CHAT SETTINGS MODAL
 *                   Ustawienia mikrofonu i głośności
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Volume2, Keyboard, Shield, Check } from 'lucide-react';
import { useVoiceChat, VoiceSettings } from '@/app/context/VoiceChatContext';

interface VoiceChatSettingsProps {
  onClose: () => void;
}

const DEFAULT_SETTINGS: VoiceSettings = {
  microphoneVolume: 1,
  speakerVolume: 1,
  pushToTalk: false,
  pushToTalkKey: 'Space',
  noiseSupression: true,
  echoCancellation: true,
};

export default function VoiceChatSettings({ onClose }: VoiceChatSettingsProps) {
  const voiceChat = useVoiceChat();

  // Domyślne ustawienia jeśli brak contextu
  const settings = voiceChat?.settings ?? DEFAULT_SETTINGS;
  const updateSettings = voiceChat?.updateSettings ?? ((_: Partial<VoiceSettings>) => {});

  const [localSettings, setLocalSettings] = useState<VoiceSettings>(settings);
  const [isRecordingKey, setIsRecordingKey] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micTestStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Test mikrofonu - pokazuj poziom głośności
  useEffect(() => {
    let mounted = true;

    const startMicTest = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micTestStreamRef.current = stream;

        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();

        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);

        analyserRef.current.fftSize = 256;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const checkLevel = () => {
          if (!analyserRef.current || !mounted) return;

          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          const normalizedLevel = Math.min(average / 128, 1); // Normalizuj do 0-1

          setMicLevel(normalizedLevel * localSettings.microphoneVolume);
          animationFrameRef.current = requestAnimationFrame(checkLevel);
        };

        checkLevel();
      } catch (error) {
        console.error('Nie można uruchomić testu mikrofonu:', error);
      }
    };

    startMicTest();

    return () => {
      mounted = false;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (micTestStreamRef.current) {
        micTestStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [localSettings.microphoneVolume]);

  // Nasłuchiwanie klawiszy dla push-to-talk
  useEffect(() => {
    if (!isRecordingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      setLocalSettings((prev) => ({
        ...prev,
        pushToTalkKey: e.code,
      }));
      setIsRecordingKey(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecordingKey]);

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  const formatKeyName = (code: string) => {
    if (code === 'Space') return 'Spacja';
    if (code.startsWith('Key')) return code.replace('Key', '');
    if (code.startsWith('Digit')) return code.replace('Digit', '');
    return code;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Ustawienia Voice Chat
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Głośność mikrofonu */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Mic className="w-4 h-4" />
              Głośność mikrofonu
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={localSettings.microphoneVolume}
              onChange={(e) =>
                setLocalSettings((prev) => ({
                  ...prev,
                  microphoneVolume: parseFloat(e.target.value),
                }))
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>{Math.round(localSettings.microphoneVolume * 100)}%</span>
              <span>100%</span>
            </div>

            {/* Poziom mikrofonu (live) */}
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-1">Test mikrofonu:</div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-75"
                  style={{ width: `${micLevel * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Głośność słuchawek */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Volume2 className="w-4 h-4" />
              Głośność słuchawek
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={localSettings.speakerVolume}
              onChange={(e) =>
                setLocalSettings((prev) => ({
                  ...prev,
                  speakerVolume: parseFloat(e.target.value),
                }))
              }
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>{Math.round(localSettings.speakerVolume * 100)}%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Push-to-Talk */}
          <div className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Keyboard className="w-4 h-4" />
                Tryb Push-to-Talk
              </label>
              <button
                onClick={() =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    pushToTalk: !prev.pushToTalk,
                  }))
                }
                className={`
                  relative w-12 h-6 rounded-full transition-colors
                  ${localSettings.pushToTalk ? 'bg-blue-500' : 'bg-gray-300'}
                `}
              >
                <span
                  className={`
                    absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow
                    ${localSettings.pushToTalk ? 'translate-x-7' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {localSettings.pushToTalk && (
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-2">Klawisz do mówienia:</div>
                <button
                  onClick={() => setIsRecordingKey(true)}
                  className={`
                    w-full px-4 py-3 border-2 border-dashed rounded-lg text-center transition-colors
                    ${
                      isRecordingKey
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-300 hover:border-gray-400'
                    }
                  `}
                >
                  {isRecordingKey ? (
                    <span className="animate-pulse">Naciśnij klawisz...</span>
                  ) : (
                    <kbd className="px-3 py-1.5 bg-gray-100 rounded text-gray-700 font-mono text-lg">
                      {formatKeyName(localSettings.pushToTalkKey)}
                    </kbd>
                  )}
                </button>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-2">
              {localSettings.pushToTalk
                ? 'Mikrofon będzie aktywny tylko gdy przytrzymasz klawisz.'
                : 'Mikrofon będzie zawsze aktywny (z detekcją głosu).'}
            </p>
          </div>

          {/* Ustawienia audio */}
          <div className="border border-gray-200 rounded-xl p-4">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
              <Shield className="w-4 h-4" />
              Ustawienia audio
            </label>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.echoCancellation}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      echoCancellation: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Usuwanie echa</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.noiseSupression}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      noiseSupression: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Redukcja szumów</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Anuluj
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            <Check className="w-4 h-4" />
            Zapisz
          </button>
        </div>
      </div>
    </div>
  );
}
