/**
 * whiteboard-board-sidebar.tsx
 *
 * Boczny panel wyswietlajacy liste tablic aktualnego workspace'u.
 * Wyglad 1:1 z workspace-sidebar z dashboardu, ale zamiast workspaceow
 * wyswietla tablice nalezace do aktywnego workspace'u.
 *
 * Animacja wjazdu: translateX(-100%) => translateX(0) z CSS transition.
 * Zamkniecie: przycisk PanelLeftClose wewnatrz sidebaru lub toggle w headerze.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { PanelLeftClose, Search, Star, MoreVertical } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';
import { Input } from '@/_new/shared/ui/input';
import { useBoards } from '@/_new/features/board/hooks/useBoard';
import { useWorkspaces } from '@/_new/features/workspace/hooks/useWorkspaces';
import {
  getIconComponent as getBoardIconComponent,
  getGradientClass,
} from '@/_new/features/board/utils/helpers';
import {
  getIconComponent as getWorkspaceIconComponent,
  getColorClass,
} from '@/_new/features/workspace/utils/helpers';
import { SIDEBAR_WIDTH } from '../../hooks/use-whiteboard-sidebar';

interface WhiteboardBoardSidebarProps {
  workspaceId: number | null;
  activeBoardId: string | null;
  isOpen: boolean;
  onSettingsClick?: () => void;
  onClose: () => void;
  onHoverLeave: () => void;
}

export function WhiteboardBoardSidebar({
  workspaceId,
  activeBoardId,
  isOpen,
  onSettingsClick,
  onClose,
  onHoverLeave,
}: WhiteboardBoardSidebarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(workspaceId);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedWorkspaceId(workspaceId);
  }, [workspaceId]);

  const { boards, loading, error } = useBoards({
    workspace_id: selectedWorkspaceId,
    autoLoad: !!selectedWorkspaceId,
  });

  const { workspaces } = useWorkspaces();
  const workspace = workspaces.find((w) => w.id === selectedWorkspaceId);
  const workspaceName = workspace?.name ?? '';

  const filtered = boards.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBoardClick = (boardId: number) => {
    // Wymuszony pełny reload jak Ctrl+R, żeby cała tablica przeładowała stan.
    window.location.assign(`/tablica?boardId=${boardId}`);
  };

  return (
    <div
      onMouseLeave={onHoverLeave}
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: `${SIDEBAR_WIDTH}px`,
        zIndex: 190,
        backgroundColor: 'var(--dash-panel, #ffffff)',
        borderRight: '1px solid var(--dash-border, #e5e7eb)',
        boxShadow: '4px 0 16px rgba(0,0,0,0.08)',
        display: 'flex',
        flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        willChange: 'transform',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {/* GORNA CZESC: logo + przyciski */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--dash-border, #e5e7eb)',
          backgroundColor: 'var(--dash-panel, #ffffff)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}
        >
          <button
            onClick={() => router.push('/dashboard')}
            title="Przejdź do dashboardu"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Image
              src="/resources/LogoEasyLesson.webp"
              alt="EasyLesson"
              width={130}
              height={40}
              className="h-8 w-auto"
              priority
            />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {onSettingsClick && (
              <Button
                variant="secondary"
                size="icon"
                onClick={onSettingsClick}
                className="bg-transparent"
                title="Ustawienia tablicy"
              >
                <MoreVertical size={18} />
              </Button>
            )}
            <Button
              variant="secondary"
              size="icon"
              onClick={onClose}
              className="bg-transparent"
              title="Zamknij panel"
            >
              <PanelLeftClose size={18} />
            </Button>
          </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <p
            style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              lineHeight: '1.4',
            }}
            >
              PRZESTRZEN / {workspaceName || '-'}
          </p>
        </div>
      </div>

      {/* DOLNA CZESC: lewy cienki pasek workspace + prawa lista tablic */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div
          style={{
            width: '58px',
            borderRight: '1px solid var(--dash-border, #e5e7eb)',
            padding: '8px 6px',
            overflowY: 'auto',
          }}
        >
          {workspaces.map((ws) => {
            const WorkspaceIcon = getWorkspaceIconComponent(ws.icon);
            const colorClass = getColorClass(ws.bg_color);
            const isWorkspaceActive = ws.id === selectedWorkspaceId;
            return (
              <button
                key={ws.id}
                onClick={() => {
                  setSelectedWorkspaceId(ws.id);
                  setSearchQuery('');
                }}
                title={ws.name}
                className={`
                  group relative w-full flex justify-center p-2 rounded-lg
                  transition-all duration-200 cursor-pointer mb-1
                  ${isWorkspaceActive ? 'bg-[#ececef]' : 'hover:bg-[#f0f0f2]'}
                `}
              >
                <div
                  className={`
                    absolute left-0 top-1/2 -translate-y-1/2
                    bg-black rounded-r-full transition-all duration-200
                    ${isWorkspaceActive ? 'w-1 h-10' : 'w-0 group-hover:w-0.5 group-hover:h-10'}
                  `}
                />
                <div
                  className={`w-8 h-8 ${colorClass} rounded-lg flex items-center justify-center`}
                >
                  <WorkspaceIcon size={16} color="white" />
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 10px 8px' }}>
            <Input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj tablic..."
              leftIcon={<Search size={16} />}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
            {loading && (
              <p style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                Ladowanie tablic...
              </p>
            )}
            {error && (
              <p style={{ padding: '16px', textAlign: 'center', color: '#ef4444', fontSize: '13px' }}>
                Blad ladowania tablic
              </p>
            )}
            {!loading && !error && filtered.length === 0 && (
              <p style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                {searchQuery ? 'Brak wynikow' : 'Brak tablic w tej przestrzeni'}
              </p>
            )}

            {!loading &&
              filtered.map((board) => {
            const isActive = activeBoardId
              ? board.id === parseInt(activeBoardId, 10)
              : false;
            const IconComponent = getBoardIconComponent(board.icon);
            const gradientClass = getGradientClass(board.bg_color);

            return (
              <button
                key={board.id}
                onClick={() => handleBoardClick(board.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#ececef' : 'transparent',
                  textAlign: 'left',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = '#f0f0f2';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradientClass} flex items-center justify-center flex-shrink-0`}>
                  <IconComponent size={16} color="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: isActive ? '600' : '500',
                      color: '#111827',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {board.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                    {board.last_modified
                      ? new Date(board.last_modified).toLocaleDateString('pl-PL', {
                          day: 'numeric',
                          month: 'short',
                        })
                        : '\u2014'}
                  </div>
                </div>
                  {board.is_favourite && (
                  <Star size={13} style={{ color: '#f59e0b', flexShrink: 0, fill: '#f59e0b' }} />
                )}
              </button>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
