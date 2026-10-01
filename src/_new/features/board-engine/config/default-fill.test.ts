import { describe, it, expect } from 'vitest';
import { DEFAULT_SHAPE_FILL, NO_FILL, backgroundForTool } from './default-fill';

describe('backgroundForTool', () => {
  it('prostokąt / elipsa / romb bez tła dostają lekkie wypełnienie', () => {
    expect(backgroundForTool('rectangle', NO_FILL)).toBe(DEFAULT_SHAPE_FILL);
    expect(backgroundForTool('ellipse', NO_FILL)).toBe(DEFAULT_SHAPE_FILL);
    expect(backgroundForTool('diamond', NO_FILL)).toBe(DEFAULT_SHAPE_FILL);
  });

  it('kolor wybrany przez użytkownika zostaje', () => {
    expect(backgroundForTool('rectangle', '#ffc9c9')).toBeNull();
    expect(backgroundForTool('freedraw', '#ffc9c9')).toBeNull();
  });

  it('pióro, tekst i linie zdejmują nasze domyślne wypełnienie', () => {
    expect(backgroundForTool('freedraw', DEFAULT_SHAPE_FILL)).toBe(NO_FILL);
    expect(backgroundForTool('text', DEFAULT_SHAPE_FILL)).toBe(NO_FILL);
    expect(backgroundForTool('line', DEFAULT_SHAPE_FILL)).toBe(NO_FILL);
  });

  it('bez zmian, gdy nic nie trzeba robić', () => {
    expect(backgroundForTool('rectangle', DEFAULT_SHAPE_FILL)).toBeNull();
    expect(backgroundForTool('selection', NO_FILL)).toBeNull();
  });
});
