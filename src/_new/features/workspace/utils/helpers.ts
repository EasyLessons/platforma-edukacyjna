/**
 * WORKSPACE HELPERS
 * 
 * Funkcje które są używane w wielu miejscach w module workspace.
 * Unikamy duplikacji kodu i trzymamy logikę w jednym miejscu.
 */

import { WORKSPACE_ICONS, COLOR_MAP, DEFAULT_WORKSPACE_ICON } from './constants';
import type { Workspace } from '../types';

// HELPERS - KOLORY
// ================================

// getColorClass - Zwraca klasę Tailwind dla koloru tła
export const getColorClass = (color: string): string => {
  return COLOR_MAP[color] || COLOR_MAP['green-500'];
};

// getTextColorClass - Zwraca stałą klasę Tailwind dla koloru tekstu/ikony
export const getTextColorClass = (color: string): string => {
  const map: Record<string, string> = {
    'green-500': 'text-green-500',
    'blue-500': 'text-blue-500',
    'purple-500': 'text-purple-500',
    'pink-500': 'text-pink-500',
    'orange-500': 'text-orange-500',
    'red-500': 'text-red-500',
    'yellow-500': 'text-yellow-500',
    'indigo-500': 'text-indigo-500',
    'teal-500': 'text-teal-500',
    'cyan-500': 'text-cyan-500',
    'emerald-500': 'text-emerald-500',
    'gray-500': 'text-gray-500'
  };
  return map[normalizeColorFormat(color)] || 'text-gray-500';
};

// normalizeColorFormat - Normalizuje format koloru dla backendu
export const normalizeColorFormat = (color: string): string => {
  return color.replace(/^bg-/, '');
};

// HELPERS - IKONY
// ================================

// getIconComponent - Zwraca komponent ikony
export const getIconComponent = (iconName: string) => {
  return (
    WORKSPACE_ICONS[iconName as keyof typeof WORKSPACE_ICONS] ||
    WORKSPACE_ICONS[DEFAULT_WORKSPACE_ICON as keyof typeof WORKSPACE_ICONS]
  );
};

// HELPERS - SORTOWANIE
// ================================

// sortWorkspacesByFavourite - Sortuje workspace'y (ulubione na górze)
export const sortWorkspacesByFavourite = (
  workspaces: Workspace[]
): Workspace[] => {
  return [...workspaces].sort((a, b) => {
    // Ulubione na górze
    if (a.is_favourite && !b.is_favourite) return -1;
    if (!a.is_favourite && b.is_favourite) return 1;

    // Alfabetycznie po nazwie
    return a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' });
  });
};

// sortWorkspacesByCustomOrder - Sortuje według własnej kolejności (użytkownik może ręcznie zmieniać kolejność)
export const sortWorkspacesByCustomOrder = (
  workspaces: Workspace[],
  customOrder: number[]
): Workspace[] => {
  if (!customOrder.length) return workspaces;

  return [...workspaces].sort((a, b) => {
    // Poziom 1: ulubione zawsze na górze
    if (a.is_favourite && !b.is_favourite) return -1;
    if (!a.is_favourite && b.is_favourite) return 1;

    // Poziom 2: kolejność z localStorage w ramach grupy
    const aIndex = customOrder.indexOf(a.id);
    const bIndex = customOrder.indexOf(b.id);
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;

    return 0;
  });
};

// HELPERS - WYSZUKIWANIE
// ================================

// filterWorkspaceByQuery - Filtruje workspace'y po zapytaniu
export const filterWorkspacesByQuery = (
  workspaces: Workspace[],
  query: string
): Workspace[] => {
  if (!query.trim()) return workspaces;

  const lowerQuery = query.toLowerCase();

  return workspaces.filter((workspace) =>
    workspace.name.toLowerCase().includes(lowerQuery)
  );
};

// HELPERS - FORMATOWANIE
// ================================

// formatWorkspaceMemberCount - Formatuje liczbę członków
export const formatWorkspaceMemberCount = (count: number): string => {
  if (count === 1) return '1 członek';
  if (count < 5) return `${count} członków`;
  return `${count} członków`;
};

// formatWorkspaceBoardCount - Formatuje liczbę tablic
export const formatWorkspaceBoardCount = (count: number): string => {
  if (count === 1) return '1 tablica';
  if (count < 5) return `${count} tablice`;
  return `${count} tablic`;
};


