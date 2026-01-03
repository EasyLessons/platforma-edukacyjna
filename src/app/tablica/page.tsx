/**
 * ============================================================================
 * PLIK: src/app/tablica/page.tsx - FINAL VERSION
 * ============================================================================
 * 
 * 🎯 SCALENIE:
 * - Oryginalny layout (przycisk powrotu, logo, tooltip)
 * - BoardRealtimeProvider (synchronizacja)
 * - boardId z query params
 * 
 * IMPORTUJE Z:
 * - next/navigation (useRouter, useSearchParams)
 * - next/image (Image)
 * - ./whiteboard/WhiteboardCanvas (główny komponent tablicy)
 * - ../context/BoardRealtimeContext (synchronizacja realtime)
 * 
 * PRZEZNACZENIE:
 * Strona /tablica z pełnoekranową tablicą, synchronizacją realtime,
 * i przyciskiem powrotu do dashboardu.
 * ============================================================================
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Suspense, useState, useEffect } from 'react';
import WhiteboardCanvas from './whiteboard/WhiteboardCanvas';
import { BoardRealtimeProvider } from '../context/BoardRealtimeContext';
import { joinBoardWorkspace, fetchBoardById } from '@/boards_api/api';
import { BoardHeader } from './components/BoardHeader';
import { HomeButton } from './components/HomeButton';

// ═══════════════════════════════════════════════════════════════════════════
// GŁÓWNY KOMPONENT (z Suspense dla useSearchParams)
// ═══════════════════════════════════════════════════════════════════════════

export function TablicaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showTooltip, setShowTooltip] = useState(false);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [boardName, setBoardName] = useState<string>('Moja tablica');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Pobierz boardId z URL query params i dołącz do workspace
  useEffect(() => {
    const id = searchParams.get('boardId') || 'demo-board';
    setBoardId(id);
    console.log('📋 Board ID:', id);
    
    // Pobierz dane tablicy z bazy
    const loadBoardData = async () => {
      try {
        const board = await fetchBoardById(id);
        if (board) {
          setBoardName(board.name);
          console.log('✅ Załadowano dane tablicy:', board.name);
        }
      } catch (error) {
        console.error('❌ Błąd ładowania danych tablicy:', error);
      }
    };
    
    loadBoardData();
    
    // Automatyczne dołączenie do workspace przy wejściu przez link
    const joinWorkspace = async () => {
      if (id && id !== 'demo-board') {
        const numericId = parseInt(id, 10);
        if (!isNaN(numericId)) {
          try {
            setIsJoining(true);
            const result = await joinBoardWorkspace(numericId);
            console.log('✅ Join workspace result:', result);
            if (!result.already_member) {
              console.log('🆕 Dołączono do nowego workspace!');
            }
          } catch (error: any) {
            console.error('❌ Błąd dołączania do workspace:', error);
            // Nie blokujemy - użytkownik może nie być zalogowany
            if (error.message?.includes('Brak tokenu')) {
              setJoinError('Zaloguj się, aby edytować tablicę');
            }
          } finally {
            setIsJoining(false);
          }
        }
      }
    };
    
    joinWorkspace();
  }, [searchParams]);

  // Loading state
  if (!boardId) {
    return (
      <div className="w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Ładowanie tablicy...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'white',
      overflow: 'hidden'
    }}>
      {/* Komunikat o dołączaniu / błędzie */}
      {isJoining && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg shadow-md z-[200] flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Dołączanie do tablicy...</span>
        </div>
      )}
      {joinError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-lg shadow-md z-[200]">
          {joinError}
        </div>
      )}
      
      {/* Home Button - pojawia się gdy BoardHeader jest ukryty (poniżej 1550px) */}
      <HomeButton />

      {/* Nagłówek z logo, nazwą tablicy i przyciskiem premium */}
      <BoardHeader boardName={boardName} boardId={boardId} />

      {/* 🆕 REALTIME PROVIDER - Opakowuje WhiteboardCanvas */}
      <BoardRealtimeProvider boardId={boardId}>
        <WhiteboardCanvas boardId={boardId} />
      </BoardRealtimeProvider>

      {/* Style dla animacji */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(0px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT (z Suspense)
// ═══════════════════════════════════════════════════════════════════════════

export default function TablicaPage() {
  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Inicjalizacja...</p>
          </div>
        </div>
      }
    >
      <TablicaContent />
    </Suspense>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 JAK UŻYWAĆ
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * URL:
 * /tablica?boardId=123  → Tablica o ID 123
 * /tablica              → Domyślna tablica "demo-board"
 * 
 * PRZYKŁAD LINKU Z DASHBOARD:
 * <Link href="/tablica?boardId=456">Otwórz tablicę</Link>
 * 
 * CO DZIAŁA:
 * ✅ Przycisk powrotu (logo EasyLesson) w lewym górnym rogu
 * ✅ Tooltip "Wróć do panelu" po najechaniu
 * ✅ Synchronizacja realtime przez BoardRealtimeProvider
 * ✅ boardId z URL query params
 * ✅ Lista użytkowników online (OnlineUsers w WhiteboardCanvas)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */