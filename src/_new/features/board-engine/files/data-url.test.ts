import { describe, it, expect } from 'vitest';
import { blobToDataURL, dataURLToBlob } from './data-url';

async function blobText(blob: Blob): Promise<string> {
  const dataURL = await blobToDataURL(blob);
  return atob(dataURL.slice(dataURL.indexOf(',') + 1));
}

describe('dataURLToBlob', () => {
  it('base64: typ i bajty zgodne z wejściem', async () => {
    const bytes = String.fromCharCode(0, 255, 16, 128, 65);
    const blob = dataURLToBlob(`data:image/png;base64,${btoa(bytes)}`);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(5);
    expect(await blobText(blob)).toBe(bytes);
  });

  it('bez base64 (tekst zakodowany procentowo)', async () => {
    const blob = dataURLToBlob('data:image/svg+xml,%3Csvg%2F%3E');
    expect(blob.type).toBe('image/svg+xml');
    expect(await blobText(blob)).toBe('<svg/>');
  });

  it('parametry przed base64 nie psują typu', () => {
    expect(dataURLToBlob(`data:image/jpeg;name=a.jpg;base64,${btoa('x')}`).type).toBe('image/jpeg');
  });

  it.each(['', 'http://example.com/a.png', 'data:image/png;base64'])(
    'niepoprawny dataURL (%s) rzuca błąd',
    (value) => {
      expect(() => dataURLToBlob(value)).toThrow();
    }
  );
});

describe('blobToDataURL', () => {
  it('zwraca dataURL base64 z typem bloba', async () => {
    const dataURL = await blobToDataURL(new Blob(['abc'], { type: 'image/webp' }));
    expect(dataURL).toBe(`data:image/webp;base64,${btoa('abc')}`);
  });

  it('round-trip dataURL -> Blob -> dataURL', async () => {
    const original = `data:image/png;base64,${btoa('round-trip')}`;
    expect(await blobToDataURL(dataURLToBlob(original))).toBe(original);
  });
});
