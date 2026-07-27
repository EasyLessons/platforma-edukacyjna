/**
 * ============================================================================
 * PLIK: elements/image-compress.ts — Kompresja obrazów przed wstawieniem na tablicę
 * ============================================================================
 *
 * PO CO TO JEST (patrz docs/known-issues.md #2):
 * Zdjęcia/screenshoty trafiają na tablicę jako base64 wpisane wprost w pole
 * `src` elementu (ImageElement.src). Ten sam base64 leci potem przez Supabase
 * Broadcast (realtime) do innych userów — a Broadcast ma twardy limit rozmiaru
 * pojedynczej wiadomości (256 KB na planie Free, 3000 KB na Pro — patrz
 * https://supabase.com/docs/guides/realtime/limits). Bez kompresji zwykły
 * zrzut ekranu (PNG, pełna rozdzielczość ekranu) łatwo przekracza ten limit
 * i NIE dociera do innych userów.
 *
 * Ta funkcja zmniejsza obrazek PRZED utworzeniem elementu: ogranicza dłuższy
 * bok do MAX_IMAGE_DIMENSION_PX i zapisuje jako JPEG zamiast surowego PNG.
 * Dla typowego zrzutu ekranu to zwykle 5-10x mniej danych — powinno wystarczyć
 * żeby zmieścić się pod limitem w zdecydowanej większości przypadków.
 *
 * ⚠️ AKTUALIZACJA (known-issues.md #2, Aktualizacja 8): sama kompresja
 * OKAZAŁA SIĘ NIEWYSTARCZAJĄCA — realne zdjęcia z telefonu i renderowane
 * strony PDF nadal regularnie przekraczały 256 KB nawet po zmniejszeniu.
 * Dlatego poniżej `compressAndUploadImage()` w ogóle NIE wsadza obrazka do
 * broadcastu — kompresuje i uploaduje do Supabase Storage, zwracając URL.
 * `compressImageDataUrl()` zostaje jako krok pośredni (używany właśnie przez
 * `compressAndUploadImage`), nie jest już wywoływana samodzielnie przy
 * tworzeniu elementów.
 */

import { uploadBoardImage } from '../api/whiteboardApi';

export const MAX_IMAGE_DIMENSION_PX = 1600;
export const IMAGE_JPEG_QUALITY = 0.82;

export interface CompressedImage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Przyjmuje surowy data URL (np. prosto z FileReader.readAsDataURL) i zwraca
 * zmniejszoną/przekodowaną wersję + jej wymiary w pikselach (do poprawnego
 * wyliczenia proporcji elementu na tablicy — NIE oryginalne wymiary, tylko
 * te PO kompresji, żeby element miał poprawny aspect ratio).
 */
export async function compressImageDataUrl(rawDataUrl: string): Promise<CompressedImage> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Nie udało się wczytać obrazka do kompresji'));
    img.src = rawDataUrl;
  });

  const { naturalWidth: w, naturalHeight: h } = img;
  if (!w || !h) {
    // Brak wymiarów (bardzo rzadkie) — oddaj oryginał zamiast wywalać całą operację
    return { dataUrl: rawDataUrl, width: w || 1, height: h || 1 };
  }

  const scale = Math.min(1, MAX_IMAGE_DIMENSION_PX / Math.max(w, h));
  const targetWidth = Math.max(1, Math.round(w * scale));
  const targetHeight = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Brak canvasu (bardzo rzadkie) — oddaj oryginał zamiast wywalać całą operację
    return { dataUrl: rawDataUrl, width: w, height: h };
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const dataUrl = canvas.toDataURL('image/jpeg', IMAGE_JPEG_QUALITY);
  return { dataUrl, width: targetWidth, height: targetHeight };
}

export interface UploadedImage {
  /** Publiczny URL w Supabase Storage — TO idzie do element.src, nie base64 */
  url: string;
  width: number;
  height: number;
}

/** data URL → Blob, potrzebne żeby wysłać obraz jako multipart/form-data */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/**
 * Kompresuje obraz (compressImageDataUrl) i uploaduje wynik do Supabase
 * Storage przez backend (patrz api/whiteboardApi.ts → uploadBoardImage),
 * zamiast wpisywać base64 wprost do elementu.
 *
 * DLACZEGO: base64 w treści broadcastu regularnie przekraczał limit 256 KB
 * na wiadomość (plan Free) nawet po samej kompresji — patrz
 * docs/known-issues.md #2, Aktualizacja 8. URL zwrócony stąd waży
 * kilkadziesiąt bajtów niezależnie od tego, jak duże jest oryginalne zdjęcie,
 * więc nigdy nie zbliża się do tego limitu.
 *
 * Używana we WSZYSTKICH miejscach tworzenia obrazu: paste ze schowka,
 * drag&drop obrazka, drag&drop PDF (strona po stronie), upload z dysku.
 */
export async function compressAndUploadImage(
  rawDataUrl: string,
  boardId: number,
  filename: string = 'image.jpg'
): Promise<UploadedImage> {
  const { dataUrl, width, height } = await compressImageDataUrl(rawDataUrl);
  const blob = await dataUrlToBlob(dataUrl);
  const { url } = await uploadBoardImage(boardId, blob, filename);
  return { url, width, height };
}
