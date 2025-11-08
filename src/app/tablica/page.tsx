/**
 * ============================================================================
 * PLIK: src/app/tablica/page.tsx
 * ============================================================================
 * 
 * IMPORTUJE Z:
 * - next/navigation (useRouter)
 * - next/dynamic (dynamic import)
 * - next/image (Image)
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
import Image from 'next/image';
import { useState } from 'react';

// NOWY IMPORT - z refaktoryzowanego folderu whiteboard/
const WhiteboardCanvas = dynamic(
  () => import('./whiteboard/WhiteboardCanvas'),
  { ssr: false }
);

export default function Tablica() {
  const router = useRouter();
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'white',
      overflow: 'hidden'
    }}>
      {/* Logo powrotu - lewy górny róg */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 100,
        }}
      >
        <button
          onClick={() => router.push('/dashboard')}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          style={{
            padding: '8px 12px',
            backgroundColor: 'white',
            border: '2px solid #e0e0e0',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            position: 'relative'
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          }}
        >
          <Image
            src="/resources/LogoEasyLesson.webp"
            alt="EasyLesson Logo"
            width={160}
            height={50}
            className="h-11 w-auto"
            priority
          />
        </button>

        {/* Tooltip POD logo */}
        {showTooltip && (
          <div
            style={{
              position: 'absolute',
              top: '100%', // Umieszczamy pod przyciskiem
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '8px', // Dodajemy odstęp od przycisku
              backgroundColor: '#1f2937',
              color: 'white',
              padding: '8px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
              zIndex: 101,
              animation: 'fadeIn 0.2s ease-in-out'
            }}
          >
            Wróć do panelu
            {/* Strzałka tooltipa - na górze wskazująca w górę na przycisk */}
            <div
              style={{
                position: 'absolute',
                top: '-6px', // Umieszczamy nad tooltipem
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderBottom: '6px solid #1f2937'
              }}
            />
          </div>
        )}
      </div>

      {/* Pełnoekranowa tablica */}
      <WhiteboardCanvas />

      {/* Style dla animacji */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-8px);
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