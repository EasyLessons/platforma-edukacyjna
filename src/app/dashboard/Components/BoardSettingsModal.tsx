'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Check } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// 🎨 DOSTĘPNE IKONY I KOLORY
// ═══════════════════════════════════════════════════════════════════════════

// Ikony dostępne dla tablic (dopasowane do iconGradientMap z LastBoards)
const availableIcons = [
  'PenTool',
  'Calculator',
  'Globe',
  'Lightbulb',
  'Target',
  'Rocket',
  'BookOpen',
  'Presentation',
  'Zap',
  'Compass',
  'Cpu',
  'Palette',
  'Camera',
  'Music',
  'Video',
  'Film',
  'Code',
  'Terminal',
  'Database',
  'Server',
  'Cloud',
  'Wifi',
  'Smartphone',
  'Monitor',
  'Laptop',
  'Gamepad2',
  'Trophy',
  'Star',
  'Heart',
  'Flame',
  'Sparkles',
  'Award',
  'Home',
  'Users',
  'Calendar',
  'FileText',
  'MessageCircle',
  'Bell',
] as const;

// Kolory tła (gradient mapping)
const availableColors = [
  { name: 'gray', label: 'Szary', class: 'bg-gray-500', gradient: 'from-gray-400 to-gray-600' },
  { name: 'blue', label: 'Niebieski', class: 'bg-blue-500', gradient: 'from-blue-400 to-blue-600' },
  {
    name: 'green',
    label: 'Zielony',
    class: 'bg-green-500',
    gradient: 'from-green-400 to-green-600',
  },
  {
    name: 'purple',
    label: 'Fioletowy',
    class: 'bg-purple-500',
    gradient: 'from-purple-400 to-purple-600',
  },
  { name: 'pink', label: 'Różowy', class: 'bg-pink-500', gradient: 'from-pink-400 to-pink-600' },
  { name: 'red', label: 'Czerwony', class: 'bg-red-500', gradient: 'from-red-400 to-red-600' },
  {
    name: 'orange',
    label: 'Pomarańczowy',
    class: 'bg-orange-500',
    gradient: 'from-orange-400 to-orange-600',
  },
  {
    name: 'yellow',
    label: 'Żółty',
    class: 'bg-yellow-500',
    gradient: 'from-yellow-400 to-yellow-600',
  },
  { name: 'teal', label: 'Turkusowy', class: 'bg-teal-500', gradient: 'from-teal-400 to-teal-600' },
  {
    name: 'indigo',
    label: 'Indygo',
    class: 'bg-indigo-500',
    gradient: 'from-indigo-400 to-indigo-600',
  },
  { name: 'cyan', label: 'Cyjan', class: 'bg-cyan-500', gradient: 'from-cyan-400 to-cyan-600' },
  {
    name: 'emerald',
    label: 'Szmaragdowy',
    class: 'bg-emerald-500',
    gradient: 'from-emerald-400 to-emerald-600',
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// 📝 TYPY
// ═══════════════════════════════════════════════════════════════════════════

interface BoardSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; icon: string; bg_color: string }) => Promise<void>;
  mode: 'create' | 'edit';
  initialData?: {
    name: string;
    icon: string;
    bg_color: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 KOMPONENT MODALU
// ═══════════════════════════════════════════════════════════════════════════

export default function BoardSettingsModal({
  isOpen,
  onClose,
  onSave,
  mode,
  initialData,
}: BoardSettingsModalProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [selectedIcon, setSelectedIcon] = useState(initialData?.icon || 'PenTool');
  const [selectedColor, setSelectedColor] = useState(initialData?.bg_color || 'gray-500');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens/closes or initialData changes
  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setSelectedIcon(initialData?.icon || 'PenTool');
      setSelectedColor(initialData?.bg_color || 'gray-500');
      setError(null);
      // Focus na input po otwarciu
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData]);

  // Zamknij modal przy kliknięciu poza nim
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Zamknij modal przy Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Nazwa tablicy jest wymagana');
      return;
    }

    if (name.length > 50) {
      setError('Nazwa może mieć maksymalnie 50 znaków');
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
    return (
      availableColors.find((c) => c.name === colorName.replace('-500', '')) || availableColors[0]
    );
  };

  if (!isOpen) return null;

  const SelectedIconComponent = getIconComponent(selectedIcon);
  const selectedColorData = getColorData(selectedColor);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            {mode === 'create' ? 'Nowa tablica' : 'Ustawienia tablicy'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Podgląd */}
          <div className="flex items-center justify-center">
            <div
              className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${selectedColorData.gradient} flex items-center justify-center shadow-lg`}
            >
              <SelectedIconComponent size={40} className="text-white drop-shadow" />
            </div>
          </div>

          {/* Nazwa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nazwa tablicy</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Wpisz nazwę tablicy..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-gray-900 placeholder-gray-400"
              maxLength={50}
            />
            <div className="text-right text-xs text-gray-400 mt-1">{name.length}/50</div>
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
                    onClick={() => setSelectedIcon(iconName)}
                    className={`p-2 rounded-lg transition-all ${
                      isSelected
                        ? 'bg-green-100 text-green-600 ring-2 ring-green-500'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    }`}
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
                const isSelected = selectedColor === `${color.name}-500`;
                return (
                  <button
                    key={color.name}
                    onClick={() => setSelectedColor(`${color.name}-500`)}
                    className={`w-10 h-10 rounded-xl ${color.class} transition-all flex items-center justify-center ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-gray-900 scale-110'
                        : 'hover:scale-105'
                    }`}
                    title={color.label}
                  >
                    {isSelected && <Check size={18} className="text-white drop-shadow" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-xl transition-colors"
          >
            Anuluj
          </button>
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
              <span>{mode === 'create' ? 'Utwórz tablicę' : 'Zapisz zmiany'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
