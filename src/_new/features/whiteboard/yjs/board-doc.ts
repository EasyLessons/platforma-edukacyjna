import * as Y from 'yjs';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import type { DrawingElement } from '../types/elements';
import type { BoardElementWithAuthor } from '../api/whiteboardApi';

// Stałe

export const ELEMENTS_KEY = 'elements';

const INDEX_FIELD = '_index';
const CREATED_BY_FIELD = '_createdBy';
const CREATED_BY_NAME_FIELD = '_createdByName';
const CREATED_AT_FIELD = '_createdAt';

const isInternalField = (key: string): boolean => key.startsWith('_');
const isDerivedField = (key: string): boolean => key === 'bbox';

// Typy

export type TransactionOrigin = unknown;

export interface UpsertMeta {
  createdBy?: number | null;
  createdByName?: string | null;
  createdAt?: string;
}

type ElementFields = Record<string, unknown>;

// Dostęp do root-mapy

export function createBoardDoc(): Y.Doc {
  return new Y.Doc();
}

export function getElementsMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap<Y.Map<unknown>>(ELEMENTS_KEY);
}

// Konwersje

/** DrawingElement -> pola do zapisu w dokumencie */
function toStorableFields(element: DrawingElement): ElementFields {
  const out: ElementFields = {};
  for (const [key, value] of Object.entries(element)) {
    if (isInternalField(key) || isDerivedField(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/** Y.Map elementu -> DrawingElement */
function nodeToElement(node: Y.Map<unknown>): DrawingElement {
  const out: ElementFields = {};
  for (const [key, value] of node.entries()) {
    if (isInternalField(key)) continue;
    out[key] = value;
  }
  return out as unknown as DrawingElement;
}

/** Największy _index w mapie elementów */
function maxIndex(elements: Y.Map<Y.Map<unknown>>): string | null {
  let max: string | null = null;
  for (const node of elements.values()) {
    const idx = node.get(INDEX_FIELD);
    if (typeof idx === 'string' && (max === null || idx > max)) max = idx;
  }
  return max;
}

/** Nadpisuje pola elementu i usuwa te, których nowy element już nie ma.  */
function writeElementFields(node: Y.Map<unknown>, fields: ElementFields): void {
  for (const [key, value] of Object.entries(fields)) {
    if (node.get(key) !== value) node.set(key, value);
  }
  for (const key of [...node.keys()]) {
    if (isInternalField(key)) continue;
    if (!(key in fields)) node.delete(key);
  }
}

/** Zapis jednego elementu do już otwartej transakcji (bez transact). */
function writeElement(
  elements: Y.Map<Y.Map<unknown>>,
  element: DrawingElement,
  meta: UpsertMeta,
  explicitIndex?: string
): void {
  const fields = toStorableFields(element);
  let node = elements.get(element.id);
  if (!node) {
    node = new Y.Map<unknown>();
    node.set(INDEX_FIELD, explicitIndex ?? generateKeyBetween(maxIndex(elements), null));
    node.set(CREATED_BY_FIELD, meta.createdBy ?? null);
    node.set(CREATED_BY_NAME_FIELD, meta.createdByName ?? null);
    node.set(CREATED_AT_FIELD, meta.createdAt ?? new Date().toISOString());
    elements.set(element.id, node);
  } else if (explicitIndex !== undefined) {
    node.set(INDEX_FIELD, explicitIndex);
  }
  writeElementFields(node, fields);
}

// Mutatory

/** Upsert pojedynczego elementu. */
export function upsertElement(
  doc: Y.Doc,
  element: DrawingElement,
  origin: TransactionOrigin,
  meta: UpsertMeta = {}
): void {
  doc.transact(() => writeElement(getElementsMap(doc), element, meta), origin);
}

/** Upsert wielu elementów w jednej transakcji (jedna pozycja undo). */
export function upsertElements(
  doc: Y.Doc,
  elements: DrawingElement[],
  origin: TransactionOrigin,
  metaById: (id: string) => UpsertMeta = () => ({})
): void {
  doc.transact(() => {
    const map = getElementsMap(doc);
    for (const el of elements) writeElement(map, el, metaById(el.id));
  }, origin);
}

/** Usuwa element po id. */
export function deleteElement(doc: Y.Doc, id: string, origin: TransactionOrigin): void {
  doc.transact(() => {
    getElementsMap(doc).delete(id);
  }, origin);
}

/** Zasiewa pusty doc z uporządkowanej tablicy (kolejność -> z-order).
 * Do ładowania z `GET /elements` i do testów. Czyści mapę na starcie.
 */
export function hydrate(
  doc: Y.Doc,
  elements: DrawingElement[],
  origin: TransactionOrigin,
  metaById: (id: string) => UpsertMeta = () => ({})
): void {
  doc.transact(() => {
    const map = getElementsMap(doc);
    map.clear();
    const keys = generateNKeysBetween(null, null, elements.length);
    elements.forEach((el, i) => writeElement(map, el, metaById(el.id), keys[i]));
  }, origin);
}

// Odczyt

/** Jeden element po id albo `null`. */
export function getElement(doc: Y.Doc, id: string): DrawingElement | null {
  const node = getElementsMap(doc).get(id);
  return node ? nodeToElement(node) : null;
}

/** Wszystkie elementy, posortowane po `_index`. */
export function getElements(doc: Y.Doc): DrawingElement[] {
  const rows: { index: string; element: DrawingElement }[] = [];
  for (const node of getElementsMap(doc).values()) {
    const idx = node.get(INDEX_FIELD);
    rows.push({ index: typeof idx === 'string' ? idx : '', element: nodeToElement(node) });
  }
  rows.sort((a, b) =>
    a.index < b.index ? -1 : a.index > b.index ? 1 : a.element.id < b.element.id ? -1 : 1
  );
  return rows.map((r) => r.element);
}

/** Kształt `BoardElementWithAuthor[]` dla paneli ActivityHistory. */
export function getElementsWithAuthor(doc: Y.Doc): BoardElementWithAuthor[] {
  const rows: { index: string; row: BoardElementWithAuthor }[] = [];
  for (const node of getElementsMap(doc).values()) {
    const element = nodeToElement(node);
    const idx = node.get(INDEX_FIELD);
    const createdBy = node.get(CREATED_BY_FIELD);
    const createdByName = node.get(CREATED_BY_NAME_FIELD);
    const createdAt = node.get(CREATED_AT_FIELD);
    rows.push({
      index: typeof idx === 'string' ? idx : '',
      row: {
        element_id: element.id,
        type: element.type,
        data: element as unknown as Record<string, unknown>,
        created_by_id: typeof createdBy === 'number' ? createdBy : null,
        created_by_username: typeof createdByName === 'string' ? createdByName : null,
        created_at: typeof createdAt === 'string' ? createdAt : null,
      },
    });
  }
  rows.sort((a, b) => (a.index < b.index ? -1 : a.index > b.index ? 1 : 1));
  return rows.map((r) => r.row);
}
