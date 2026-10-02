/**
 * Wiązanie Excalidraw <-> Y.Doc (własne, zamiast `y-excalidraw`).
 *
 * Dlaczego własne: `y-excalidraw` (npm 2.0.12) ma ostatnie wydanie z grudnia
 * 2024 i peerDependency `@excalidraw/excalidraw ^0.17.6`; my używamy 0.18.x,
 * gdzie zmienił się model elementów (fractional `index`, `CaptureUpdateAction`).
 *
 * Model danych w Y.Doc:
 *   Y.Map<ELEMENTS_KEY>: id -> element Excalidraw jako zwykły JSON
 *   Y.Map<FILES_KEY>:    fileId -> wpis pliku w jednym z dwóch formatów:
 *     - inline `{ id, mimeType, dataURL, created }` - SVG wykresów, tablice bez serwera
 *       (demo) i wpisy sprzed przeniesienia obrazów do Storage,
 *     - odwołanie `{ id, mimeType, created, ref: { v: 1, name } }` - plik leży w Storage
 *       (bucket `board-files`), w dokumencie NIE MA dataURL (files/board-file-sync.ts).
 *
 * Każdy element to JEDEN wpis (nie Y.Map per pole). Excalidraw i tak traktuje
 * element jako niemutowalną całość z `version`/`versionNonce`, a rozwiązywanie
 * konfliktów robi `reconcileElements` po stronie klienta - więc granularność
 * per element w zupełności wystarcza i jest tania (jeden `set` na zmianę).
 *
 * Kierunek lokalny -> zdalny: `pushLocal(elements)` porównuje `version` z tym,
 * co w mapie, i zapisuje tylko zmienione. Dzięki temu echo z `updateScene`
 * (które też wywołuje `onChange`) nie generuje kolejnych zapisów.
 *
 * Kierunek zdalny -> lokalny: `observe` odpala się TYLKO dla transakcji spoza
 * naszego `origin` (czyli z sieci / z IndexedDB) i podaje pełną listę
 * elementów - komponent przepuszcza ją przez `reconcileElements`.
 */

import * as Y from 'yjs';

export const ELEMENTS_KEY = 'excalidraw-elements';
export const FILES_KEY = 'excalidraw-files';

/** Minimalny kształt elementu, na którym operuje wiązanie (reszta pól = JSON). */
export interface StoredElement {
  id: string;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  [key: string]: unknown;
}

interface StoredFileBase {
  id: string;
  mimeType: string;
  created: number;
  [key: string]: unknown;
}

/** Plik w całości w dokumencie (dataURL). */
export interface StoredInlineFile extends StoredFileBase {
  dataURL: string;
}

/** Odwołanie do pliku w Storage; `name` to nazwa nadana przez backend (`<32 hex>.webp`). */
export interface StoredFileRef extends StoredFileBase {
  ref: { v: 1; name: string };
}

export type StoredFile = StoredInlineFile | StoredFileRef;

export function isInlineFile(file: StoredFile): file is StoredInlineFile {
  return typeof file.dataURL === 'string';
}

/** Wpis-odwołanie (bez dataURL). Kształtu `ref` NIE sprawdza - to robi odbiorca. */
export function isFileRef(file: StoredFile): file is StoredFileRef {
  return !isInlineFile(file) && typeof file.ref === 'object' && file.ref !== null;
}

export type RemoteListener = (elements: StoredElement[]) => void;
export type RemoteFilesListener = (files: StoredFile[]) => void;

/** Czy element `next` jest nowszy niż `prev` (ta sama logika wyboru co reconcileElements). */
export function isNewerVersion(prev: StoredElement | undefined, next: StoredElement): boolean {
  if (!prev) return true;
  if (next.version > prev.version) return true;
  if (next.version < prev.version) return false;
  // remis wersji: Excalidraw wybiera mniejszy versionNonce; zapisujemy tylko gdy
  // się różni, żeby oba klienty zbiegły do tej samej wartości
  return next.versionNonce !== prev.versionNonce && next.versionNonce < prev.versionNonce;
}

export class ExcalidrawYjsBinding {
  readonly doc: Y.Doc;
  readonly origin: unknown;
  readonly elements: Y.Map<StoredElement>;
  readonly files: Y.Map<StoredFile>;

  constructor(doc: Y.Doc, origin: unknown = Symbol('excalidraw-local')) {
    this.doc = doc;
    this.origin = origin;
    this.elements = doc.getMap<StoredElement>(ELEMENTS_KEY);
    this.files = doc.getMap<StoredFile>(FILES_KEY);
  }

