import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import {
  ExcalidrawYjsBinding,
  FILES_KEY,
  isFileRef,
  isInlineFile,
  isNewerVersion,
  isStoredFile,
  type StoredElement,
  type StoredFile,
} from './excalidraw-binding';

const el = (id: string, version: number, extra: Partial<StoredElement> = {}): StoredElement => ({
  id,
  type: 'rectangle',
  version,
  versionNonce: 1000,
  isDeleted: false,
  x: 0,
  y: 0,
  updated: 1,
  ...extra,
});

/** Dwa dokumenty spięte "siecią" (synchroniczne przekazywanie update'ów). */
function connectedPair() {
  const docA = new Y.Doc();
  const docB = new Y.Doc();
  docA.on('update', (u: Uint8Array, origin: unknown) => {
    if (origin !== 'net') Y.applyUpdate(docB, u, 'net');
  });
  docB.on('update', (u: Uint8Array, origin: unknown) => {
    if (origin !== 'net') Y.applyUpdate(docA, u, 'net');
  });
  return { a: new ExcalidrawYjsBinding(docA, 'A'), b: new ExcalidrawYjsBinding(docB, 'B') };
}

describe('isNewerVersion', () => {
  it('brak poprzedniego -> nowy', () => {
    expect(isNewerVersion(undefined, el('1', 1))).toBe(true);
  });
  it('wyższa wersja wygrywa, niższa przegrywa', () => {
    expect(isNewerVersion(el('1', 1), el('1', 2))).toBe(true);
    expect(isNewerVersion(el('1', 2), el('1', 1))).toBe(false);
  });
  it('remis wersji: mniejszy versionNonce wygrywa, równy = bez zmian', () => {
    expect(isNewerVersion(el('1', 1, { versionNonce: 5 }), el('1', 1, { versionNonce: 3 }))).toBe(
      true
    );
    expect(isNewerVersion(el('1', 1, { versionNonce: 3 }), el('1', 1, { versionNonce: 5 }))).toBe(
      false
    );
    expect(isNewerVersion(el('1', 1), el('1', 1))).toBe(false);
  });
});

