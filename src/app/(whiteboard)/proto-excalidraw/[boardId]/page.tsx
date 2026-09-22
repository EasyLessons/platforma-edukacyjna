/**
 * /proto-excalidraw/[boardId] - PROTOTYP tablicy na Excalidraw + Yjs.
 *
 * Strona publiczna (bez logowania, poza matcherem middleware), boardId z URL.
 * Otwórz http://localhost:3100/proto-excalidraw/test-1 w dwóch kartach.
 * Parametr `?name=Patryk` ustawia nazwę przy kursorze.
 *
 * Excalidraw nie wspiera SSR - komponent jest ładowany przez next/dynamic
 * z ssr:false (patrz komentarz w features/whiteboard-excalidraw/components).
 */

'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const ExcalidrawBoard = dynamic(
  () =>
    import('@/_new/features/whiteboard-excalidraw/components/excalidraw-board').then(
      (m) => m.ExcalidrawBoard
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh items-center justify-center text-gray-600">Ładuję Excalidraw…</div>
    ),
  }
);

export default function ProtoExcalidrawPage() {
  const params = useParams<{ boardId: string }>();
  const boardId = typeof params?.boardId === 'string' ? params.boardId : '';
  const [username, setUsername] = useState<string | undefined>(undefined);

  useEffect(() => {
    const name = new URLSearchParams(window.location.search).get('name');
    if (name) setUsername(name);
  }, []);

  if (!boardId) {
    return (
      <div className="flex h-dvh items-center justify-center text-gray-600">
        Brak id tablicy w URL.
      </div>
    );
  }

  return (
    <div style={{ height: '100dvh', width: '100vw' }}>
      <ExcalidrawBoard boardId={boardId} username={username} />
    </div>
  );
}
