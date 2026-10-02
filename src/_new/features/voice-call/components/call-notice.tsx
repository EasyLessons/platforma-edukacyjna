'use client';

/** Komunikat rozmowy pokazywany w stronie (rozmowy wyłączone, brak wsparcia, błąd połączenia). */

import { AlertCircle } from 'lucide-react';
import type { CallNotice } from '../call-context';

interface CallNoticeToastProps {
  notice: CallNotice;
  onRetry: () => void;
  onDismiss: () => void;
}

const buttonBase =
  'min-h-11 min-w-11 cursor-pointer rounded-lg px-3 text-sm font-semibold transition-colors';

export function CallNoticeToast({ notice, onRetry, onDismiss }: CallNoticeToastProps) {
  return (
    <div
      role="status"
      data-testid="call-notice"
      data-kind={notice.kind}
      className="fixed left-1/2 top-[84px] z-[1150] w-[min(360px,calc(100vw-24px))] -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
    >
      <div className="flex gap-2">
        <AlertCircle
          className={`mt-0.5 h-5 w-5 shrink-0 ${notice.kind === 'disabled' ? 'text-gray-500' : 'text-red-500'}`}
        />
        <p className="text-sm text-gray-800">{notice.message}</p>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        {notice.kind === 'error' && (
          <button
            type="button"
            onClick={onRetry}
            className={`${buttonBase} bg-gray-900 text-white hover:bg-gray-700`}
          >
            Spróbuj ponownie
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className={`${buttonBase} bg-gray-100 text-gray-700 hover:bg-gray-200`}
        >
          Zamknij
        </button>
      </div>
    </div>
  );
}
