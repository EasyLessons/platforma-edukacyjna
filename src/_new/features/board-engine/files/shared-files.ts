/**
 * Wspólne pliki tablicy: arkusze CKE i karty wzorów - te same dla każdego, trzymane RAZ jako pliki
 * statyczne (`public/templates/**`, `public/resources/**`, CDN Vercela).
 *
 * Element-obraz Excalidraw odwołuje się do nich przez id pliku `tpl:<ścieżka>` (np.
 * `tpl:templates/arkusze/egzamin-8-2025/p01.webp`). `board-file-sync` dla takiego pliku NIE robi
 * uploadu: zapisuje w Y.Doc tylko odwołanie `{ ref: { v: 1, shared: <ścieżka> } }`, a odbiorca
 * pobiera obraz z adresu statycznego. Brak kopii w Storage tablicy, brak wpływu na quota.
 *
 * Ścieżka przychodzi z dokumentu tablicy (od innych osób) - do adresu trafia wyłącznie ścieżka
 * pasująca do SHARED_PATH_PATTERN (tylko nasze katalogi, bez `..`, tylko .webp).
 */

export const SHARED_FILE_PREFIX = 'tpl:';

/** `templates/...` albo `resources/...`, znaki z nazw w repo (także spacje), rozszerzenie .webp. */
export const SHARED_PATH_PATTERN = /^(templates|resources)\/[A-Za-z0-9 _.\-/]+\.webp$/;

export function isSharedPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    SHARED_PATH_PATTERN.test(path) &&
    !path.includes('..') &&
    !path.includes('//')
  );
}

/** Id pliku dla ścieżki zasobu (z albo bez wiodącego `/`). Rzuca dla ścieżki spoza wspólnych katalogów. */
export function sharedFileId(path: string): string {
  const clean = path.replace(/^\/+/, '');
  if (!isSharedPath(clean)) throw new Error(`Nie jest wspólnym plikiem: ${path}`);
  return SHARED_FILE_PREFIX + clean;
}

export function isSharedFileId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith(SHARED_FILE_PREFIX);
}

/** Ścieżka z id pliku; null, gdy id nie jest poprawnym wspólnym plikiem. */
export function sharedPathOf(id: string): string | null {
  if (!isSharedFileId(id)) return null;
  const path = id.slice(SHARED_FILE_PREFIX.length);
  return isSharedPath(path) ? path : null;
}

/** Adres statyczny (ta sama domena) - spacje w nazwach katalogów kodowane. */
export function sharedFileUrl(path: string): string {
  return '/' + path.split('/').map(encodeURIComponent).join('/');
}

/** Pobranie wspólnego pliku z CDN; błąd HTTP z `status` (ponowienia jak dla Storage). */
export async function fetchSharedFile(url: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw Object.assign(new Error('Brak połączenia'), { status: 0 });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
  }
  return response.blob();
}
