/**
 * ============================================================================
 * PLIK: src/app/tablica/components/HomeButton.tsx
 * ============================================================================
 * 
 * PRZEZNACZENIE:
 * Przycisk powrotu do dashboardu (Home) - pojawia się gdy BoardHeader znika
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { Home } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function HomeButton() {
  const [windowWidth, setWindowWidth] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pokazuj tylko gdy BoardHeader jest ukryty (poniżej 1550px)
  if (windowWidth > 1550) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 100,
      }}
    >
      <button
        onClick={() => window.location.href = '/dashboard'}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          padding: '10px',
          backgroundColor: 'white',
          border: '2px solid #e0e0e0',
          borderRadius: '12px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
        onMouseOver={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f9fafb';
        }}
        onMouseOut={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'white';
        }}
      >
        <Home className="w-5 h-5 text-gray-500 m-2" />

        {/* Tooltip */}
        {showTooltip && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginTop: '8px',
              backgroundColor: '#000000ff',
              color: 'white',
              padding: '8px 14px',
              borderRadius: '102px',
              fontSize: '13px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
              zIndex: 101,
            }}
          >
            Wróć do panelu
            <div
              style={{
                position: 'absolute',
                top: '-6px',
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
      </button>
    </div>
  );
}
