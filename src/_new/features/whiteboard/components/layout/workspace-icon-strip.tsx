/**
 * workspace-icon-strip.tsx
 *
 * Cienki pasek (48px) z ikonami workspace'ów użytkownika.
 * Zawsze widoczny po lewej stronie tablicy.
 *
 * - Ikona aktualnego workspace jest podświetlona
 * - Kliknięcie w inny workspace → przejście do /dashboard?workspace=ID
 * - Tooltip z nazwą workspace'u przy hoverze
 */

'use client';

import { useRouter } from 'next/navigation';
import { useWorkspaces } from '@/_new/features/workspace/hooks/useWorkspaces';
const WORKSPACE_STRIP_WIDTH = 48;

interface WorkspaceIconStripProps {
  /** ID aktualnego workspace'u (do podświetlenia) */
  activeWorkspaceId: number | null;
}

export function WorkspaceIconStrip({ activeWorkspaceId }: WorkspaceIconStripProps) {
  const router = useRouter();
  const { workspaces, loading } = useWorkspaces();

  const handleWorkspaceClick = (workspaceId: number) => {
    if (workspaceId === activeWorkspaceId) return;
    router.push(`/dashboard?workspace=${workspaceId}`);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: `${WORKSPACE_STRIP_WIDTH}px`,
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '12px',
        paddingBottom: '12px',
        gap: '6px',
        backgroundColor: '#f8f9fa',
        borderRight: '1px solid #e5e7eb',
        boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Ikona powrotu do dashboardu */}
      <WorkspaceStripItem
        title="Dashboard"
        bgColor="#6366f1"
        icon="🏠"
        isActive={false}
        onClick={() => router.push(activeWorkspaceId ? `/dashboard?workspace=${activeWorkspaceId}` : '/dashboard')}
      />

      <div style={{ width: '28px', height: '1px', backgroundColor: '#e5e7eb', margin: '2px 0' }} />

      {/* Workspace icons */}
      {loading ? (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '10px',
            backgroundColor: '#e5e7eb',
            animation: 'pulse 1.5s infinite',
          }}
        />
      ) : (
        workspaces.map((ws) => (
          <WorkspaceStripItem
            key={ws.id}
            title={ws.name}
            bgColor={ws.bg_color || '#6366f1'}
            icon={ws.icon || ws.name[0]?.toUpperCase() || '?'}
            isActive={ws.id === activeWorkspaceId}
            onClick={() => handleWorkspaceClick(ws.id)}
          />
        ))
      )}
    </div>
  );
}

// ─── Item ─────────────────────────────────────────────────────────────────────

interface WorkspaceStripItemProps {
  title: string;
  bgColor: string;
  icon: string;
  isActive: boolean;
  onClick: () => void;
}

function WorkspaceStripItem({ title, bgColor, icon, isActive, onClick }: WorkspaceStripItemProps) {
  return (
    <div style={{ position: 'relative' }} className="group">
      <button
        onClick={onClick}
        title={title}
        style={{
          width: '32px',
          height: '32px',
          borderRadius: isActive ? '10px' : '16px',
          backgroundColor: bgColor,
          border: isActive ? '2px solid #1d4ed8' : '2px solid transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          transition: 'border-radius 0.2s ease, transform 0.15s ease, box-shadow 0.15s ease',
          boxShadow: isActive ? '0 0 0 2px rgba(29, 78, 216, 0.3)' : '0 1px 4px rgba(0,0,0,0.15)',
          color: 'white',
          fontWeight: '600',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget;
          if (!isActive) btn.style.borderRadius = '10px';
          btn.style.transform = 'scale(1.1)';
          btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget;
          if (!isActive) btn.style.borderRadius = '16px';
          btn.style.transform = 'scale(1)';
          btn.style.boxShadow = isActive
            ? '0 0 0 2px rgba(29, 78, 216, 0.3)'
            : '0 1px 4px rgba(0,0,0,0.15)';
        }}
      >
        <span style={{ fontSize: '13px', userSelect: 'none' }}>{icon}</span>
      </button>

      {/* Tooltip */}
      <div
        style={{
          position: 'absolute',
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: '10px',
          backgroundColor: '#1f2937',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '500',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 300,
          opacity: 0,
          transition: 'opacity 0.15s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
        className="group-hover:opacity-100"
      >
        {title}
        <div
          style={{
            position: 'absolute',
            right: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            borderTop: '5px solid transparent',
            borderBottom: '5px solid transparent',
            borderRight: '5px solid #1f2937',
          }}
        />
      </div>
    </div>
  );
}
