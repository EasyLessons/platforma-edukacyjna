/**
 * Konwersje dataURL <-> Blob dla obrazów tablicy (bez zależności od Excalidraw).
 */

/** `data:<mime>[;base64],<dane>` -> Blob. Rzuca Error dla niepoprawnego dataURL. */
export function dataURLToBlob(dataURL: string): Blob {
  const comma = dataURL.indexOf(',');
  if (!dataURL.startsWith('data:') || comma < 0) throw new Error('Niepoprawny dataURL');
  const meta = dataURL.slice(5, comma);
  const payload = dataURL.slice(comma + 1);
  const mimeType = meta.split(';')[0] || 'application/octet-stream';

  if (!/;base64$/i.test(meta)) {
    return new Blob([decodeURIComponent(payload)], { type: mimeType });
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/** Blob -> dataURL base64 (Excalidraw `addFiles` przyjmuje tylko taką postać). */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Nie udało się odczytać pliku'));
    reader.readAsDataURL(blob);
  });
}
