/**
 * board-settings-panel.tsx
 *
 * Panel ustawień tablicy — dostępny tylko dla właściciela.
 *
 * ZAKŁADKI:
 *  - Ustawienia: toggles (AI, siatka, SmartSearch, Toolbar)
 *  - Członkowie: lista + zmiana roli workspace-level
 *
 * ARCHITEKTURA:
 *  - Podejście A: brak board-level roles — role pochodzą z WorkspaceMember.role
 *  - Ustawienia persystują w Board.settings (JSONB) przez backend
 *  - Toggles są propami przekazywanymi do whiteboard-canvas
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Settings, Users, Bot, Grid3X3, Search, PanelLeft, Crown, Shield, User, Eye, ChevronDown, Check, Loader2 } from 'lucide-react';
import type { BoardSettings, BoardMember } from '@/_new/features/board/types';
import { fetchBoardMembers, updateBoardSettings, updateBoardMemberRole } from '@/_new/features/board/api/boardApi';
import { useUserAvatar } from '@/_new/shared/hooks/use-user-avatar';

// ─── TYPY ───────────────────────────────────────────────────────────────────

interface BoardSettingsPanelProps {
  boardId: number;
  isOwner: boolean;
  settings: BoardSettings;
  onSettingsChange: (settings: BoardSettings) => void;
  onClose: () => void;
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  editor:  { label: 'Edytor',      icon: Shield, color: '#3b82f6', bg: '#dbeafe' },
  viewer: { label: 'Obserwator', icon: Eye,    color: '#8b5cf6', bg: '#ede9fe' },
} as const;

type Role = keyof typeof ROLE_CONFIG;

function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '2px 8px', borderRadius: '99px',
        backgroundColor: cfg.bg, color: cfg.color,
        fontSize: '12px', fontWeight: 600,
      }}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ─── TOGGLE ROW ──────────────────────────────────────────────────────────────

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ icon, label, description, value, disabled, onChange }: ToggleRowProps) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', borderRadius: '10px',
        backgroundColor: '#f9fafb', marginBottom: '8px',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ color: value ? '#212224' : '#9ca3af', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{label}</div>
        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{description}</div>
      </div>
      <button
        disabled={disabled}
        onClick={() => onChange(!value)}
        style={{
          width: '44px', height: '24px', borderRadius: '99px', border: 'none',
          cursor: disabled ? 'default' : 'pointer',
          backgroundColor: value ? '#212224' : '#d1d5db',
          position: 'relative', transition: 'background-color 0.2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute', top: '2px',
            left: value ? '22px' : '2px',
            width: '20px', height: '20px', borderRadius: '50%',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.2s',
          }}
        />
      </button>
    </div>
  );
}

// ─── ROLE SELECT DROPDOWN ────────────────────────────────────────────────────

interface RoleSelectProps {
  currentRole: Role;
  userId: number;
  boardId: number;
  onRoleChange: (userId: number, newRole: 'editor' | 'viewer') => void;
  saving: boolean;
}

function RoleSelect({ currentRole, userId, boardId, onRoleChange, saving }: RoleSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const options: Array<'editor' | 'viewer'> = ['editor', 'viewer'];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        disabled={saving}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '4px 8px', borderRadius: '6px',
          border: '1px solid #e5e7eb', backgroundColor: 'white',
          cursor: saving ? 'default' : 'pointer', fontSize: '13px',
        }}
      >
        {saving
          ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
          : <RoleBadge role={currentRole} />}
        <ChevronDown size={12} style={{ color: '#6b7280' }} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute', right: 0, top: '100%', marginTop: '4px',
            backgroundColor: 'white', border: '1px solid #e5e7eb',
            borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 200, minWidth: '140px', overflow: 'hidden',
          }}
        >
          {options.map((role) => (
            <button
              key={role}
              onClick={() => { onRoleChange(userId, role); setOpen(false); }}
              style={{
                width: '100%', padding: '8px 12px', textAlign: 'left',
                border: 'none', backgroundColor: role === currentRole ? '#f9fafb' : 'white',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', gap: '8px',
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = role === currentRole ? '#f9fafb' : 'white'; }}
            >
              <RoleBadge role={role} />
              {role === currentRole && <Check size={12} style={{ color: '#212224' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── GŁÓWNY KOMPONENT ────────────────────────────────────────────────────────

export function BoardSettingsPanel({
  boardId,
  isOwner,
  settings,
  onSettingsChange,
  onClose,
}: BoardSettingsPanelProps) {
  const { getAvatarColorClass, getInitials } = useUserAvatar();
  const [tab, setTab] = useState<'settings' | 'members'>('settings');
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [savingRoles, setSavingRoles] = useState<Set<number>>(new Set());
  const [settingsSaving, setSettingsSaving] = useState(false);
  const settingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Załaduj członków przy otwarciu zakładki
  useEffect(() => {
    if (tab !== 'members') return;
    setMembersLoading(true);
    setMembersError(null);
    fetchBoardMembers(boardId).then(res => setMembers(res.members));
  }, [tab, boardId]);

  // Debounced save ustawień do backendu (tylko właściciel)
  const handleToggle = useCallback(
    (key: keyof BoardSettings, value: boolean) => {
      const next = { ...settings, [key]: value };
      onSettingsChange(next);

      if (!isOwner) return;
      if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
      settingsTimerRef.current = setTimeout(async () => {
        setSettingsSaving(true);
        try {
          await updateBoardSettings(boardId, next);
        } catch {
          // silent fail — UI already updated locally
        } finally {
          setSettingsSaving(false);
        }
      }, 500);
    },
    [settings, isOwner, boardId, onSettingsChange]
  );

  const handleRoleChange = useCallback(
    async (userId: number, newRole: 'editor' | 'viewer') => {
      setSavingRoles((prev) => new Set(prev).add(userId));
      try {
        await updateBoardMemberRole(boardId, userId, newRole);
        setMembers((prev) =>
          prev.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m))
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Błąd zmiany roli';
        alert(message);
      } finally {
        setSavingRoles((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }
    },
    [boardId]
  );

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.4)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: 'white', borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          width: '480px', maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── HEADER ── */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 24px 16px',
            borderBottom: '1px solid #f3f4f6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={20} style={{ color: '#6b7280' }} />
            <span style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>
              Ustawienia tablicy
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {settingsSaving && (
              <span style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                Zapisywanie…
              </span>
            )}
            <button
              onClick={onClose}
              style={{
                padding: '6px', border: 'none', borderRadius: '8px',
                backgroundColor: 'transparent', cursor: 'pointer', color: '#6b7280',
              }}
              onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f3f4f6'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #f3f4f6', padding: '0 24px' }}>
          {([
            { key: 'settings', label: 'Ustawienia', Icon: Settings },
            { key: 'members',  label: 'Członkowie', Icon: Users },
          ] as const).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding: '12px 16px', border: 'none', backgroundColor: 'transparent',
                cursor: 'pointer', fontSize: '14px', fontWeight: tab === key ? 600 : 400,
                color: tab === key ? '#212224' : '#6b7280',
                borderBottom: tab === key ? '2px solid #212224' : '2px solid transparent',
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'color 0.15s',
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {/* ──── TAB: USTAWIENIA ──── */}
          {tab === 'settings' && (
            <div>
              {!isOwner && (
                <div
                  style={{
                    padding: '10px 14px', marginBottom: '16px',
                    backgroundColor: '#f3f4f6', border: '1px solid #d1d5db',
                    borderRadius: '8px', fontSize: '13px', color: '#374151',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}
                >
                  <Crown size={14} style={{ color: '#4b5563', flexShrink: 0 }} />
                  Tylko właściciel tablicy może zmieniać ustawienia.
                </div>
              )}

              <ToggleRow
                icon={<Bot size={20} />}
                label="Chatbot AI"
                description="Asystent matematyczny oparty na AI. Wyłącz jeśli nie chcesz, by uczniowie z niego korzystali."
                value={settings.ai_enabled}
                disabled={!isOwner}
                onChange={(v) => handleToggle('ai_enabled', v)}
              />
              <ToggleRow
                icon={<Grid3X3 size={20} />}
                label="Układ współrzędnych"
                description="Siatka i osie na tle tablicy."
                value={settings.grid_visible}
                disabled={!isOwner}
                onChange={(v) => handleToggle('grid_visible', v)}
              />
              <ToggleRow
                icon={<Search size={20} />}
                label="Pasek wyszukiwania"
                description="SmartSearch — wyszukiwarka wzorów i kart edukacyjnych."
                value={settings.smartsearch_visible}
                disabled={!isOwner}
                onChange={(v) => handleToggle('smartsearch_visible', v)}
              />
              <ToggleRow
                icon={<PanelLeft size={20} />}
                label="Pasek narzędzi"
                description="Lewy pasek z narzędziami do rysowania. Ukrycie ukrywa go wszystkim użytkownikom."
                value={settings.toolbar_visible}
                disabled={!isOwner}
                onChange={(v) => handleToggle('toolbar_visible', v)}
              />
            </div>
          )}

          {/* ──── TAB: CZŁONKOWIE ──── */}
          {tab === 'members' && (
            <div>
              {membersLoading && (
                <div style={{ textAlign: 'center', padding: '32px', color: '#6b7280' }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '14px' }}>Ładowanie członków…</div>
                </div>
              )}
              {membersError && (
                <div style={{ color: '#ef4444', fontSize: '14px', padding: '16px 0' }}>
                  {membersError}
                </div>
              )}
              {!membersLoading && !membersError && (
                <>
                  <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px', marginTop: 0 }}>
                    Role workspace-owe mają zastosowanie na wszystkich tablicach w tym workspace&apos;ie.
                  </p>
                  <div>
                    {members.map((m) => (
                      <div
                        key={m.user_id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 12px', borderRadius: '10px',
                          marginBottom: '6px', backgroundColor: '#f9fafb',
                        }}
                      >
                        {/* Avatar */}
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${getAvatarColorClass(m.user_id)}`}
                          style={{ flexShrink: 0 }}
                        >
                          {getInitials(m.username)}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.username}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.email}
                          </div>
                        </div>

                        {/* Role */}
                        {isOwner && !m.is_owner ? (
                          <RoleSelect
                            currentRole={m.role as Role}
                            userId={m.user_id}
                            boardId={boardId}
                            onRoleChange={handleRoleChange}
                            saving={savingRoles.has(m.user_id)}
                          />
                        ) : (
                          <RoleBadge role={(m.is_owner ? 'owner' : m.role) as Role} />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* spin keyframes */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
