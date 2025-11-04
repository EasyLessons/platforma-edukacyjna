/**
 * ============================================================================
 * PLIK: src/app/tablica/page.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - next/navigation (useRouter)
 * - next/dynamic (dynamic import)
 * - ./whiteboard/WhiteboardCanvas (główny komponent tablicy)
 * 
 * EKSPORTUJE:
 * - Tablica (default) - główna strona tablicy interaktywnej
 * 
 * PRZEZNACZENIE:
 * Strona Next.js dla routy /tablica. Renderuje pełnoekranową tablicę
 * z przyciskiem powrotu do dashboardu. Używa dynamic import dla WhiteboardCanvas
 * z wyłączonym SSR (client-side only).
 * ============================================================================
 */

'use client';

import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// NOWY IMPORT - z refaktoryzowanego folderu whiteboard/
const WhiteboardCanvas = dynamic(
  () => import('./whiteboard/WhiteboardCanvas'),
  { ssr: false }
);

export default function Tablica() {
  const router = useRouter();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'white',
      overflow: 'hidden'
    }}>
      {/* Ikonka powrotu - lewy górny róg */}
      <button
        onClick={() => router.push('/dashboard')}
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 100,
          padding: '12px',
          fontSize: '20px',
          fontWeight: '600',
          color: '#2c3e50',
          backgroundColor: 'white',
          border: '2px solid #e0e0e0',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        onMouseOver={(e) => {
          (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
          (e.target as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        }}
        onMouseOut={(e) => {
          (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
          (e.target as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        }}
        title="Wróć do dashboard"
      >
        🏠
      </button>

      {/* Pełnoekranowa tablica */}
      <WhiteboardCanvas />
    </div>
  );
}

//przed refaktoringiem
// 'use client';

// import { useRouter } from 'next/navigation';
// import dynamic from 'next/dynamic';

// // Dynamic import z SSR disabled dla komponentu canvas
// const WhiteboardCanvas = dynamic(
//   () => import('./whiteboard-components/WhiteboardCanvas'),
//   { ssr: false }
// );

// export default function Tablica() {
//   const router = useRouter();

//   return (
//     <div style={{
//       position: 'fixed',
//       inset: 0,
//       background: 'white',
//       overflow: 'hidden'
//     }}>
//       {/* Ikonka powrotu - lewy górny róg */}
//       <button
//         onClick={() => router.push('/dashboard')}
//         style={{
//           position: 'absolute',
//           top: '16px',
//           left: '16px',
//           zIndex: 100,
//           padding: '12px',
//           fontSize: '20px',
//           fontWeight: '600',
//           color: '#2c3e50',
//           backgroundColor: 'white',
//           border: '2px solid #e0e0e0',
//           borderRadius: '8px',
//           cursor: 'pointer',
//           transition: 'all 0.2s',
//           boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
//           display: 'flex',
//           alignItems: 'center',
//           gap: '8px'
//         }}
//         onMouseOver={(e) => {
//           (e.target as HTMLButtonElement).style.transform = 'translateY(-2px)';
//           (e.target as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
//         }}
//         onMouseOut={(e) => {
//           (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
//           (e.target as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
//         }}
//         title="Wróć do dashboard"
//       >
//         🏠
//       </button>

//       {/* Pełnoekranowa tablica */}
//       <WhiteboardCanvas />
//     </div>
//   );
// } 