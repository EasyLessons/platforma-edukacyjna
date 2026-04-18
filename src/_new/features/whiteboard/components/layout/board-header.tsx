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
import { Tooltip } from '@/_new/shared/ui/tooltip';

interface BoardHeaderProps {
  boardName: string;
  boardIcon?: string;
  boardBgColor?: string;
  boardId: string;
  workspaceId: number | null;
  isSidebarOpen?: boolean;
  onSidebarToggle?: () => void;
  onSettingsClick?: () => void;
}

export function BoardHeader({
  boardName,
  boardIcon = 'PenTool',
  boardBgColor = 'gray-500',
  boardId,
  workspaceId,
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
  const dashboardHref = workspaceId ? `/dashboard?workspace=${workspaceId}` : '/dashboard';

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
            <Tooltip content="Wróć do panelu" position="bottom">
              <button
                onClick={() => router.push(dashboardHref)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
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
              </button>
            </Tooltip>

           

            {/* Sidebar toggle (po prawej stronie logo) */}
            {onSidebarToggle && (
              <Tooltip content={isSidebarOpen ? 'Zamknij panel' : 'Wysuń panel tablic'} position="bottom" className='ml-2'>
                <button
                  onClick={onSidebarToggle}
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
              </Tooltip>
            )}

            

            {/* Przycisk ustawień tablicy */}
            {onSettingsClick && (
              <Tooltip content="Ustawienia tablicy" position="bottom" className='ml-3 '>
                <button
                  onClick={onSettingsClick}
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
              </Tooltip>
            )}

           

            {/* Ikona + nazwa aktualnej tablicy (z danych tablicy) */}
            <Tooltip content={boardName || 'Tablica'} position="bottom">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  maxWidth: '160px',
                  minWidth: 0,
                  color: '#374151',
                  cursor: 'default',
                }}
              >
                <div
                  className={`ml-3 w-6 h-6 rounded-md bg-gradient-to-br ${boardGradient} flex items-center justify-center flex-shrink-0`}
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
            </Tooltip>

            {showUpgradeButton && (
              <>
                

                <Tooltip content="Zmień wersję na premium" position="bottom">
                  <Button
                    onClick={() => router.push('/#pricing')}
                    variant="secondary"
                    size="sm"
                  className="font-semibold ml-4 -mr-[5px] hover-shine h-10 rounded-lg  bg-gray-200 hover:bg-gray-200 text-gray-700  whitespace-nowrap transition-all duration-300 ease-in-out"
                >
                  Zmień wersję
                </Button>
                </Tooltip>
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
              boxShadow: '0 4px 4px rgba(0,0,0,0.1)',
              pointerEvents: 'auto',
            }}
          >
            <Tooltip content="Wróć do panelu" position="bottom">
              <button
                onClick={() => router.push(dashboardHref)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
                onMouseLeave={(e) => {
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
              </button>
            </Tooltip>

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
              <Tooltip content={isSidebarOpen ? 'Zamknij panel' : 'Wysuń panel tablic'} position="bottom">
                <button
                  onClick={onSidebarToggle}
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
              </Tooltip>
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
              <Tooltip content="Ustawienia tablicy" position="bottom">
                <button
                  onClick={onSettingsClick}
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
              </Tooltip>
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
            <Tooltip content={isSidebarOpen ? 'Zamknij panel' : 'Wysuń panel tablic'} position="right">
              <button
                onClick={onSidebarToggle}
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
            </Tooltip>
          )}

          {showSettingsInFallback && onSettingsClick && (
            <Tooltip content="Ustawienia tablicy" position="right">
              <button
                onClick={onSettingsClick}
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
            </Tooltip>
          )}
        </div>
      )}
    </>
  );
}
