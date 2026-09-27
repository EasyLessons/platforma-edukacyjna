/**
 * Adres serwisu whiteboard-sync (Hocuspocus).
 *
 * Osobny moduł bez zależności, żeby prewarm-sync.ts (importowany przez dashboard)
 * nie wciągał do bundla dashboardu yjs i @hocuspocus/provider z use-yjs-sync.ts.
 */
export const WHITEBOARD_SYNC_URL =
  process.env.NEXT_PUBLIC_WHITEBOARD_SYNC_URL ?? 'ws://localhost:1234';
