/**
 * ============================================================================
 * PLIK: src/app/tablica/components/BoardHeader.tsx
 * ============================================================================
 * 
 * PRZEZNACZENIE:
 * Nagłówek tablicy z:
 * - Logo EasyLesson (po lewej)
 * - Przyciskiem "Zobacz plan Premium" (po prawej)
 * ============================================================================
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface BoardHeaderProps {
  boardName: string;
  boardId: string;
}

export function BoardHeader({ boardName, boardId }: BoardHeaderProps) {
  const [showComparison, setShowComparison] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [windowWidth, setWindowWidth] = useState(0);
  const [windowHeight, setWindowHeight] = useState(0);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Monitoruj szerokość i wysokość okna
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    handleResize(); // Inicjalne ustawienie
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showLogo = windowWidth > 1550;

  const handlePremiumClick = () => {
    router.push('/#pricing');
    setShowComparison(false);
  };

  return (
    <>
      {/* Główny nagłówek - cały ukrywany poniżej 1550px */}
      {showLogo && (
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          right: '16px',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          pointerEvents: 'none',
        }}
      >
        {/* Biały box z logo + przyciskiem premium */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0px',
            padding: '8px 12px 8px 12px',
            backgroundColor: 'white',
            border: '2px solid #e0e0e0',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            minWidth: '400px',
            pointerEvents: 'auto',
          }}
        >
          {/* Logo z przyciskiem powrotu - ukrywane poniżej 1550px */}
          {showLogo && (
            <button
              onClick={() => router.push('/dashboard')}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              style={{
                padding: '4px 1px 4px 4px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                borderRadius: '8px',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            }}
          >
            <Image
              src="/resources/LogoEasyLesson.webp"
              alt="EasyLesson Logo"
              width={160}
              height={50}
              className="h-9 w-auto"
              priority
            />

            {/* Tooltip */}
            {showTooltip && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: '8px',
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
          )}

          {/* Separator - ukrywany poniżej 1550px */}
          {showLogo && (
            <div
              style={{
              marginLeft: '8px',
              marginRight: '8px',
              width: '1px',
              height: '32px',
              backgroundColor: '#e5e7eb',
            }}
          />
          )}

          {/* Przycisk Premium */}
          <div style={{ position: 'relative' }}>
            <button
              onMouseEnter={() => {
                // Anuluj zamykanie
                if (closeTimeoutRef.current) {
                    clearTimeout(closeTimeoutRef.current);
                }
                setShowComparison(true);
                }}
                onMouseLeave={() => {
                // Zamknij po 200ms (czas na wjechanie na okienko)
                closeTimeoutRef.current = setTimeout(() => {
                    setShowComparison(false);
                }, 200);
                }}
              onClick={handlePremiumClick}
              style={{
                padding: '8px 20px',
                background: 'linear-gradient(135deg, #e0e0e0ff  0%, #e0e0e0ff  100%)',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(174, 174, 174, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 16px rgba(192, 192, 192, 0.35)';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(192, 192, 192, 0.25)';
              }}
            >
              <Sparkles className="w-5 h-5 text-gray-600 font-bold" />
              <span style={{
                fontSize: '14px',
                fontWeight: '400',
                color: 'black',
              }}>
                Zobacz plan Premium
              </span>
            </button>

            {/* Tabela porównawcza - pojawia się na hover */}
            {showComparison && (
              <div
                onMouseEnter={() => {
                // Jak wjedziemy na okienko - anuluj zamykanie
                if (closeTimeoutRef.current) {
                    clearTimeout(closeTimeoutRef.current);
                }
                }}
                onMouseLeave={() => {
                // Jak zjedziemy - zamknij od razu
                setShowComparison(false);
                }}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: '1',
                  marginTop: '12px',
                  backgroundColor: 'white',
                  border: '2px solid #e5e7eb',
                  borderRadius: '16px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                  padding: '20px',
                  minWidth: '420px',
                  maxHeight: windowHeight > 0 ? `${windowHeight - 120}px` : 'none',
                  overflowY: 'auto',
                  zIndex: 101,
                }}
              >
                {/* Strzałka wskazująca na przycisk */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '24px',
                    width: '0',
                    height: '0',
                    borderLeft: '10px solid transparent',
                    borderRight: '10px solid transparent',
                    borderBottom: '10px solid #e5e7eb',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '25px',
                    width: '0',
                    height: '0',
                    borderLeft: '9px solid transparent',
                    borderRight: '9px solid transparent',
                    borderBottom: '9px solid white',
                  }}
                />

                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#1f2937',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <Sparkles className="w-5 h-5 text-green-600" />
                  Dlaczego Premium?
                </h3>

                {/* Placeholder na filmik YouTube */}
                <div style={{
                  width: '100%',
                  height: '200px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '12px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed #d1d5db',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    textAlign: 'center',
                    color: '#6b7280',
                  }}>
                    <svg 
                      style={{ width: '48px', height: '48px', margin: '0 auto 8px' }}
                      fill="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>
                      Filmik YouTube
                    </div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>
                      Link do wideo zostanie dodany wkrótce
                    </div>
                  </div>
                </div>

                <table style={{
                  width: '100%',
                  borderCollapse: 'separate',
                  borderSpacing: '0 8px',
                }}>
                  <thead>
                    <tr>
                      <th style={{
                        textAlign: 'left',
                        padding: '8px 12px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#6b7280',
                      }}>
                        Funkcja
                      </th>
                      <th style={{
                        textAlign: 'center',
                        padding: '8px 12px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#6b7280',
                      }}>
                        Free
                      </th>
                      <th style={{
                        textAlign: 'center',
                        padding: '8px 12px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#059669',
                        background: 'linear-gradient(135deg, #f3f4f6 0%, #d1fae5 100%)',
                        borderRadius: '8px',
                      }}>
                        Premium
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <ComparisonRow
                      feature="Liczba workspace'ów"
                      free="3"
                      premium="Nielimitowane"
                    />
                    <ComparisonRow
                      feature="Liczba tablic"
                      free="3"
                      premium="Nielimitowane"
                    />
                    <ComparisonRow
                      feature="Współpraca realtime"
                      free="2 osoby"
                      premium="Do 50 osób"
                    />
                    <ComparisonRow
                      feature="Ilość elementów na tablicy"
                      free="500 elementów"
                      premium="Nielimitowane"
                    />
                    <ComparisonRow
                      feature="Chat na tablicy"
                      free="5 wiadomości"
                      premium="Nielimitowane"
                    />
                    <ComparisonRow
                      feature="Zaawansowane narzędzia (rysowanie funkcji, kalulator itp.)"
                      free="✗"
                      premium="✓"
                    />
                  </tbody>
                </table>

                <button
                  onClick={handlePremiumClick}
                  style={{
                    width: '100%',
                    marginTop: '16px',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #00ca4aff   0%, #00ca4aff   100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(205, 205, 205, 0.3)',
                  }}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)';
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
                  }}
                >
                  Zobacz plan Premium →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </>
  );
}

// Komponent pomocniczy dla wiersza porównania
function ComparisonRow({ feature, free, premium }: { feature: string; free: string; premium: string }) {
  return (
    <tr style={{
      backgroundColor: '#f9fafb',
      borderRadius: '8px',
    }}>
      <td style={{
        padding: '10px 12px',
        fontSize: '13px',
        color: '#374151',
        fontWeight: '500',
        borderTopLeftRadius: '8px',
        borderBottomLeftRadius: '8px',
      }}>
        {feature}
      </td>
      <td style={{
        padding: '10px 12px',
        fontSize: '13px',
        color: '#6b7280',
        textAlign: 'center',
      }}>
        {free}
      </td>
      <td style={{
        padding: '10px 12px',
        fontSize: '13px',
        color: '#059669',
        fontWeight: '600',
        textAlign: 'center',
        borderTopRightRadius: '8px',
        borderBottomRightRadius: '8px',
      }}>
        {premium}
      </td>
    </tr>
  );
}