'use client';

/**
 * Komunikaty czatu glosowego pokazywane w stronie.
 *
 * Zastepuje `alert()`, ktory w przegladarkach wbudowanych w aplikacje
 * (Messenger, Facebook, Instagram) czesto w ogole sie nie wyswietla — wtedy
 * klikniecie "dolacz" konczylo sie cicha porazka.
 */

import { useState } from 'react';
import { AlertCircle, Volume2 } from 'lucide-react';
import { useVoiceChat } from '../VoiceChatContext';

const buttonBase =
  'min-h-11 min-w-11 px-3 rounded-lg text-sm font-semibold cursor-pointer transition-colors';

export function VoiceChatNotice() {
  const voiceChat = useVoiceChat();
  const [linkCopied, setLinkCopied] = useState(false);

  if (!voiceChat) return null;
  const { voiceError, clearVoiceError, isAudioBlocked, resumeAudio } = voiceChat;

  if (!voiceError && !isAudioBlocked) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
    } catch {
      setLinkCopied(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-[min(360px,calc(100vw-20px))]">
      {voiceError && (
        <div
          role="alert"
          data-testid="voice-error"
          className="bg-white rounded-xl border border-red-200 shadow-[0_4px_12px_rgba(0,0,0,0.1)] p-3"
        >
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-800">{voiceError.message}</p>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            {voiceError.code === 'in-app-browser' && (
              <button
                type="button"
                onClick={handleCopyLink}
                className={`${buttonBase} bg-gray-900 text-white hover:bg-gray-700`}
              >
                {linkCopied ? 'Skopiowano link' : 'Skopiuj link'}
              </button>
            )}
            <button
              type="button"
              onClick={clearVoiceError}
              className={`${buttonBase} bg-gray-100 text-gray-700 hover:bg-gray-200`}
            >
              Zamknij
            </button>
          </div>
        </div>
      )}

      {isAudioBlocked && (
        <div
          role="status"
          data-testid="voice-audio-blocked"
          className="bg-white rounded-xl border border-gray-200 shadow-[0_4px_12px_rgba(0,0,0,0.1)] p-3 flex items-center gap-3"
        >
          <p className="text-sm text-gray-800 flex-1">Przeglądarka wstrzymała dźwięk rozmowy.</p>
          <button
            type="button"
            onClick={() => void resumeAudio()}
            className={`${buttonBase} inline-flex items-center gap-1.5 bg-blue-600 text-white hover:bg-blue-700`}
          >
            <Volume2 className="w-4 h-4" />
            Włącz dźwięk
          </button>
        </div>
      )}
    </div>
  );
}