  /** Zapisuje do Y.Doc tylko te elementy, których wersja jest nowsza niż w mapie. Zwraca liczbę zapisów. */
  pushLocal(elements: readonly StoredElement[]): number {
    const changed: StoredElement[] = [];
    for (const el of elements) {
      if (isNewerVersion(this.elements.get(el.id), el)) changed.push(el);
    }
    if (changed.length === 0) return 0;
    this.doc.transact(() => {
      for (const el of changed) this.elements.set(el.id, toPlainJson(el));
    }, this.origin);
    return changed.length;
  }

  /** Dopisuje pliki, których jeszcze nie ma (pliki są niemutowalne - id = hash zawartości). */
  pushFiles(files: Record<string, StoredFile> | readonly StoredFile[]): number {
    const list = Array.isArray(files) ? files : Object.values(files);
    const missing = (list as StoredFile[]).filter((f) => !this.files.has(f.id));
    if (missing.length === 0) return 0;
    this.doc.transact(() => {
      for (const f of missing) this.files.set(f.id, toPlainJson(f));
    }, this.origin);
    return missing.length;
  }

  /** Podmienia plik (np. po edycji wzoru wykresu regenerujemy SVG pod nowym id, stary zostaje). */
  setFile(file: StoredFile): void {
    this.doc.transact(() => this.files.set(file.id, toPlainJson(file)), this.origin);
  }

  /** Zapisuje odwołanie do pliku w Storage (bez dataURL). */
  setFileRef(file: { id: string; mimeType: string; created: number; name: string }): void {
    const entry: StoredFileRef = {
      id: file.id,
      mimeType: file.mimeType,
      created: file.created,
      ref: { v: 1, name: file.name },
    };
    this.doc.transact(() => this.files.set(file.id, entry), this.origin);
  }

  hasFile(id: string): boolean {
    return this.files.has(id);
  }

  getFile(id: string): StoredFile | undefined {
    return this.files.get(id);
  }

  hasElement(id: string): boolean {
    return this.elements.has(id);
  }

  /** Wszystkie elementy z dokumentu (łącznie z isDeleted - reconcile ich potrzebuje). */
  getElements(): StoredElement[] {
    return Array.from(this.elements.values());
  }

  getFiles(): StoredFile[] {
    return Array.from(this.files.values());
  }

  /** Liczba elementów żywych / skasowanych - do statystyk i testów. */
  counts(): { live: number; deleted: number } {
    let live = 0;
    let deleted = 0;
    for (const el of this.elements.values()) {
      if (el.isDeleted) deleted += 1;
      else live += 1;
    }
    return { live, deleted };
  }

  /** Nasłuch zmian ZDALNYCH (transakcje z innym origin niż nasz). */
  observeRemote(listener: RemoteListener): () => void {
    const handler = (_events: Y.YMapEvent<StoredElement>, tr: Y.Transaction) => {
      if (tr.origin === this.origin) return;
      listener(this.getElements());
    };
    this.elements.observe(handler);
    return () => this.elements.unobserve(handler);
  }

  observeRemoteFiles(listener: RemoteFilesListener): () => void {
    const handler = (event: Y.YMapEvent<StoredFile>, tr: Y.Transaction) => {
      if (tr.origin === this.origin) return;
      const added: StoredFile[] = [];
      for (const key of event.keysChanged) {
        const f = this.files.get(key);
        if (f) added.push(f);
      }
      if (added.length) listener(added);
    };
    this.files.observe(handler);
    return () => this.files.unobserve(handler);
  }

  /**
   * Sprzątanie: usuwa z mapy elementy `isDeleted` starsze niż `olderThanMs`
   * (Excalidraw zostawia je jako tombstone'y, żeby reconcile działał; po
   * czasie można je usunąć na dobre - analogicznie do GC w excalidraw-room).
   */
  gcDeleted(olderThanMs: number, now = Date.now()): number {
    const toDelete: string[] = [];
    for (const [id, el] of this.elements.entries()) {
      const updated = typeof el.updated === 'number' ? el.updated : 0;
      if (el.isDeleted && now - updated > olderThanMs) toDelete.push(id);
    }
    if (toDelete.length === 0) return 0;
    this.doc.transact(() => {
      for (const id of toDelete) this.elements.delete(id);
    }, this.origin);
    return toDelete.length;
  }
}

/** Excalidraw trzyma elementy jako zamrożone obiekty z brandami typów; do Y.Map idzie czysty JSON. */
function toPlainJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
