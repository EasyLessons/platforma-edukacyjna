/**
 * spatial-index.ts
 *
 * R-Tree spatial index dla elementów tablicy.
 * Zamiast iterować przez WSZYSTKIE elementy przy każdej klatce,
 * pytamy indeks "które elementy są w tym obszarze?" → O(log n + k)
 * gdzie k = liczba widocznych elementów (zazwyczaj kilkadziesiąt, nie tysiące).
 *
 * Używa biblioteki `rbush` (2 KB gzip, używana przez Mapbox i Leaflet).
 */

import RBush from 'rbush';
import type { DrawingElement, DrawingPath } from '../types';
import { computePathBbox } from './viewport-math';

// ─── Typy ────────────────────────────────────────────────────────────────────

export interface SpatialItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Zamienia DrawingElement na prostokąt w układzie świata (world units). */
export function elementToBbox(element: DrawingElement): SpatialItem | null {
  const id = element.id;

  if (element.type === 'path') {
    if (element.points.length === 0) return null;
    if (!element.bbox) {
      (element as DrawingPath).bbox = computePathBbox(element);
    }
    const bb = element.bbox!;
    // Dodaj half-width jako margines żeby grube kreski się nie urywały
    const hw = (element.width ?? 0) / 2 / 100;
    return { minX: bb.minX - hw, minY: bb.minY - hw, maxX: bb.maxX + hw, maxY: bb.maxY + hw, id };
  }

  if (element.type === 'shape' || element.type === 'arrow') {
    return {
      minX: Math.min(element.startX, element.endX),
      minY: Math.min(element.startY, element.endY),
      maxX: Math.max(element.startX, element.endX),
      maxY: Math.max(element.startY, element.endY),
      id,
    };
  }

  if ('x' in element && 'y' in element) {
    const e = element as any;
    return {
      minX: e.x,
      minY: e.y,
      maxX: e.x + (e.width || 0),
      maxY: e.y + (e.height || 0),
      id,
    };
  }

  // function i inne typy bez stałej pozycji — nie indeksujemy
  return null;
}

// ─── Klasa indeksu ────────────────────────────────────────────────────────────

export class ElementSpatialIndex {
  private tree = new RBush<SpatialItem>();
  /** id → SpatialItem — potrzebne do usuwania (rbush wymaga dokładnego obiektu) */
  private itemsById = new Map<string, SpatialItem>();
  /** Zestaw id elementów nieindeksowanych (function, markdown) — zawsze renderowane */
  private alwaysRender = new Set<string>();

  /** Przebuduj indeks od zera (przy inicjalizacji lub dużym batch update). */
  rebuild(elements: DrawingElement[]): void {
    this.tree.clear();
    this.itemsById.clear();
    this.alwaysRender.clear();

    const items: SpatialItem[] = [];
    for (const el of elements) {
      if (el.type === 'function' || el.type === 'markdown') {
        this.alwaysRender.add(el.id);
        continue;
      }
      const item = elementToBbox(el);
      if (item) {
        items.push(item);
        this.itemsById.set(el.id, item);
      }
    }
    this.tree.load(items); // bulk load — znacznie szybszy niż insert jeden po jeden
  }

  /** Dodaj nowe elementy do indeksu. */
  insert(elements: DrawingElement[]): void {
    for (const el of elements) {
      if (el.type === 'function' || el.type === 'markdown') {
        this.alwaysRender.add(el.id);
        continue;
      }
      const item = elementToBbox(el);
      if (item) {
        this.tree.insert(item);
        this.itemsById.set(el.id, item);
      }
    }
  }

  /** Zaktualizuj element (usuń stary bbox, wstaw nowy). */
  update(element: DrawingElement): void {
    this.remove(element.id);
    if (element.type === 'function' || element.type === 'markdown') {
      this.alwaysRender.add(element.id);
      return;
    }
    const item = elementToBbox(element);
    if (item) {
      this.tree.insert(item);
      this.itemsById.set(element.id, item);
    }
  }

  /** Usuń element z indeksu. */
  remove(id: string): void {
    const existing = this.itemsById.get(id);
    if (existing) {
      this.tree.remove(existing);
      this.itemsById.delete(id);
    }
    this.alwaysRender.delete(id);
  }

  /**
   * Zapytaj indeks o elementy w podanym prostokącie świata.
   * Zwraca Set id widocznych elementów + id elementów alwaysRender.
   */
  query(
    worldMinX: number,
    worldMinY: number,
    worldMaxX: number,
    worldMaxY: number
  ): Set<string> {
    const results = this.tree.search({
      minX: worldMinX,
      minY: worldMinY,
      maxX: worldMaxX,
      maxY: worldMaxY,
    });

    const visible = new Set<string>(this.alwaysRender);
    for (const item of results) visible.add(item.id);
    return visible;
  }

  get size(): number {
    return this.itemsById.size + this.alwaysRender.size;
  }
}
