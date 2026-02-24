/**
 * BOARD CONSTANTS
 *
 * Centralne miejsce dla wszystkich stałych używanych w module board.
 *
 */

import {
  PenTool,
  Calculator,
  Globe,
  Lightbulb,
  Target,
  Rocket,
  BookOpen,
  Presentation,
  Zap,
  Compass,
  Cpu,
  Palette,
  Camera,
  Music,
  Video,
  Film,
  Code,
  Terminal,
  Database,
  Server,
  Cloud,
  Wifi,
  Smartphone,
  Monitor,
  Laptop,
  Gamepad2,
  Trophy,
  Star,
  Heart,
  Flame,
  Sparkles,
  Award,
  Home,
  Users,
  Calendar,
  FileText,
  MessageCircle,
  Bell,
} from 'lucide-react';

// ICONS
// ================================

export const BOARD_ICONS = {
  PenTool,
  Calculator,
  Globe,
  Lightbulb,
  Target,
  Rocket,
  BookOpen,
  Presentation,
  Zap,
  Compass,
  Cpu,
  Palette,
  Camera,
  Music,
  Video,
  Film,
  Code,
  Terminal,
  Database,
  Server,
  Cloud,
  Wifi,
  Smartphone,
  Monitor,
  Laptop,
  Gamepad2,
  Trophy,
  Star,
  Heart,
  Flame,
  Sparkles,
  Award,
  Home,
  Users,
  Calendar,
  FileText,
  MessageCircle,
  Bell,
} as const;

export const BOARD_ICON_NAMES = Object.keys(BOARD_ICONS) as Array<keyof typeof BOARD_ICONS>;

export const DEFAULT_BOARD_ICON = 'PenTool';

// COLORS
// ================================

export const BOARD_COLORS = [
  'gray-500',
  'blue-500',
  'green-500',
  'purple-500',
  'pink-500',
  'red-500',
  'orange-500',
  'yellow-500',
  'teal-500',
  'indigo-500',
  'cyan-500',
  'emerald-500',
] as const;

export const DEFAULT_BOARD_COLOR = 'gray-500';

// COLOR_MAP - Mapowanie nazwy koloru na klasę Tailwind bg-*.
export const COLOR_MAP: Record<string, string> = {
  'gray-500': 'bg-gray-500',
  'blue-500': 'bg-blue-500',
  'green-500': 'bg-green-500',
  'purple-500': 'bg-purple-500',
  'pink-500': 'bg-pink-500',
  'red-500': 'bg-red-500',
  'orange-500': 'bg-orange-500',
  'yellow-500': 'bg-yellow-500',
  'teal-500': 'bg-teal-500',
  'indigo-500': 'bg-indigo-500',
  'cyan-500': 'bg-cyan-500',
  'emerald-500': 'bg-emerald-500',
  // backward compatibility
  'bg-gray-500': 'bg-gray-500',
  'bg-blue-500': 'bg-blue-500',
  'bg-green-500': 'bg-green-500',
  'bg-purple-500': 'bg-purple-500',
  'bg-pink-500': 'bg-pink-500',
  'bg-red-500': 'bg-red-500',
  'bg-orange-500': 'bg-orange-500',
  'bg-yellow-500': 'bg-yellow-500',
  'bg-teal-500': 'bg-teal-500',
  'bg-indigo-500': 'bg-indigo-500',
  'bg-cyan-500': 'bg-cyan-500',
  'bg-emerald-500': 'bg-emerald-500',
};

// GRADIENT_MAP - Mapowanie nazwy koloru na gradient Tailwind.
// Używane przez board-card (ikona tablicy ma gradient zamiast flat color).
export const GRADIENT_MAP: Record<string, string> = {
  'gray-500': 'from-gray-400 to-gray-600',
  'blue-500': 'from-blue-400 to-blue-600',
  'green-500': 'from-green-400 to-green-600',
  'purple-500': 'from-purple-400 to-purple-600',
  'pink-500': 'from-pink-400 to-pink-600',
  'red-500': 'from-red-400 to-red-600',
  'orange-500': 'from-orange-400 to-orange-600',
  'yellow-500': 'from-yellow-400 to-yellow-600',
  'teal-500': 'from-teal-400 to-teal-600',
  'indigo-500': 'from-indigo-400 to-indigo-600',
  'cyan-500': 'from-cyan-400 to-cyan-600',
  'emerald-500': 'from-emerald-400 to-emerald-600',
  // backward compatibility
  'bg-gray-500': 'from-gray-400 to-gray-600',
  'bg-blue-500': 'from-blue-400 to-blue-600',
  'bg-green-500': 'from-green-400 to-green-600',
  'bg-purple-500': 'from-purple-400 to-purple-600',
  'bg-pink-500': 'from-pink-400 to-pink-600',
  'bg-red-500': 'from-red-400 to-red-600',
  'bg-orange-500': 'from-orange-400 to-orange-600',
  'bg-yellow-500': 'from-yellow-400 to-yellow-600',
  'bg-teal-500': 'from-teal-400 to-teal-600',
  'bg-indigo-500': 'from-indigo-400 to-indigo-600',
  'bg-cyan-500': 'from-cyan-400 to-cyan-600',
  'bg-emerald-500': 'from-emerald-400 to-emerald-600',
};

// AVATAR COLORS
// Używane do kolorowania awatarów użytkowników online na karcie tablicy.
// ================================

export const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-cyan-500',
] as const;