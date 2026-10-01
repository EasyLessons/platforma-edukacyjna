import type { HocuspocusProvider } from '@hocuspocus/provider';

/** Awareness połączenia z whiteboard-sync (y-protocols, przez HocuspocusProvider). */
export type BoardAwareness = NonNullable<HocuspocusProvider['awareness']>;