describe('ExcalidrawYjsBinding', () => {
  it('pushLocal zapisuje nowe elementy i pomija niezmienione (echo)', () => {
    const b = new ExcalidrawYjsBinding(new Y.Doc(), 'A');
    expect(b.pushLocal([el('r1', 1), el('r2', 1)])).toBe(2);
    expect(b.pushLocal([el('r1', 1), el('r2', 1)])).toBe(0);
    expect(b.pushLocal([el('r1', 2), el('r2', 1)])).toBe(1);
    expect(b.getElements().find((e) => e.id === 'r1')?.version).toBe(2);
  });

  it('zmiana lokalna w A dociera do B jako zdalna, a echo nie wraca do A', () => {
    const { a, b } = connectedPair();
    const onRemoteA = vi.fn();
    const onRemoteB = vi.fn();
    a.observeRemote(onRemoteA);
    b.observeRemote(onRemoteB);

    a.pushLocal([el('r1', 1, { x: 10 })]);

    expect(onRemoteB).toHaveBeenCalledTimes(1);
    expect(onRemoteB.mock.calls[0][0]).toEqual([expect.objectContaining({ id: 'r1', x: 10 })]);
    expect(onRemoteA).not.toHaveBeenCalled();
    // B "odbija" te same elementy przez pushLocal (jak onChange po updateScene) - zero zapisów
    expect(b.pushLocal(b.getElements())).toBe(0);
  });

  it('przesunięcie (wyższa wersja) i usunięcie (isDeleted) propagują', () => {
    const { a, b } = connectedPair();
    a.pushLocal([el('r1', 1, { x: 0 })]);
    a.pushLocal([el('r1', 2, { x: 100 })]);
    expect(b.getElements()[0]).toMatchObject({ x: 100, version: 2 });

    a.pushLocal([el('r1', 3, { x: 100, isDeleted: true })]);
    expect(b.getElements()[0].isDeleted).toBe(true);
    expect(b.counts()).toEqual({ live: 0, deleted: 1 });
  });

  it('konflikt: obie strony edytują ten sam element offline -> zbiegają do tej samej wersji', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    const a = new ExcalidrawYjsBinding(docA, 'A');
    const b = new ExcalidrawYjsBinding(docB, 'B');
    a.pushLocal([el('r1', 1)]);
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA), 'net');

    a.pushLocal([el('r1', 2, { x: 50, versionNonce: 7 })]);
    b.pushLocal([el('r1', 2, { x: 99, versionNonce: 3 })]);
    // wymiana update'ów w obie strony
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA), 'net');
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB), 'net');

    // Y.Map: ostatni zapis wygrywa na poziomie CRDT, ale obie strony mają TĘ SAMĄ wartość
    expect(a.getElements()[0]).toEqual(b.getElements()[0]);
  });

  it('pliki: pushFiles dopisuje brakujące, obserwator zdalny dostaje tylko nowe', () => {
    const { a, b } = connectedPair();
    const onFilesB = vi.fn();
    b.observeRemoteFiles(onFilesB);
    const f = {
      id: 'f1',
      mimeType: 'image/svg+xml',
      dataURL: 'data:image/svg+xml,<svg/>',
      created: 1,
    };
    expect(a.pushFiles([f])).toBe(1);
    expect(a.pushFiles([f])).toBe(0);
    expect(onFilesB).toHaveBeenCalledTimes(1);
    expect(onFilesB.mock.calls[0][0]).toEqual([expect.objectContaining({ id: 'f1' })]);
    expect(b.getFiles()).toHaveLength(1);
  });

  it('pliki: odwołanie do Storage (ref) bez dataURL, stary format (dataURL) czytany obok', () => {
    const { a, b } = connectedPair();
    const onFilesB = vi.fn();
    b.observeRemoteFiles(onFilesB);
    const inline = {
      id: 'stary',
      mimeType: 'image/png',
      dataURL: 'data:image/png;base64,AAAA',
      created: 1,
    };
    const name = `${'a1'.repeat(16)}.webp`;

    a.pushFiles([inline]);
    a.setFileRef({ id: 'nowy', mimeType: 'image/webp', created: 2, name });

    expect(a.hasFile('nowy')).toBe(true);
    expect(a.hasFile('brak')).toBe(false);
    const ref = b.getFile('nowy') as StoredFile;
    expect(ref).toEqual({ id: 'nowy', mimeType: 'image/webp', created: 2, ref: { v: 1, name } });
    expect(isFileRef(ref)).toBe(true);
    expect(isInlineFile(ref)).toBe(false);
    const old = b.getFile('stary') as StoredFile;
    expect(isInlineFile(old)).toBe(true);
    expect(isFileRef(old)).toBe(false);
    // obserwator zdalny dostaje oba wpisy (każdy w swoim formacie)
    expect(onFilesB.mock.calls.flatMap((c) => c[0].map((f: StoredFile) => f.id))).toEqual([
      'stary',
      'nowy',
    ]);
    // pushFiles nie nadpisuje odwołania wersją inline o tym samym id
    expect(a.pushFiles([{ ...inline, id: 'nowy' }])).toBe(0);
    expect(isFileRef(a.getFile('nowy') as StoredFile)).toBe(true);
  });

  it('hasElement: tylko elementy zapisane w dokumencie', () => {
    const a = new ExcalidrawYjsBinding(new Y.Doc(), 'A');
    a.pushLocal([el('r1', 1)]);
    expect(a.hasElement('r1')).toBe(true);
    expect(a.hasElement('r2')).toBe(false);
  });

  it('gcDeleted usuwa stare tombstone`y, zostawia żywe i świeżo skasowane', () => {
    const a = new ExcalidrawYjsBinding(new Y.Doc(), 'A');
    a.pushLocal([
      el('old', 2, { isDeleted: true, updated: 1_000 }),
      el('fresh', 2, { isDeleted: true, updated: 9_000 }),
      el('live', 1, { updated: 1_000 }),
    ]);
    expect(a.gcDeleted(5_000, 10_000)).toBe(1);
    expect(
      a
        .getElements()
        .map((e) => e.id)
        .sort()
    ).toEqual(['fresh', 'live']);
  });

  it('elementy zamrożone (Object.freeze) trafiają do mapy jako zwykły JSON', () => {
    const a = new ExcalidrawYjsBinding(new Y.Doc(), 'A');
    const frozen = Object.freeze(
      el('r1', 1, {
        points: Object.freeze([
          [0, 0],
          [1, 1],
        ]) as unknown as number[][],
      })
    );
    a.pushLocal([frozen]);
    const stored = a.getElements()[0];
    expect(Object.isFrozen(stored)).toBe(false);
    expect(stored.points).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });
});

describe('ExcalidrawYjsBinding - śmieciowe wpisy w mapie plików', () => {
  const GARBAGE: unknown[] = [null, undefined, 0, 'tekst', [], {}, { id: 1 }];
  const good = {
    id: 'dobry',
    mimeType: 'image/png',
    dataURL: 'data:image/png;base64,AA==',
    created: 1,
  };

  it('isInlineFile / isFileRef / isStoredFile nie rzucają dla null i nie-obiektów', () => {
    for (const value of GARBAGE) {
      expect(isStoredFile(value)).toBe(false);
      expect(isInlineFile(value)).toBe(false);
      expect(isFileRef(value)).toBe(false);
    }
  });

  it('getFiles i obserwator zdalny pomijają wpis null zapisany przez innego klienta', () => {
    const docA = new Y.Doc();
    const docB = new Y.Doc();
    docA.on('update', (u: Uint8Array) => Y.applyUpdate(docB, u, 'net'));
    const b = new ExcalidrawYjsBinding(docB, 'B');
    const onFiles = vi.fn();
    b.observeRemoteFiles(onFiles);

    const rawFiles = docA.getMap<unknown>(FILES_KEY);
    docA.transact(() => {
      rawFiles.set('zly', null);
      rawFiles.set('liczba', 5);
      rawFiles.set('dobry', good);
    });

    expect(b.getFiles()).toEqual([good]);
    expect(onFiles.mock.calls.flatMap((c) => c[0])).toEqual([good]);
  });

  it('pushFiles pomija null i nie-obiekty', () => {
    const a = new ExcalidrawYjsBinding(new Y.Doc(), 'A');

    expect(a.pushFiles([null, 3, good] as unknown as StoredFile[])).toBe(1);
    expect(a.pushFiles({ zly: null, dobry: good } as unknown as Record<string, StoredFile>)).toBe(
      0
    );
    expect(a.getFiles()).toEqual([good]);
  });
});
