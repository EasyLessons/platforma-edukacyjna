/**
 * ============================================================================
 * PLIK: tools/types.ts — Kontrakt wtyczki-narzędzia (ToolDefinition)
 * ============================================================================
 *
 * Dodanie narzędzia = utworzenie jednego pliku `*.tool.tsx` eksportującego
 * ToolDefinition + dopisanie go do ALL_TOOLS (registry.ts). Toolbar, overlay,
 * skrót, kursor i filtr ról działają wtedy automatycznie.
 *
 * Dwa rodzaje wtyczek:
 *  - TRYB   → ma `Overlay` (komponent obsługujący pointer/gesty),
 *  - AKCJA  → ma `onInvoke` (klik wykonuje akcję, bez trybu; np. „zapisz szablon").
 * ============================================================================
 */

import type { ComponentType, CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '@/_new/features/whiteboard/engine/types';
import type { ToolHostContextValue } from './tool-host-context';

/** Identyfikator narzędzia — `string`, rozszerzalny (nowy plik nie zmienia typów). */
export type ToolId = string;

export interface ToolDefinition {
  id: ToolId;
  label: string;                       // tooltip, np. "Rysuj (P)"
  icon: LucideIcon;
  shortcut?: string;                   // np. 'p' — rejestrowany automatycznie
  /** Sekcja toolbara. Brak `group` = narzędzie bez przycisku (tylko overlay, np. arrow). */
  group?: 'main' | 'more';
  order?: number;
  cursor?: CSSProperties['cursor'];    // kursor canvasu gdy narzędzie aktywne
  availableTo?: UserRole[];            // domyślnie ['owner','editor']; 'viewer' tylko gdy podane
  /** Wypełnienie ikony w przycisku toolbara (fillOpacity); brak = ikona konturowa. */
  iconFill?: number;

  /** Narzędzie-TRYB: overlay pointer/gestów. Czyta ToolHostContext przez useToolHost(). */
  Overlay?: ComponentType;
  /** Panel właściwości obok toolbara (Faza 3 — na razie panele zostają w toolbar-ui). */
  PropertiesPanel?: ComponentType;

  /** Narzędzie-AKCJA: klik wykonuje akcję bez wchodzenia w tryb. */
  onInvoke?: (host: ToolHostContextValue) => void;
}
