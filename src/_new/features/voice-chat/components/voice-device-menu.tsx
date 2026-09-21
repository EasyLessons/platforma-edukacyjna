/**
 * Rozwijane menu mikrofonu / glosnikow: nazwa urzadzenia, suwak glosnosci,
 * (opcjonalnie) pasek poziomu mikrofonu, przycisk do pelnych ustawien.
 * Wydzielone z voice-chat.tsx, markup 1:1 dla obu menu.
 */
import { Settings } from 'lucide-react';

interface Props {
  deviceLabel: string;
  deviceName: string;
  volumeLabel: string;
  volume: number;
  onVolumeChange: (value: number) => void;
  /** Poziom mikrofonu 0-1; gdy podany, renderuje pasek pod suwakiem. */
  micLevel?: number;
  onOpenSettings: () => void;
}

export function VoiceDeviceMenu({
  deviceLabel,
  deviceName,
  volumeLabel,
  volume,
  onVolumeChange,
  micLevel,
  onOpenSettings,
}: Props) {
  return (
    <div
      className="absolute top-full right-0 mt-2 w-72 rounded-2xl border border-gray-200 bg-white text-gray-800 shadow-2xl z-50 p-4 space-y-4 animate-[menuIn_220ms_ease-out_forwards]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-800">{deviceLabel}</p>
        <p className="text-xs text-gray-500 truncate">{deviceName}</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-800">{volumeLabel}</p>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="w-full accent-gray-700"
        />
        {micLevel !== undefined && (
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-100"
              style={{ width: `${Math.round(micLevel * 100)}%` }}
            />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 px-3 py-2 text-sm text-gray-700"
      >
        <Settings className="w-4 h-4" />
        Ustawienia glosu
      </button>
    </div>
  );
}
