import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { ExcalidrawYjsBinding, isNewerVersion, type StoredElement } from './excalidraw-binding';

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
