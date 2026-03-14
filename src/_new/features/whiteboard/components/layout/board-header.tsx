/**
 * ============================================================================
 * PLIK: board-header.tsx
 * ============================================================================
 *
 * PRZEZNACZENIE:
 * Nagłówek tablicy z:
 * - Przyciskiem toggle sidebaru (skrajnie po lewej)
 * - Logo EasyLesson (link powrotu do dashboardu)
 * - Opcjonalnym przyciskiem ustawień tablicy
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import { PanelLeftOpen, PanelLeftClose, MoreVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  getIconComponent as getBoardIconComponent,
  getGradientClass,
} from '@/_new/features/board/utils/helpers';
import { Button } from '@/_new/shared/ui/button';
import { useWhiteboardUiMetrics } from '@/_new/features/whiteboard/hooks/use-whiteboard-ui-metrics';

interface BoardHeaderProps {
  boardName: string;
  boardIcon?: string;
  boardBgColor?: string;
  boardId: string;
  isSidebarOpen?: boolean;
  onSidebarToggle?: () => void;
  onSettingsClick?: () => void;
}

export function BoardHeader({
  boardName,
  boardIcon = 'PenTool',
  boardBgColor = 'gray-500',
  boardId,
  isSidebarOpen = false,
  onSidebarToggle,
  onSettingsClick,
}: BoardHeaderProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const router = useRouter();
  const metrics = useWhiteboardUiMetrics();

  const showFullHeader = metrics.showFullHeader;
  const showCompactHeader = metrics.showCompactHeader;
  const showSettingsInFallback = showCompactHeader;
  const showUpgradeButton = metrics.windowWidth >= 1874;
  const BoardIcon = getBoardIconComponent(boardIcon);
  const boardGradient = getGradientClass(boardBgColor);

  return (
    <>
      {/* Główny nagłówek — widoczny tylko przy szerokości >= 1640px */}
      {showFullHeader && (
        <div
          style={{
            position: 'absolute',
            top: `${metrics.spacing.top}px`,
            left: `${metrics.spacing.side}px`,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            pointerEvents: 'none',
          }}
        >
          {/* Biały box: [Logo] + [Sidebar toggle] + [Settings?] */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0px',
              padding: '0 12px',
              height: '56px',
              backgroundColor: 'white',
              border: '2px solid #e0e0e0',
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              pointerEvents: 'auto',
            }}
          >
            {/* Logo — link powrotu do dashboardu */}
            <button
              onClick={() => router.push('/dashboard')}
              onMouseEnter={(e) => {
                setShowTooltip(true);
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                setShowTooltip(false);
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              style={{
                padding: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                borderRadius: '8px',
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
                      borderBottom: '6px solid #1f2937',
                    }}
                  />
                </div>
              )}
            </button>

            {/* Separator przed togglem */}
            {onSidebarToggle && (
              <div
                style={{
                  marginLeft: '8px',
                  marginRight: '8px',
                  width: '1px',
                  height: '28px',
                  backgroundColor: '#e5e7eb',
                }}
              />
            )}

            {/* Sidebar toggle (po prawej stronie logo) */}
            {onSidebarToggle && (
              <button
                onClick={onSidebarToggle}
                title={isSidebarOpen ? 'Zamknij panel' : 'Otwórz panel tablic'}
                style={{
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#374151',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
              </button>
            )}

            {/* Separator przed ustawieniami */}
            {onSettingsClick && (
              <div
                style={{
                  marginLeft: '8px',
                  marginRight: '8px',
                  width: '1px',
                  height: '28px',
                  backgroundColor: '#e5e7eb',
                }}
              />
            )}

            {/* Przycisk ustawień tablicy */}
            {onSettingsClick && (
              <button
                onClick={onSettingsClick}
                title="Ustawienia tablicy"
                style={{
                  padding: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <MoreVertical size={18} color="#6b7280" />
              </button>
            )}

            {/* Separator przed nazwą tablicy */}
            <div
              style={{
                marginLeft: '8px',
                marginRight: '8px',
                width: '1px',
                height: '28px',
                backgroundColor: '#e5e7eb',
              }}
            />

            {/* Ikona + nazwa aktualnej tablicy (z danych tablicy) */}
            <div
              title={boardName}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                maxWidth: '260px',
                minWidth: 0,
                color: '#374151',
              }}
            >
              <div
                className={`w-6 h-6 rounded-md bg-gradient-to-br ${boardGradient} flex items-center justify-center flex-shrink-0`}
              >
                <BoardIcon size={13} color="white" />
              </div>
              <span
                style={{
                  display: 'block',
                  minWidth: 0,
                  fontSize: '13px',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {boardName || 'Tablica'}
              </span>
            </div>

            {showUpgradeButton && (
              <>
                {/* Separator przed przyciskiem zmiany wersji */}
                <div
                  style={{
                    marginLeft: '8px',
                    marginRight: '8px',
                    width: '1px',
                    height: '28px',
                    backgroundColor: '#e5e7eb',
                  }}
                />

                <Button
                  onClick={() => router.push('/#pricing')}
                  variant="secondary"
                  size="sm"
                  title="Przejdź do sekcji pricing"
                  className="ml-1 hover-shine h-10 rounded-lg  bg-gray-200 hover:bg-gray-200 text-gray-700 px-3 whitespace-nowrap transition-all duration-300 ease-in-out"
                >
                  Zmień wersję
                </Button>
              </>
            )}

          
          </div>
        </div>
      )}

      {showCompactHeader && !showFullHeader && (
        <div
          style={{
            position: 'absolute',
            top: `${metrics.spacing.top}px`,
            left: `${metrics.spacing.side}px`,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0px',
              padding: '0 12px',
              height: '56px',
              backgroundColor: 'white',
              border: '2px solid #e0e0e0',
              borderRadius: '16px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              pointerEvents: 'auto',
            }}
          >
            <button
              onClick={() => router.push('/dashboard')}
              onMouseEnter={(e) => {
                setShowTooltip(true);
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseLeave={(e) => {
                setShowTooltip(false);
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              style={{
                padding: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                borderRadius: '8px',
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
                      borderBottom: '6px solid #1f2937',
                    }}
                  />
                </div>
              )}
            </button>

            {onSidebarToggle && (
              <div
                style={{
                  marginLeft: '8px',
                  marginRight: '8px',
                  width: '1px',
                  height: '28px',
                  backgroundColor: '#e5e7eb',
                }}
              />
            )}

            {onSidebarToggle && (
              <button
                onClick={onSidebarToggle}
                title={isSidebarOpen ? 'Zamknij panel' : 'Otwórz panel tablic'}
                style={{
                  padding: '6px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#374151',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
              </button>
            )}

            {onSettingsClick && (
              <div
                style={{
                  marginLeft: '8px',
                  marginRight: '8px',
                  width: '1px',
                  height: '28px',
                  backgroundColor: '#e5e7eb',
                }}
              />
            )}

            {onSettingsClick && (
              <button
                onClick={onSettingsClick}
                title="Ustawienia tablicy"
                style={{
                  padding: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f2';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <MoreVertical size={18} color="#6b7280" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fallback — wąskie ekrany (< 1550px): sidebar toggle + ustawienia */}
      {!showFullHeader && !showCompactHeader && (
        <div
          style={{
            position: 'absolute',
            top: `${metrics.spacing.top}px`,
            left: `${metrics.spacing.side}px`,
            zIndex: 100,
            display: 'flex',
            flexDirection: metrics.boardHeader.fallbackStackVertical ? 'column' : 'row',
            gap: `${metrics.spacing.gap}px`,
          }}
        >
          {onSidebarToggle && (
            <button
              onClick={onSidebarToggle}
              title={isSidebarOpen ? 'Zamknij panel' : 'Otwórz panel tablic'}
              style={{
                width: `${metrics.boardHeader.fallbackButtonSize}px`,
                height: `${metrics.boardHeader.fallbackButtonSize}px`,
                backgroundColor: 'white',
                border: '2px solid #e0e0e0',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#374151',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
              }}
            >
              {isSidebarOpen ? (
                <PanelLeftClose size={metrics.boardHeader.fallbackIconSize} />
              ) : (
                <PanelLeftOpen size={metrics.boardHeader.fallbackIconSize} />
              )}
            </button>
          )}

          {showSettingsInFallback && onSettingsClick && (
            <button
              onClick={onSettingsClick}
              title="Ustawienia tablicy"
              style={{
                width: `${metrics.boardHeader.fallbackButtonSize}px`,
                height: `${metrics.boardHeader.fallbackButtonSize}px`,
                backgroundColor: 'white',
                border: '2px solid #e0e0e0',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
              }}
            >
              <MoreVertical size={metrics.boardHeader.fallbackIconSize} color="#6b7280" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
