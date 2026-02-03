'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Check,
  Users,
  Settings,
  Trash2,
  Crown,
  Calendar,
  Loader2,
  Eye,
  Edit3,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import {
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  updateMemberRole,
  WorkspaceMember,
} from '@/workspace_api/api';

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 DOSTĘPNE IKONY I KOLORY DLA WORKSPACE'ÓW
// ═══════════════════════════════════════════════════════════════════════════

const availableIcons = [
  'BookOpen',
  'Briefcase',
  'Code',
  'Coffee',
  'Compass',
  'Crown',
  'Gamepad2',
  'Heart',
  'Home',
  'Lightbulb',
  'Music',
  'Palette',
  'Rocket',
  'Sparkles',
  'Target',
  'Zap',
  'Users',
  'Calendar',
  'FileText',
  'MessageCircle',
  'Bell',
  'Star',
  'Trophy',
  'Award',
  'Globe',
  'Calculator',
  'Camera',
  'Monitor',
  'Laptop',
  'Cloud',
  'Database',
  'Server',
  'Wifi',
  'Smartphone',
  'PenTool',
  'Presentation',
] as const;

const availableColors = [
  { name: 'green', label: 'Zielony', class: 'bg-green-500' },
  { name: 'blue', label: 'Niebieski', class: 'bg-blue-500' },
  { name: 'purple', label: 'Fioletowy', class: 'bg-purple-500' },
  { name: 'pink', label: 'Różowy', class: 'bg-pink-500' },
  { name: 'orange', label: 'Pomarańczowy', class: 'bg-orange-500' },
  { name: 'red', label: 'Czerwony', class: 'bg-red-500' },
  { name: 'yellow', label: 'Żółty', class: 'bg-yellow-500' },
  { name: 'indigo', label: 'Indygo', class: 'bg-indigo-500' },
  { name: 'teal', label: 'Turkusowy', class: 'bg-teal-500' },
  { name: 'cyan', label: 'Cyjan', class: 'bg-cyan-500' },
  { name: 'emerald', label: 'Szmaragdowy', class: 'bg-emerald-500' },
  { name: 'gray', label: 'Szary', class: 'bg-gray-500' },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// 📝 TYPY
// ═══════════════════════════════════════════════════════════════════════════

type TabType = 'settings' | 'members';

interface WorkspaceMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; icon: string; bg_color: string }) => Promise<void>;
  workspaceId: number;
  isOwner: boolean;
  initialData?: {
    name: string;
    icon: string;
    bg_color: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 KOMPONENT MODALU
// ═══════════════════════════════════════════════════════════════════════════

export default function WorkspaceMembersModal({
  isOpen,
  onClose,
  onSave,
  workspaceId,
  isOwner,
  initialData,
}: WorkspaceMembersModalProps) {
  // Aktywna zakładka
  const [activeTab, setActiveTab] = useState<TabType>('settings');

  // Stan dla zakładki ustawień
  const [name, setName] = useState(initialData?.name || '');
  const [selectedIcon, setSelectedIcon] = useState(initialData?.icon || 'Home');
  const [selectedColor, setSelectedColor] = useState(initialData?.bg_color || 'green-500');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stan dla zakładki członków
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<number | null>(null);
  const [changingRoleUserId, setChangingRoleUserId] = useState<number | null>(null);

  // Animacja usunięcia
  const [removedMember, setRemovedMember] = useState<WorkspaceMember | null>(null);
  const [showRemovedAnimation, setShowRemovedAnimation] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const confirmModalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes or initialData changes
  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setSelectedIcon(initialData?.icon || 'Home');
      const color = initialData?.bg_color || 'green-500';
      setSelectedColor(color.replace('bg-', ''));
      setError(null);
      setActiveTab('settings');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData]);

  // Pobierz członków gdy przejdziemy na zakładkę members
  useEffect(() => {
    if (isOpen && activeTab === 'members' && workspaceId) {
      loadMembers();
    }
  }, [isOpen, activeTab, workspaceId]);

  const loadMembers = async () => {
    setLoadingMembers(true);
    setMembersError(null);

    try {
      const response = await fetchWorkspaceMembers(workspaceId);
      setMembers(response.members);
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Nie udało się pobrać członków');
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    // Znajdź członka przed usunięciem (do animacji)
    const memberToRemove = members.find((m) => m.user_id === userId);

    setRemovingMemberId(userId);

    try {
      await removeWorkspaceMember(workspaceId, userId);

      // Zamknij modal potwierdzenia
      setShowRemoveConfirm(null);

      // Usuń z listy
      setMembers(members.filter((m) => m.user_id !== userId));

      // Pokaż animację usunięcia
      if (memberToRemove) {
        setRemovedMember(memberToRemove);
        setShowRemovedAnimation(true);

        // Ukryj animację po 2.5 sekundy
        setTimeout(() => {
          setShowRemovedAnimation(false);
          setRemovedMember(null);
        }, 2500);
      }
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Nie udało się usunąć członka');
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleRoleChange = async (userId: number, newRole: 'owner' | 'editor' | 'viewer') => {
    setChangingRoleUserId(userId);

    try {
      await updateMemberRole(workspaceId, userId, newRole);

      // Aktualizuj listę członków
      setMembers(
        members.map((m) =>
          m.user_id === userId ? { ...m, role: newRole, is_owner: newRole === 'owner' } : m
        )
      );
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Nie udało się zmienić roli');
    } finally {
      setChangingRoleUserId(null);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner':
        return 'Właściciel';
      case 'editor':
        return 'Edytor';
      case 'viewer':
        return 'Widz';
      default:
        return role;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown size={12} />;
      case 'editor':
        return <Edit3 size={12} />;
      case 'viewer':
        return <Eye size={12} />;
      default:
        return null;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-200 text-amber-800';
      case 'editor':
        return 'bg-blue-200 text-blue-800';
      case 'viewer':
        return 'bg-gray-200 text-gray-800';
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  // Zamknij modal przy kliknięciu poza nim (ale nie przy kliknięciu na modal potwierdzenia)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Jeśli pokazujemy modal potwierdzenia, nie zamykaj głównego modalu
      if (showRemoveConfirm !== null) {
        return;
      }

      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, showRemoveConfirm]);

  // Zamknij modal przy Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showRemoveConfirm) {
          setShowRemoveConfirm(null);
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showRemoveConfirm]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Nazwa przestrzeni jest wymagana');
      return;
    }

    if (name.length > 200) {
      setError('Nazwa może mieć maksymalnie 200 znaków');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        icon: selectedIcon,
        bg_color: selectedColor,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd');
    } finally {
      setSaving(false);
    }
  };

  // Pobierz komponent ikony z Lucide
  const getIconComponent = (iconName: string) => {
    const IconComponent = (LucideIcons as any)[iconName];
    return IconComponent || LucideIcons.HelpCircle;
  };

  // Znajdź kolor po nazwie
  const getColorData = (colorName: string) => {
    const normalizedColor = colorName.replace('bg-', '').replace('-500', '');
    return availableColors.find((c) => c.name === normalizedColor) || availableColors[0];
  };

  // Formatuj datę
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Avatar z inicjałem
  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  if (!isOpen) return null;

  const SelectedIconComponent = getIconComponent(selectedIcon);
  const selectedColorData = getColorData(selectedColor);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Ustawienia przestrzeni</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Settings size={18} />
            <span>Ustawienia</span>
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === 'members'
                ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Users size={18} />
            <span>Uczestnicy</span>
            {members.length > 0 && (
              <span className="ml-1 bg-gray-200 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                {members.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {activeTab === 'settings' ? (
          // ═══════════════════════════════════════════════════════════════
          // ZAKŁADKA: USTAWIENIA
          // ═══════════════════════════════════════════════════════════════
          <div className="p-6 space-y-6">
            {/* Podgląd */}
            <div className="flex items-center justify-center">
              <div
                className={`w-20 h-20 rounded-2xl ${selectedColorData.class} flex items-center justify-center shadow-lg`}
              >
                <SelectedIconComponent size={40} className="text-white drop-shadow" />
              </div>
            </div>

            {/* Nazwa */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nazwa przestrzeni
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Wpisz nazwę przestrzeni..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-gray-900 placeholder-gray-400"
                maxLength={200}
                disabled={!isOwner}
              />
              <div className="text-right text-xs text-gray-400 mt-1">{name.length}/200</div>
            </div>

            {/* Ikona */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ikona</label>
              <div className="grid grid-cols-9 gap-2 max-h-32 overflow-y-auto p-1">
                {availableIcons.map((iconName) => {
                  const IconComponent = getIconComponent(iconName);
                  const isSelected = selectedIcon === iconName;
                  return (
                    <button
                      key={iconName}
                      onClick={() => isOwner && setSelectedIcon(iconName)}
                      disabled={!isOwner}
                      className={`p-2 rounded-lg transition-all ${
                        isSelected
                          ? 'bg-green-100 text-green-600 ring-2 ring-green-500'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      } ${!isOwner ? 'cursor-not-allowed opacity-60' : ''}`}
                      title={iconName}
                    >
                      <IconComponent size={20} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kolor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Kolor</label>
              <div className="flex flex-wrap gap-2">
                {availableColors.map((color) => {
                  const isSelected =
                    selectedColor === `${color.name}-500` || selectedColor === color.name;
                  return (
                    <button
                      key={color.name}
                      onClick={() => isOwner && setSelectedColor(`${color.name}-500`)}
                      disabled={!isOwner}
                      className={`w-10 h-10 rounded-xl ${color.class} transition-all flex items-center justify-center ${
                        isSelected
                          ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                          : 'hover:scale-105'
                      } ${!isOwner ? 'cursor-not-allowed opacity-60' : ''}`}
                      title={color.label}
                    >
                      {isSelected && <Check size={18} className="text-white drop-shadow" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Info dla nie-właściciela */}
            {!isOwner && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                Tylko właściciel przestrzeni może edytować ustawienia.
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}
          </div>
        ) : (
          // ═══════════════════════════════════════════════════════════════
          // ZAKŁADKA: UCZESTNICY
          // ═══════════════════════════════════════════════════════════════
          <div className="p-6">
            {loadingMembers ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 size={32} className="text-green-600 animate-spin mb-3" />
                <p className="text-gray-500 text-sm">Ładowanie uczestników...</p>
              </div>
            ) : membersError ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                {membersError}
                <button
                  onClick={loadMembers}
                  className="block mx-auto mt-2 text-red-700 underline hover:no-underline"
                >
                  Spróbuj ponownie
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                      member.is_owner
                        ? 'bg-amber-50 border border-amber-200'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        member.is_owner ? 'bg-amber-500' : 'bg-green-500'
                      } text-white font-bold text-lg shadow-sm`}
                    >
                      {getInitial(member.username)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate">
                          {member.full_name || member.username}
                        </span>

                        {/* Dropdown roli (tylko dla właściciela, ukryty dla samego siebie) */}
                        {isOwner && !member.is_owner ? (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              handleRoleChange(
                                member.user_id,
                                e.target.value as 'owner' | 'editor' | 'viewer'
                              )
                            }
                            disabled={changingRoleUserId === member.user_id}
                            className={`text-xs px-2 py-1 rounded-full border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-wait ${getRoleColor(member.role)}`}
                          >
                            <option value="editor">🖊️ Edytor</option>
                            <option value="viewer">👁️ Widz</option>
                            <option value="owner">👑 Właściciel</option>
                          </select>
                        ) : (
                          <span
                            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${getRoleColor(member.role)}`}
                          >
                            {getRoleIcon(member.role)}
                            {getRoleLabel(member.role)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>@{member.username}</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(member.joined_at)}
                        </span>
                      </div>
                    </div>

                    {/* Przycisk usuwania (tylko dla właściciela i nie dla siebie) */}
                    {isOwner && !member.is_owner && (
                      <button
                        onClick={() => setShowRemoveConfirm(member.user_id)}
                        disabled={removingMemberId === member.user_id}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="Usuń uczestnika"
                      >
                        {removingMemberId === member.user_id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    )}
                  </div>
                ))}

                {members.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users size={40} className="mx-auto mb-3 text-gray-300" />
                    <p>Brak uczestników</p>
                  </div>
                )}
              </div>
            )}

            {/* Podsumowanie */}
            {!loadingMembers && members.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
                Łącznie {members.length}{' '}
                {members.length === 1
                  ? 'uczestnik'
                  : members.length < 5
                    ? 'uczestników'
                    : 'uczestników'}
              </div>
            )}
          </div>
        )}

        {/* Footer - tylko dla zakładki ustawień */}
        {activeTab === 'settings' && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-xl transition-colors"
            >
              Anuluj
            </button>
            {isOwner && (
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="px-5 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Zapisywanie...</span>
                  </>
                ) : (
                  <span>Zapisz zmiany</span>
                )}
              </button>
            )}
          </div>
        )}

        {/* Footer - dla zakładki członków */}
        {activeTab === 'members' && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-xl transition-colors"
            >
              Zamknij
            </button>
          </div>
        )}
      </div>

      {/* Modal potwierdzenia usunięcia */}
      {showRemoveConfirm && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[10000]"
          onClick={() => setShowRemoveConfirm(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full mx-4 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-gray-900 mb-2">Usuń uczestnika?</h3>
            <p className="text-gray-600 mb-6">
              Czy na pewno chcesz usunąć{' '}
              <strong>{members.find((m) => m.user_id === showRemoveConfirm)?.username}</strong> z
              tej przestrzeni?
              <br />
              <span className="text-sm text-gray-500">
                Użytkownik straci dostęp do wszystkich tablic.
              </span>
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRemoveConfirm(null)}
                className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-300 transition-colors"
              >
                Anuluj
              </button>
              <button
                onClick={() => handleRemoveMember(showRemoveConfirm)}
                disabled={removingMemberId === showRemoveConfirm}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 disabled:bg-red-400 transition-colors flex items-center justify-center gap-2"
              >
                {removingMemberId === showRemoveConfirm ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Usuwanie...</span>
                  </>
                ) : (
                  <span>Usuń</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animacja usunięcia użytkownika - OVERLAY nad całym dashboardem */}
      {showRemovedAnimation && removedMember && (
        <div className="fixed inset-0 z-[10001] pointer-events-none flex items-start justify-center pt-20">
          <div
            className="animate-fall-away"
            style={{
              animation: 'fallAway 2.5s ease-in forwards',
            }}
          >
            <div className="bg-white border-4 border-red-500 rounded-2xl shadow-2xl p-6 min-w-[300px]">
              {/* Header z X */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-red-600 font-bold text-lg">Usunięto!</span>
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <X size={20} className="text-red-600" />
                </div>
              </div>

              {/* Użytkownik */}
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                  {removedMember.username.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div>
                  <div className="font-bold text-gray-900 text-lg">
                    {removedMember.full_name || removedMember.username}
                  </div>
                  <div className="text-gray-500">@{removedMember.username}</div>
                  <div className="text-red-600 text-sm mt-1">Usunięty z przestrzeni</div>
                </div>
              </div>
            </div>
          </div>

          {/* CSS Animation */}
          <style jsx>{`
            @keyframes fallAway {
              0% {
                opacity: 1;
                transform: translateY(0) rotate(0deg) scale(1);
              }
              20% {
                opacity: 1;
                transform: translateY(0) rotate(0deg) scale(1.05);
              }
              40% {
                opacity: 1;
                transform: translateY(50px) rotate(-3deg) scale(1);
              }
              100% {
                opacity: 0;
                transform: translateY(100vh) rotate(-15deg) scale(0.8);
              }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
