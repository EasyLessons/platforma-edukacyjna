/**
 * Awareness (Yjs, przez HocuspocusProvider) -> `collaborators` dla Excalidraw.
 *
 * Stan lokalny każdego klienta w awareness:
 *   { user: {name, color}, pointer?: {x,y,tool}, button?: 'up'|'down', selectedElementIds? }
 * Excalidraw dostaje Map<SocketId, Collaborator> przez `updateScene({ collaborators })`
 * i sam rysuje kursory + listę osób.
 */

import type { Collaborator, SocketId } from '@excalidraw/excalidraw/types';

export interface AwarenessUser {
  name: string;
  color: { background: string; stroke: string };
}

export interface LocalAwarenessState {
  user: AwarenessUser;
  pointer?: { x: number; y: number; tool: 'pointer' | 'laser' };
  button?: 'up' | 'down';
  selectedElementIds?: Record<string, true>;
}

/**
 * Część `Awareness` z y-protocols, której potrzebujemy do odczytu. Bez importu
 * `y-protocols` (jest tylko zależnością przechodnią `@hocuspocus/provider`).
 */
export interface AwarenessStates {
  clientID: number;
  getStates(): Map<number, unknown>;
}

const PALETTE: { background: string; stroke: string }[] = [
  { background: '#fde68a', stroke: '#b45309' },
  { background: '#bfdbfe', stroke: '#1d4ed8' },
  { background: '#bbf7d0', stroke: '#15803d' },
  { background: '#fecaca', stroke: '#b91c1c' },
  { background: '#e9d5ff', stroke: '#7e22ce' },
  { background: '#fed7aa', stroke: '#c2410c' },
];

export function pickUserColor(seed: number): { background: string; stroke: string } {
  return PALETTE[Math.abs(seed) % PALETTE.length];
}

/** Buduje mapę współpracowników z awareness, pomijając własny clientID. */
export function collaboratorsFromAwareness(
  awareness: AwarenessStates
): Map<SocketId, Collaborator> {
  const out = new Map<SocketId, Collaborator>();
  for (const [clientId, raw] of awareness.getStates()) {
    if (clientId === awareness.clientID) continue;
    const state = raw as Partial<LocalAwarenessState> | undefined;
    if (!state?.user) continue;
    out.set(String(clientId) as SocketId, {
      id: String(clientId),
      username: state.user.name,
      color: state.user.color,
      pointer: state.pointer,
      button: state.button ?? 'up',
      selectedElementIds: state.selectedElementIds,
    });
  }
  return out;
}
