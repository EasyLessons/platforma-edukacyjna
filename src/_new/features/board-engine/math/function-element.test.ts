import { describe, it, expect } from 'vitest';
import {
  buildFunctionElement,
  fileIdForSpec,
  isFunctionElement,
  updateFunctionElement,
} from './function-element';
import { DEFAULT_FUNCTION_SPEC } from './function-plot';
import { FUNCTION_PLOT_FILE_ID_PATTERN } from '../files/board-file-sync';

describe('function-element', () => {
  it('buildFunctionElement tworzy element image z customData i plikiem SVG', () => {
    const { element, file } = buildFunctionElement(DEFAULT_FUNCTION_SPEC, { x: 10, y: 20 });
    expect(element.type).toBe('image');
    expect(element.x).toBe(10);
    expect(element.y).toBe(20);
    expect(element.customData).toEqual({ kind: 'function', spec: DEFAULT_FUNCTION_SPEC });
    expect(file.mimeType).toBe('image/svg+xml');
    expect(file.dataURL.startsWith('data:image/svg+xml')).toBe(true);
    expect((element as { fileId?: string }).fileId).toBe(file.id);
    expect(isFunctionElement(element)).toBe(true);
  });

  it('fileIdForSpec jest deterministyczne i zależy od wzoru', () => {
    expect(fileIdForSpec(DEFAULT_FUNCTION_SPEC)).toBe(fileIdForSpec({ ...DEFAULT_FUNCTION_SPEC }));
    expect(fileIdForSpec(DEFAULT_FUNCTION_SPEC)).not.toBe(
      fileIdForSpec({ ...DEFAULT_FUNCTION_SPEC, expression: 'cos(x)' })
    );
  });

  it('id pliku wykresu pasuje do wzorca, po którym board-file-sync zostawia SVG inline', () => {
    for (const expression of ['sin(x)', 'x^2', '1/x', 'abs(x) - 3']) {
      expect(fileIdForSpec({ ...DEFAULT_FUNCTION_SPEC, expression })).toMatch(
        FUNCTION_PLOT_FILE_ID_PATTERN
      );
    }
  });

  it('updateFunctionElement podbija wersję, zmienia fileId i nie mutuje oryginału', () => {
    const { element } = buildFunctionElement(DEFAULT_FUNCTION_SPEC, { x: 0, y: 0 });
    if (!isFunctionElement(element)) throw new Error('oczekiwano elementu funkcji');
    const next = updateFunctionElement(element, { ...DEFAULT_FUNCTION_SPEC, expression: 'x^2' });
    expect(next.element.version).toBe(element.version + 1);
    expect(next.element.fileId).not.toBe(element.fileId);
    expect(next.element.customData?.spec.expression).toBe('x^2');
    expect(element.customData.spec.expression).toBe('sin(x)');
  });

  it('isFunctionElement odrzuca zwykłe obrazy i elementy skasowane', () => {
    const { element } = buildFunctionElement(DEFAULT_FUNCTION_SPEC, { x: 0, y: 0 });
    expect(isFunctionElement({ ...element, customData: undefined })).toBe(false);
    expect(isFunctionElement({ ...element, isDeleted: true })).toBe(false);
    expect(isFunctionElement(null)).toBe(false);
  });
});
