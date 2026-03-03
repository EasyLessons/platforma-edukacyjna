/**
 * loading-overlay.tsx
 *
 * Nakładka wyświetlana podczas ładowania tablicy. Zakrywa cały canvas rozmytym białym
 * tłem, pokazuje logo EasyLesson i pasek postępu ładowania.
 *
 * Pasek postępu przechodzi przez etapy:
 *   10% → zaczyna pobieranie z bazy
 *   50% → elementy pobrane, przetwarza dane
 *   70% → elementy ustawione, zaczyna ładować obrazy
 *   90%–100% → ładuje obrazy (każdy obraz dodaje proporcjonalny kawałek)
 *   Po dojściu do 100% → czeka 300ms i chowa overlay
 *
 * Wydzielono z: WhiteboardCanvas.tsx linie 3587–3622 (był inline JSX w return).
 */

import NextImage from 'next/image';
import { useState, useEffect } from 'react';

// ─── Typy ────────────────────────────────────────────────────────────────────

interface LoadingOverlayProps {
  /** Czy overlay jest widoczny */
  isLoading: boolean;
  /** Postęp ładowania 0–100 */
  progress: number;
}

// ─── Komponent ───────────────────────────────────────────────────────────────

export function LoadingOverlay({ isLoading, progress }: LoadingOverlayProps) {
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowSlowHint(false);
      return;
    }
    // Pokaż hint po 8s gdy postęp utknął na 10% (baza danych się budzi)
    const timer = setTimeout(() => setShowSlowHint(true), 8000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="absolute inset-0 z-[9999] bg-white/20 backdrop-blur-md flex flex-col items-center justify-center">
      {/* Logo */}
      <div className="mb-8">
        <NextImage
          src="/resources/LogoEasyLesson.webp"
          alt="EasyLesson"
          width={200}
          height={80}
          style={{ width: 'auto', height: 'auto' }}
          priority
        />
      </div>

      {/* Pasek postępu */}
      <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Tekst */}
      <p className="mt-4 text-sm text-gray-600">
        Ładowanie tablicy... {Math.round(progress)}%
      </p>

      {/* Hint przy wolnym starcie bazy (Neon cold start) */}
      {showSlowHint && (
        <p className="mt-2 text-xs text-gray-400 max-w-xs text-center">
          Pierwsze połączenie może trwać do 30 sekund — baza danych się uruchamia.
        </p>
      )}
    </div>
  );
}
