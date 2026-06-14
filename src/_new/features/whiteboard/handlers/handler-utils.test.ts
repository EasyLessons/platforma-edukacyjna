import { describe, it, expect } from 'vitest';
import { rotateAroundPivot, getRotatedAABB, getSimpleAABB } from './handler-utils';

const ORIGIN = { x: 0, y: 0 };

// ─── rotateAroundPivot ─────────────────────────────────────────────────────

describe('rotateAroundPivot', () => {
  it('obrót o 0 rad — punkt bez zmian', () => {
    const cos = Math.cos(0); // 1
    const sin = Math.sin(0); // 0
    const result = rotateAroundPivot({ x: 3, y: 5 }, ORIGIN, cos, sin);
    expect(result.x).toBeCloseTo(3);
    expect(result.y).toBeCloseTo(5);
  });

  it('obrót o π/2 (90°) wokół (0,0): (1,0) → (0,1)', () => {
    const angle = Math.PI / 2;
    const cos = Math.cos(angle); // ~0
    const sin = Math.sin(angle); // ~1
    const result = rotateAroundPivot({ x: 1, y: 0 }, ORIGIN, cos, sin);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(1);
  });

  it('obrót o π (180°) wokół (0,0): (1,0) → (-1,0)', () => {
    const angle = Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const result = rotateAroundPivot({ x: 1, y: 0 }, ORIGIN, cos, sin);
    expect(result.x).toBeCloseTo(-1);
    expect(result.y).toBeCloseTo(0);
  });

  it('obrót o -π/2 (-90°) wokół (0,0): (0,1) → (1,0)', () => {
    const angle = -Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const result = rotateAroundPivot({ x: 0, y: 1 }, ORIGIN, cos, sin);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(0);
  });

  it('obrót wokół pivota innego niż (0,0) — translacja jest uwzględniona', () => {
    const pivot = { x: 1, y: 1 };
    const angle = Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // punkt (2,1) względem pivota (1,1) to dx=1, dy=0
    // po obrocie: dx'=0, dy'=1 → wynik: (1+0, 1+1) = (1, 2)
    const result = rotateAroundPivot({ x: 2, y: 1 }, pivot, cos, sin);
    expect(result.x).toBeCloseTo(1);
    expect(result.y).toBeCloseTo(2);
  });

  it('pivot jest niezmieniony przez obrót (sam siebie)', () => {
    const pivot = { x: 5, y: 3 };
    const angle = Math.PI / 3;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const result = rotateAroundPivot(pivot, pivot, cos, sin);
    expect(result.x).toBeCloseTo(pivot.x);
    expect(result.y).toBeCloseTo(pivot.y);
  });
});

// ─── getRotatedAABB ────────────────────────────────────────────────────────

describe('getRotatedAABB', () => {
  it('obrót 0 rad — AABB równy oryginalnemu prostokątowi', () => {
    const bbox = getRotatedAABB(10, 20, 100, 50, 0);
    expect(bbox.x).toBeCloseTo(10);
    expect(bbox.y).toBeCloseTo(20);
    expect(bbox.width).toBeCloseTo(100);
    expect(bbox.height).toBeCloseTo(50);
  });

  it('obrót 90° — szerokość i wysokość AABB są zamienione', () => {
    const bbox = getRotatedAABB(0, 0, 100, 50, Math.PI / 2);
    expect(bbox.width).toBeCloseTo(50, 5);
    expect(bbox.height).toBeCloseTo(100, 5);
  });

  it('obrót 180° — AABB równy oryginalnemu prostokątowi', () => {
    const bbox = getRotatedAABB(0, 0, 100, 50, Math.PI);
    expect(bbox.width).toBeCloseTo(100, 5);
    expect(bbox.height).toBeCloseTo(50, 5);
  });

  it('kwadrat 2×2 obrócony o 45° — AABB jest szerszy (diagonal ≈ 2√2)', () => {
    const bbox = getRotatedAABB(0, 0, 2, 2, Math.PI / 4);
    // diagonal kwadrata 2×2 = 2√2 ≈ 2.828
    expect(bbox.width).toBeCloseTo(2 * Math.SQRT2, 5);
    expect(bbox.height).toBeCloseTo(2 * Math.SQRT2, 5);
  });

  it('wynikowy AABB obejmuje cały obrócony prostokąt (x/y to lewy górny róg)', () => {
    // Prostokąt 100×50 obrócony o 45° powinien mieć AABB z ujemnym x (bo wystaje w lewo)
    const bbox = getRotatedAABB(0, 0, 100, 50, Math.PI / 4);
    expect(bbox.width).toBeGreaterThan(100); // AABB szerszy niż oryginał
    expect(bbox.x).toBeLessThan(0); // lewy róg poza oryginałem
  });
});

// ─── getSimpleAABB ─────────────────────────────────────────────────────────

describe('getSimpleAABB', () => {
  it('zwraca dane 1:1 — pass-through bez transformacji', () => {
    const bbox = getSimpleAABB(10, 20, 100, 50);
    expect(bbox).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('obsługuje ujemne wartości', () => {
    const bbox = getSimpleAABB(-5, -10, 20, 30);
    expect(bbox).toEqual({ x: -5, y: -10, width: 20, height: 30 });
  });
});
