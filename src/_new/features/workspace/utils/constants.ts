/**
 * WORKSPACE CONSTANTS
 *
 * Centralne miejsce dla wszystkich stałych używanych w workspace module.
 * 
 */

import {
  BookOpen,
  Briefcase,
  Code,
  Coffee,
  Compass,
  Crown,
  Gamepad2,
  Heart,
  Home,
  Lightbulb,
  Music,
  Palette,
  Rocket,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';

// ICONS
// ================================

// WORKSPACE_ICONS - Mapowanie nazw ikon na komponenty Lucide
export const WORKSPACE_ICONS = {
  BookOpen,
  Briefcase,
  Code,
  Coffee,
  Compass,
  Crown,
  Gamepad2,
  Heart,
  Home,
  Lightbulb,
  Music,
  Palette,
  Rocket,
  Sparkles,
  Target,
  Zap,
} as const;

// WORKSPACE_ICON_NAMES - Lista nazw ikon (dla iteracji)
export const WORKSPACE_ICON_NAMES = Object.keys(WORKSPACE_ICONS) as Array<
  keyof typeof WORKSPACE_ICONS
>;

// DEFAULT_WORKSPACE_ICON - Domyślna ikona
export const DEFAULT_WORKSPACE_ICON = 'Home';

// COLORS
// ================================

// WORKSPACE_COLORS - Dostępne kolory tła
export const WORKSPACE_COLORS = [
  'green-500',
  'blue-500',
  'purple-500',
  'pink-500',
  'orange-500',
  'red-500',
  'yellow-500',
  'indigo-500',
  'teal-500',
  'cyan-500',
  'emerald-500',
  'gray-500',
] as const;

// COLOR_MAP - Mapowanie nazw kolorów na klasy Tailwind
export const COLOR_MAP: Record<string, string> = {
  // Format bez prefiksu "bg-"
  'green-500': 'bg-green-500',
  'blue-500': 'bg-blue-500',
  'purple-500': 'bg-purple-500',
  'pink-500': 'bg-pink-500',
  'orange-500': 'bg-orange-500',
  'red-500': 'bg-red-500',
  'yellow-500': 'bg-yellow-500',
  'indigo-500': 'bg-indigo-500',
  'teal-500': 'bg-teal-500',
  'cyan-500': 'bg-cyan-500',
  'emerald-500': 'bg-emerald-500',
  'gray-500': 'bg-gray-500',

  // Format z prefiksem "bg-" (backward compatibility)
  'bg-green-500': 'bg-green-500',
  'bg-blue-500': 'bg-blue-500',
  'bg-purple-500': 'bg-purple-500',
  'bg-pink-500': 'bg-pink-500',
  'bg-orange-500': 'bg-orange-500',
  'bg-red-500': 'bg-red-500',
  'bg-yellow-500': 'bg-yellow-500',
  'bg-indigo-500': 'bg-indigo-500',
  'bg-teal-500': 'bg-teal-500',
  'bg-cyan-500': 'bg-cyan-500',
  'bg-emerald-500': 'bg-emerald-500',
  'bg-gray-500': 'bg-gray-500',
};

// DEFAULT_WORKSPACE_COLOR - Domyślny kolor
export const DEFAULT_WORKSPACE_COLOR = 'green-500';

// ROLES
// ================================

// WORKSPACE_ROLES - Dostępne role w workspace
export const WORKSPACE_ROLES = ['owner', 'editor', 'viewer'] as const;

// ROLE_LABELS - Polskie nazwy ról
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Właściciel',
  editor: 'Edytor',
  viewer: 'Widz',
  member: 'Członek',
};

// ROLE_COLORS - Kolory dla ról (badge)
export const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800',
  editor: 'bg-blue-100 text-blue-800',
  viewer: 'bg-gray-100 text-gray-800',
  member: 'bg-gray-100 text-gray-800',
};
