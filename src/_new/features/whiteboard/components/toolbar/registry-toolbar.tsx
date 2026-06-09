/**
 * ============================================================================
 * PLIK: components/toolbar/registry-toolbar.tsx — Przyciski-tryby z rejestru
 * ============================================================================
 *
 * Renderuje przyciski narzędzi-trybów na podstawie ALL_TOOLS (rejestr wtyczek),
 * zamiast hardkodowanej listy w toolbar-ui. Dodanie narzędzia z `group` =
 * automatycznie pojawia się przycisk.
 *
 * Czyta aktywne narzędzie i setter ze store'a (zustand) — Toolbar nie potrzebuje
 * już propsów tool/onToolChange. ToolButton skopiowany 1:1 ze stylu toolbar-ui
 * (świadomie, by uniknąć cyklu importów toolbar-ui ↔ registry-toolbar).
 * ============================================================================
 */

'use client';

import React from 'react';
import { Tooltip } from '@/_new/shared/ui/tooltip';
import { useToolStore } from '@/_new/features/whiteboard/stores/tool-store';
import { ALL_TOOLS } from '@/_new/features/whiteboard/tools/registry';
import type { UserRole } from '@/_new/features/whiteboard/engine/types';

interface ToolModeButtonsProps {
  /** Która sekcja toolbara — renderuje narzędzia z tej grupy. */
  group: 'main' | 'more';
  isReadOnly?: boolean;
  /** Wywoływane po wyborze narzędzia (np. zamknięcie menu „Więcej"). */
  onAfterSelect?: () => void;
}

export function ToolModeButtons({ group, isReadOnly = false, onAfterSelect }: ToolModeButtonsProps) {
  const activeTool = useToolStore((s) => s.activeTool);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const role: UserRole = isReadOnly ? 'viewer' : 'editor';

  const tools = ALL_TOOLS
    .filter((t) => t.group === group)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <>
      {tools.map((t) => {
        const Icon = t.icon;
        const available = (t.availableTo ?? ['owner', 'editor']).includes(role);
        const active = activeTool === t.id;
        const filled = t.iconFill !== undefined;
        return (
          <Tooltip key={t.id} content={t.label} position="right">
            <button
              onClick={() => {
                setActiveTool(t.id);
                onAfterSelect?.();
              }}
              disabled={!available}
              className={`
                relative p-1.5 rounded-md transition-colors group
                ${active ? 'bg-blue-500/20 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}
                ${!available ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <Icon
                className="w-5 h-5"
                {...(filled
                  ? { fill: 'currentColor', fillOpacity: t.iconFill }
                  : active
                    ? { fill: 'rgb(37 99 235 / 0.1)', stroke: 'currentColor' }
                    : {})}
              />
            </button>
          </Tooltip>
        );
      })}
    </>
  );
}
