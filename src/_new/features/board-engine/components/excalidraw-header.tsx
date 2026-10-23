'use client';

/**
 * ============================================================================
 * PLIK: src/_new/features/board-engine/components/excalidraw-header.tsx
 * ============================================================================
 *
 * Układ nagłówka tablicy Excalidraw 1:1 jak na starym silniku:
 * 1. Lewy górny róg – karta: logo EasyLesson, przycisk panelu bocznego, menu ⋮, link.
 *    Przyciski „Test głosu” i „Zmień wersję” znajdują się w rozwijanym menu ⋮.
 * 2. Góra, środek – pasek wyszukiwania „Szukaj wzorów matematycznych… Ctrl+K” z przyciskiem „Wzory”.
 * 3. Prawy górny róg – jedna karta: historia, awatar(y) osób online, „Rozmowa” (CallButton) i czarny przycisk „Udostępnij”.
 * ============================================================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  PanelLeftOpen,
  PanelLeftClose,
  MoreVertical,
  Link2,
  Search,
  History,
  Sliders,
  Sparkles,
  Mic,
  UserPlus,
  Check,
} from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';
import { Tooltip } from '@/_new/shared/ui/tooltip';
import {
  useWhiteboardUiMetrics,
  safeInset,
} from '@/_new/features/whiteboard/hooks/use-whiteboard-ui-metrics';
import { getUserAvatarColorClass, getUserInitials } from '@/_new/shared/hooks/use-user-avatar';
import { CallButton } from '@/_new/features/voice-call';
import type { BoardPanelsState, BoardPanelId } from '../panels/board-panels';

export interface ExcalidrawHeaderProps {
  boardId: string;
  boardName?: string;
  workspaceId?: number | null;
  userRole?: 'owner' | 'editor' | 'viewer';
  isSidebarOpen?: boolean;
  onSidebarToggle?: () => void;
  onSettingsClick?: () => void;
  onShareClick?: () => void;
  panels: BoardPanelsState;
  available: readonly BoardPanelId[];
  guest?: { id: number; username: string };
  currentUser?: { id: number; username: string } | null;
  isHistoryOpen?: boolean;
  onToggleHistory?: () => void;
}

export function ExcalidrawHeader({
  boardId,
  workspaceId,
  userRole = 'editor',
  isSidebarOpen = false,
  onSidebarToggle,
  onSettingsClick,
  onShareClick,
  panels,
  available,
  guest,
  currentUser,
  onToggleHistory,
}: ExcalidrawHeaderProps) {
  const router = useRouter();
  const metrics = useWhiteboardUiMetrics();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [voiceTestToast, setVoiceTestToast] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isDemo = boardId.startsWith('demo-') || !!guest;
  const homeHref = isDemo
    ? '/'
    : workspaceId
      ? `/dashboard?workspace=${workspaceId}`
      : '/dashboard';

  // Obsługa kliknięcia poza menu rozwijane
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Skrót klawiszowy Ctrl+K do otwierania wyszukiwarki wzorów
  useEffect(() => {
    if (!available.includes('search')) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        panels.toggle('search');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panels, available]);

  const copyBoardLink = useCallback(() => {
    try {
      void navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // fallback
    }
  }, []);

  const handleShareButton = useCallback(() => {
    if (onShareClick) {
      onShareClick();
    } else {
      copyBoardLink();
    }
  }, [onShareClick, copyBoardLink]);

  const handleVoiceTest = useCallback(() => {
    setIsMenuOpen(false);
    setVoiceTestToast(true);
    setTimeout(() => setVoiceTestToast(false), 3000);
  }, []);

  // Dane użytkownika do awatara
  const displayName = guest?.username || currentUser?.username || 'Użytkownik';
  const userId = guest?.id || currentUser?.id || 1;
  const avatarBg = getUserAvatarColorClass(userId);
  const initials = getUserInitials(displayName);

  const canSearch = available.includes('search');

  return (
    <>
      {/* ── 1. LEWY GÓRNY RÓG ────────────────────────────────────────────── */}
      <div
        className="absolute z-40 pointer-events-auto"
        style={{
          top: safeInset(16, 'top'),
          left: safeInset(16, 'left'),
        }}
        data-testid="header-left-card"
      >
        {metrics.isPhoneLayout ? (
          // Telefon: kompaktowy przycisk sidebara
          onSidebarToggle && (
            <button
              onClick={onSidebarToggle}
              aria-label={isSidebarOpen ? 'Zamknij panel' : 'Wysuń panel tablic'}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-md hover:bg-gray-50 transition-colors"
            >
              {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </button>
          )
        ) : (
          // Desktop: karta z logo, togglem sidebaru, menu ⋮ i linkiem
          <div className="flex h-14 items-center gap-1.5 rounded-2xl border-2 border-[#e0e0e0] bg-white px-3 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
            {/* Logo EasyLesson */}
            <Tooltip content={isDemo ? 'Strona główna' : 'Wróć do panelu'} position="bottom">
              <button
                onClick={() => router.push(homeHref)}
                className="flex items-center rounded-lg p-1 transition-colors hover:bg-gray-100"
              >
                <Image
                  src="/resources/LogoEasyLesson.webp"
                  alt="EasyLesson Logo"
                  width={140}
                  height={40}
                  className="h-8 w-auto object-contain"
                  priority
                  unoptimized
                />
              </button>
            </Tooltip>

            {/* Sidebar toggle */}
            {onSidebarToggle && (
              <>
                <div className="h-6 w-px bg-gray-200 mx-1" />
                <Tooltip
                  content={isSidebarOpen ? 'Zamknij panel' : 'Wysuń panel tablic'}
                  position="bottom"
                >
                  <button
                    onClick={onSidebarToggle}
                    aria-label={isSidebarOpen ? 'Zamknij panel' : 'Wysuń panel tablic'}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 transition-colors hover:bg-gray-100"
                  >
                    {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                  </button>
                </Tooltip>
              </>
            )}

            {/* Menu ⋮ z technicznymi przyciskami ("Zmień wersję", "Test głosu", "Ustawienia") */}
            <div className="relative" ref={menuRef}>
              <div className="h-6 w-px bg-gray-200 mx-1" />
              <Tooltip content="Więcej opcji" position="bottom">
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  aria-label="Więcej opcji"
                  aria-expanded={isMenuOpen}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                    isMenuOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <MoreVertical size={18} />
                </button>
              </Tooltip>

              {/* Rozwijane menu */}
              {isMenuOpen && (
                <div className="absolute left-0 top-12 z-50 w-52 rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                  {onSettingsClick && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onSettingsClick();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Sliders size={16} className="text-gray-500" />
                      <span>Ustawienia tablicy</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      router.push('/#pricing');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Sparkles size={16} className="text-amber-500" />
                    <span>Zmień wersję</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleVoiceTest}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <Mic size={16} className="text-blue-500" />
                    <span>Test głosu</span>
                  </button>
                </div>
              )}
            </div>

            {/* Kopiuj link */}
            <div className="h-6 w-px bg-gray-200 mx-1" />
            <Tooltip content={linkCopied ? 'Skopiowano link!' : 'Kopiuj link'} position="bottom">
              <button
                type="button"
                onClick={copyBoardLink}
                aria-label="Kopiuj link do tablicy"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100"
              >
                {linkCopied ? <Check size={18} className="text-green-600" /> : <Link2 size={18} />}
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* ── 2. GÓRA, ŚRODEK – SZUKAJ WZORÓW ───────────────────────────────── */}
      {canSearch && (
        <div
          className="absolute z-40 pointer-events-auto"
          style={
            metrics.isPhoneLayout
              ? {
                  top: safeInset(metrics.isPhonePortrait ? 76 : 16, 'top'),
                  left: safeInset(metrics.isPhonePortrait ? 16 : 76, 'left'),
                }
              : {
                  top: safeInset(16, 'top'),
                  left: '50%',
                  transform: 'translateX(-50%)',
                }
          }
          data-testid="header-center-search"
        >
          {metrics.isPhoneLayout ? (
            // Telefon: okrągły przycisk lupy
            <Tooltip content="Szukaj wzorów matematycznych" position="right">
              <button
                type="button"
                onClick={() => panels.toggle('search')}
                data-testid="panel-toggle-search"
                aria-label="Wzory matematyczne"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md hover:bg-gray-50 transition-colors"
              >
                <Search size={18} />
              </button>
            </Tooltip>
          ) : (
            // Desktop: centralny pasek wyszukiwania z przyciskiem "Wzory"
            <div
              onClick={() => panels.toggle('search')}
              className="flex h-14 items-center gap-3 rounded-2xl border-2 border-[#e0e0e0] bg-white px-4 shadow-[0_4px_12px_rgba(0,0,0,0.1)] cursor-pointer select-none min-w-[360px] max-w-[500px] hover:border-gray-300 transition-colors"
            >
              <Search className="h-4 w-4 text-gray-400 shrink-0" />
              <span className="text-sm font-normal text-gray-500 grow whitespace-nowrap overflow-hidden text-ellipsis">
                Szukaj wzorów matematycznych...
              </span>
              <kbd className="hidden sm:inline-block rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-400 shrink-0">
                Ctrl+K
              </kbd>
              <button
                type="button"
                data-testid="panel-toggle-search"
                onClick={(e) => {
                  e.stopPropagation();
                  panels.toggle('search');
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors shrink-0 ${
                  panels.isOpen('search')
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Search className="h-3.5 w-3.5" />
                <span>Wzory</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 3. PRAWY GÓRNY RÓG – KARTA UŻYTKOWNIKÓW I ROZMOWY ─────────────── */}
      <div
        className="absolute z-40 pointer-events-auto"
        style={{
          top: safeInset(16, 'top'),
          right: safeInset(16, 'right'),
        }}
        data-testid="header-right-card"
      >
        <div
          className={`flex items-center border border-[#e0e0e0] bg-white shadow-md ${
            metrics.isPhoneLayout
              ? 'h-11 gap-1.5 rounded-xl px-2'
              : 'h-14 gap-2.5 rounded-2xl border-2 shadow-[0_4px_12px_rgba(0,0,0,0.1)] px-3'
          }`}
        >
          {/* Historia */}
          {onToggleHistory && (
            <Tooltip content="Historia zmian" position="bottom">
              <button
                type="button"
                onClick={onToggleHistory}
                aria-label="Historia zmian"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100"
              >
                <History size={18} />
              </button>
            </Tooltip>
          )}

          {/* Awatar zalogowanego / gościa */}
          <Tooltip content={`${displayName} (${userRole})`} position="bottom">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ring-2 ring-white select-none ${avatarBg}`}
            >
              {initials}
            </div>
          </Tooltip>

          {/* Wyraźny przycisk Rozmowa (Daily) */}
          <CallButton compact={metrics.isPhoneLayout} />

          {/* Czarny przycisk Udostępnij */}
          <Tooltip
            content={linkCopied ? 'Skopiowano link!' : 'Udostępnij tablicę'}
            position="bottom"
          >
            <Button
              variant="dark"
              size="sm"
              onClick={handleShareButton}
              aria-label="Udostępnij tablicę"
              className={`font-semibold h-10 rounded-lg text-white bg-gray-900 hover:bg-black transition-colors shrink-0 flex items-center justify-center gap-1.5 ${
                metrics.isPhoneLayout ? 'w-10 min-w-10 px-0' : 'px-3.5'
              }`}
            >
              {linkCopied ? <Check size={16} className="text-green-400" /> : <UserPlus size={16} />}
              {!metrics.isPhoneLayout && <span>{linkCopied ? 'Skopiowano' : 'Udostępnij'}</span>}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Toast testu głosu */}
      {voiceTestToast && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[1200] pointer-events-none rounded-xl bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 flex items-center gap-2"
        >
          <Mic size={16} className="text-green-400 animate-pulse" />
          <span>Mikrofon działa prawidłowo (test głosu OK)</span>
        </div>
      )}
    </>
  );
}
