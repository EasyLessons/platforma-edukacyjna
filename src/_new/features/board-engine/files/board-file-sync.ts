/**
 * Obrazy tablicy Excalidraw: Storage zamiast dataURL w Y.Doc.
 *
 * Wcześniej każdy wklejony obraz trafiał do `Y.Map 'excalidraw-files'` w całości
 * (base64) i snapshot tablicy puchł. Teraz:
 *
 *   WYSYŁKA  obraz rastrowy -> POST /whiteboard/{id}/files -> w Y.Doc tylko odwołanie
 *            `{ id, mimeType, created, ref: { v: 1, name } }`.
 *   ELEMENT  nowy element-obraz NIE idzie do Y.Doc, dopóki jego plik nie ma wpisu
 *            w mapie plików (`shareable`) - druga osoba nigdy nie dostaje obrazu,
 *            którego nie da się pobrać. Lokalnie obraz widać od razu.
 *   ODBIÓR   wpis z `ref` -> GET /whiteboard/{id}/files/{name} (blob) -> dataURL tylko
 *            w pamięci karty -> `addFiles`. Wpis z `dataURL` (stary format) - jak dawniej.
 *
 * Zostają w dokumencie jako dataURL (jak dawniej):
 *   - SVG wykresów funkcji (małe, generowane lokalnie; id `fn-<hash>`),
 *   - wszystko na tablicy bez serwera (`boardId === null`: demo, gość),
 *   - obraz, dla którego backend odpowiedział 503 STORAGE_NOT_CONFIGURED (bucket nie
 *     istnieje, nie dało się go utworzyć albo jest publiczny) - tablica ma działać mimo to.
 * Inne SVG (wklejone przez użytkownika) na tablicy z serwerem są odrzucane z komunikatem:
 * backend ich nie przyjmuje, a inline rozdmuchiwałyby dokument dowolną treścią.
 *
 * Błędy wysyłki: ponowienia z rosnącym odstępem (sieć, 5xx, 429 - w tym 429 TOO_MANY_UPLOADS
 * i 503 UPLOAD_BUSY, gdy backend ma komplet uploadów w toku), potem `onUploadFailed`
 * (komponent usuwa element lokalnie i pokazuje komunikat). Bez sieci plik czeka w kolejce
 * do zdarzenia `online` i nie zużywa prób. Naraz idą najwyżej MAX_PARALLEL_UPLOADS wysyłki
 * (tyle backend przyjmuje od jednego konta) - reszta czeka w kolejce.
 *
 * Znane ograniczenia (docs/architecture/pipelines.md, "Obrazy tablicy"): zamknięcie karty przed
 * końcem wysyłki = obraz przepada (był tylko lokalny); pliki skasowanych elementów
 * zostają w Storage do usunięcia tablicy.
 */

import { createLogger, type Logger } from '@/_new/lib/logger';
import {
  isFileRef,
  isInlineFile,
  isStoredFile,
  type StoredFile,
  type StoredInlineFile,
} from '../yjs/excalidraw-binding';
import { BOARD_FILE_NAME_PATTERN, boardFileApi, type BoardFileTransport } from './board-file-api';
import { blobToDataURL, dataURLToBlob } from './data-url';

const SVG_MIME = 'image/svg+xml';
const STORAGE_NOT_CONFIGURED = 'STORAGE_NOT_CONFIGURED';
/** Id pliku wykresu funkcji (`fileIdForSpec` w math/function-element.ts: `fn-` + hash FNV). */
export const FUNCTION_PLOT_FILE_ID_PATTERN = /^fn-[0-9a-f]{1,8}$/;

/** Odstępy kolejnych ponowień (wysyłka i pobieranie). */
export const DEFAULT_RETRY_DELAYS_MS = [1_000, 3_000, 8_000];
export const MAX_PARALLEL_DOWNLOADS = 4;
/** Backend przyjmuje od jednego konta 2 uploady naraz (files.py: MAX_UPLOADS_IN_FLIGHT_PER_USER). */
export const MAX_PARALLEL_UPLOADS = 2;
/** Plik inline większy niż to trafia do logu - dokument rośnie (limitu twardego nie ma). */
export const INLINE_WARN_BYTES = 200 * 1024;
/**
 * Po nieudanej wysyłce ten sam plik (id = hash treści) można wysłać ponownie dopiero po
 * tym czasie - gdy użytkownik wstawi obraz jeszcze raz. Krótsze okno łapałoby zaległy
 * stan sceny sprzed usunięcia elementu i zapętlało wysyłkę.
 */
export const RETRY_AFTER_FAILURE_MS = 5_000;

export type UploadFailure =
  'too-large' | 'dimensions' | 'unsupported' | 'svg' | 'quota' | 'forbidden' | 'failed';

/** Część wiązania Y.Doc, której potrzebuje ten moduł (excalidraw-binding.ts). */
export interface FileBinding {
  hasFile(id: string): boolean;
  hasElement(id: string): boolean;
  pushFiles(files: readonly StoredInlineFile[]): number;
  setFileRef(file: { id: string; mimeType: string; created: number; name: string }): void;
}

/** Minimalny kształt elementu sceny potrzebny do decyzji o wysyłce (zgodny ze StoredElement). */
export interface SceneElementLike {
  id: string;
  isDeleted: boolean;
  type?: unknown;
  fileId?: unknown;
}

function imageFileId(el: SceneElementLike): string | null {
  return el.type === 'image' && typeof el.fileId === 'string' && el.fileId ? el.fileId : null;
}

export interface BoardFileSyncOptions {
  binding: FileBinding;
  /** Id tablicy na serwerze; null = tablica lokalna (demo, gość) - wszystko jako dataURL. */
  boardId: string | null;
  /** Wstawia pliki do Excalidraw (`api.addFiles`). */
  addFiles: (files: StoredInlineFile[]) => void;
  /** Plik dostał wpis w Y.Doc - wywołujący wypycha wstrzymane elementy. */
  onStored: (fileId: string) => void;
  /** Wysyłka ostatecznie nieudana - wywołujący usuwa element lokalnie i informuje użytkownika. */
  onUploadFailed: (fileId: string, reason: UploadFailure) => void;
  transport?: BoardFileTransport;
  retryDelaysMs?: readonly number[];
  isOnline?: () => boolean;
  now?: () => number;
  logger?: Logger;
}

interface PendingUpload {
  file: StoredInlineFile;
  attempt: number;
  timer: ReturnType<typeof setTimeout> | null;
  waitingForNetwork: boolean;
}

interface PendingDownload {
  id: string;
  name: string;
  mimeType: string;
  created: number;
  attempt: number;
}

function errorStatus(err: unknown): number {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : 0;
}

function errorCode(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : '';
}

/** Sieć (brak odpowiedzi), timeout, przeciążenie i błędy serwera - warto spróbować ponownie. */
function isRetryable(err: unknown): boolean {
  const status = errorStatus(err);
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function failureReason(err: unknown): UploadFailure {
  // Kod backendu jest dokładniejszy niż status: 400 to także "za duże wymiary".
  switch (errorCode(err)) {
    case 'IMAGE_TOO_LARGE':
      return 'dimensions';
    case 'BOARD_FILE_QUOTA_EXCEEDED':
      return 'quota';
  }
  switch (errorStatus(err)) {
    case 413:
      return 'too-large';
    case 400:
    case 415:
    case 422:
      return 'unsupported';
    case 401:
    case 403:
    case 404:
      return 'forbidden';
    default:
      return 'failed';
  }
}

function defaultIsOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

export class BoardFileSync {
  private readonly binding: FileBinding;
  private readonly boardId: string | null;
  private readonly addFiles: BoardFileSyncOptions['addFiles'];
  private readonly onStored: BoardFileSyncOptions['onStored'];
  private readonly onUploadFailed: BoardFileSyncOptions['onUploadFailed'];
  private readonly transport: BoardFileTransport;
  private readonly retryDelaysMs: readonly number[];
  private readonly isOnline: () => boolean;
  private readonly now: () => number;
  private readonly log: Logger;

  private readonly uploads = new Map<string, PendingUpload>();
  /** Wysyłki czekające na wolne miejsce (najwyżej MAX_PARALLEL_UPLOADS żądań naraz). */
  private readonly uploadQueue: PendingUpload[] = [];
  private activeUploads = 0;
  /** Pliki, których wysyłka ostatecznie się nie udała (id -> czas) - nie próbujemy w kółko. */
  private readonly failedUploads = new Map<string, number>();

  private readonly downloadQueue: PendingDownload[] = [];
  /** Pobrania w toku, czekające w kolejce albo zakończone - bez duplikatów. */
  private readonly downloads = new Set<string>();
  private readonly downloadsWaitingForNetwork: PendingDownload[] = [];
  private activeDownloads = 0;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  private disposed = false;

  constructor(options: BoardFileSyncOptions) {
    this.binding = options.binding;
    this.boardId = options.boardId;
    this.addFiles = options.addFiles;
    this.onStored = options.onStored;
    this.onUploadFailed = options.onUploadFailed;
    this.transport = options.transport ?? boardFileApi;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.isOnline = options.isOnline ?? defaultIsOnline;
    this.now = options.now ?? Date.now;
    this.log = options.logger ?? createLogger('board-engine/board-file-sync');

    if (typeof window !== 'undefined') window.addEventListener('online', this.resume);
  }

  /** Liczba wysyłek w toku (łącznie z czekającymi na sieć) - do testów i diagnostyki. */
  get pendingUploads(): number {
    return this.uploads.size;
  }

  // --- lokalne -> Y.Doc / Storage ---------------------------------------------

  /**
   * Pliki z Excalidraw (`BinaryFiles`) po zmianie sceny. Te, których nie ma jeszcze
   * w Y.Doc: SVG i tablica lokalna -> dataURL do dokumentu; reszta -> wysyłka do Storage
   * (tylko pliki użyte przez żywy element-obraz - `BinaryFiles` trzyma też stare).
   */
  syncLocal(files: Record<string, StoredFile>, elements: readonly SceneElementLike[]): void {
    if (this.disposed) return;
    const inline: StoredInlineFile[] = [];
    let used: Set<string> | null = null;

    for (const file of Object.values(files)) {
      if (!isInlineFile(file) || this.binding.hasFile(file.id)) continue;

      const isSvg = file.mimeType === SVG_MIME;
      if (this.boardId === null || (isSvg && FUNCTION_PLOT_FILE_ID_PATTERN.test(file.id))) {
        inline.push(file);
        continue;
      }
      if (this.uploads.has(file.id)) continue;
      const failedAt = this.failedUploads.get(file.id);
      if (failedAt !== undefined && this.now() - failedAt < RETRY_AFTER_FAILURE_MS) continue;

      used ??= new Set(
        elements
          .filter((el) => !el.isDeleted && imageFileId(el))
          .map((el) => imageFileId(el) as string)
      );
      if (!used.has(file.id)) continue;
      if (isSvg) {
        // SVG spoza wykresów: ani do Storage (backend przyjmuje tylko rastry), ani inline.
        this.failUpload(file.id, 'svg', 'SVG wklejony przez użytkownika');
        continue;
      }
      // Także obraz wstawiony ponownie po wcześniejszej nieudanej wysyłce.
      this.failedUploads.delete(file.id);
      this.startUpload(file);
    }

    this.pushInline(inline);
  }

  /**
   * Elementy, które wolno zapisać do Y.Doc: nowy element-obraz czeka, aż jego plik
   * będzie miał wpis w mapie plików. Element już obecny w dokumencie przechodzi zawsze
   * (inni i tak go mają - blokada zatrzymałaby np. przesunięcie albo skasowanie).
   */
  shareable<T extends SceneElementLike>(elements: readonly T[]): T[] {
    return elements.filter((el) => {
      if (el.type !== 'image' || this.binding.hasElement(el.id)) return true;
      const fileId = imageFileId(el);
      return fileId !== null && this.binding.hasFile(fileId);
    });
  }

  private pushInline(files: StoredInlineFile[]): void {
    if (files.length === 0) return;
    for (const file of files) {
      if (file.dataURL.length > INLINE_WARN_BYTES) {
        this.log.warn(
          `plik inline ${Math.round(file.dataURL.length / 1024)} KB (${file.mimeType}) trafia do dokumentu tablicy`
        );
      }
    }
    this.binding.pushFiles(files);
  }

  private startUpload(file: StoredInlineFile): void {
    const upload: PendingUpload = { file, attempt: 0, timer: null, waitingForNetwork: false };
    this.uploads.set(file.id, upload);
    void this.attemptUpload(upload);
  }

  private async attemptUpload(upload: PendingUpload): Promise<void> {
    if (this.disposed) return;
    upload.timer = null;
    const { file } = upload;

    if (!this.isOnline()) {
      upload.waitingForNetwork = true;
      return;
    }
    upload.waitingForNetwork = false;

    if (this.activeUploads >= MAX_PARALLEL_UPLOADS) {
      this.uploadQueue.push(upload);
      return;
    }

    let blob: Blob;
    try {
      blob = dataURLToBlob(file.dataURL);
    } catch {
      this.failUpload(file.id, 'unsupported', 'niepoprawny dataURL');
      return;
    }

    this.activeUploads += 1;
    try {
      const result = await this.transport.upload(this.boardId as string, blob);
      if (this.disposed) return;
      if (!BOARD_FILE_NAME_PATTERN.test(String(result?.file_name))) {
        // Nie ponawiamy: każda próba zostawiałaby kolejny plik w Storage.
        this.failUpload(file.id, 'failed', 'nieoczekiwana odpowiedź backendu');
        return;
      }
      this.uploads.delete(file.id);
      // Ktoś mógł w międzyczasie dodać ten sam obraz (id = hash treści) - wtedy nie nadpisujemy.
      if (!this.binding.hasFile(file.id)) {
        this.binding.setFileRef({
          id: file.id,
          mimeType: result.mime_type,
          created: file.created,
          name: result.file_name,
        });
      }
      this.onStored(file.id);
    } catch (err) {
      if (this.disposed) return;
      this.handleUploadError(upload, err);
    } finally {
      this.activeUploads -= 1;
      const next = this.uploadQueue.shift();
      if (next && !this.disposed) void this.attemptUpload(next);
    }
  }

  private handleUploadError(upload: PendingUpload, err: unknown): void {
    const { file } = upload;

    if (errorCode(err) === STORAGE_NOT_CONFIGURED) {
      // Storage po stronie serwera nie działa - zachowanie sprzed zmiany: dataURL w dokumencie.
      this.log.error(
        'Storage plików tablicy niedostępny (503) - obraz zapisany w dokumencie jako dataURL'
      );
      this.uploads.delete(file.id);
      this.pushInline([file]);
      this.onStored(file.id);
      return;
    }

    if (isRetryable(err)) {
      if (!this.isOnline()) {
        upload.waitingForNetwork = true;
        return;
      }
      if (upload.attempt < this.retryDelaysMs.length) {
        const delay = this.retryDelaysMs[upload.attempt];
        upload.attempt += 1;
        this.log.warn(
          `wysyłka obrazu nieudana (HTTP ${errorStatus(err)}), ponowienie za ${delay} ms`
        );
        upload.timer = setTimeout(() => void this.attemptUpload(upload), delay);
        return;
      }
    }

    this.failUpload(file.id, failureReason(err), `HTTP ${errorStatus(err)}`);
  }

  private failUpload(fileId: string, reason: UploadFailure, detail: string): void {
    this.log.error(`wysyłka obrazu nieudana ostatecznie (${detail})`);
    this.uploads.delete(fileId);
    this.failedUploads.set(fileId, this.now());
    this.onUploadFailed(fileId, reason);
  }

  // --- Y.Doc / Storage -> Excalidraw ----------------------------------------------

  /** Wpisy z mapy plików (stan początkowy albo zmiana zdalna) -> pliki w Excalidraw. */
  receive(entries: readonly StoredFile[]): void {
    if (this.disposed) return;
    const inline: StoredInlineFile[] = [];

    for (const entry of entries) {
      // Mapa plików pochodzi też od innych klientów: `null` / nie-obiekt pomijamy bez wyjątku.
      if (!isStoredFile(entry)) continue;
      if (isInlineFile(entry)) {
        inline.push(entry);
        continue;
      }
      if (!isFileRef(entry) || this.downloads.has(entry.id)) continue;

      // Treść dokumentu pochodzi od innych osób - do adresu trafia wyłącznie nazwa w formacie backendu.
      const { v, name } = entry.ref as { v?: unknown; name?: unknown };
      if (v !== 1 || typeof name !== 'string' || !BOARD_FILE_NAME_PATTERN.test(name)) {
        this.log.warn('pominięto wpis pliku z nieobsługiwanym odwołaniem');
        continue;
      }
      if (this.boardId === null) {
        this.log.warn('odwołanie do pliku w Storage na tablicy lokalnej - pominięte');
        continue;
      }
      this.downloads.add(entry.id);
      this.downloadQueue.push({
        id: entry.id,
        name,
        mimeType: entry.mimeType,
        created: entry.created,
        attempt: 0,
      });
    }

    if (inline.length) this.addFiles(inline);
    this.pumpDownloads();
  }

  private pumpDownloads(): void {
    while (!this.disposed && this.activeDownloads < MAX_PARALLEL_DOWNLOADS) {
      const next = this.downloadQueue.shift();
      if (!next) return;
      this.activeDownloads += 1;
      void this.download(next).finally(() => {
        this.activeDownloads -= 1;
        this.pumpDownloads();
      });
    }
  }

  private async download(item: PendingDownload): Promise<void> {
    if (!this.isOnline()) {
      this.downloadsWaitingForNetwork.push(item);
      return;
    }
    try {
      const blob = await this.transport.download(this.boardId as string, item.name);
      if (this.disposed) return;
      const typed = blob.type.startsWith('image/')
        ? blob
        : new Blob([blob], { type: 'image/webp' });
      const dataURL = await blobToDataURL(typed);
      if (this.disposed) return;
      this.addFiles([
        { id: item.id, mimeType: typed.type || item.mimeType, dataURL, created: item.created },
      ]);
    } catch (err) {
      if (this.disposed) return;
      if (isRetryable(err)) {
        if (!this.isOnline()) {
          this.downloadsWaitingForNetwork.push(item);
          return;
        }
        if (item.attempt < this.retryDelaysMs.length) {
          const delay = this.retryDelaysMs[item.attempt];
          item.attempt += 1;
          const timer = setTimeout(() => {
            this.timers.delete(timer);
            this.downloadQueue.push(item);
            this.pumpDownloads();
          }, delay);
          this.timers.add(timer);
          return;
        }
      }
      // Element zostaje z pustym miejscem po obrazie; ponowna próba po odświeżeniu strony.
      this.log.warn(`nie udało się pobrać obrazu tablicy (HTTP ${errorStatus(err)})`);
    }
  }

  // --- sieć / sprzątanie --------------------------------------------------------

  /** Wznawia wysyłki i pobrania wstrzymane z powodu braku sieci (zdarzenie `online`). */
  resume = (): void => {
    if (this.disposed) return;
    for (const upload of this.uploads.values()) {
      if (upload.waitingForNetwork) void this.attemptUpload(upload);
    }
    this.downloadQueue.push(...this.downloadsWaitingForNetwork.splice(0));
    this.pumpDownloads();
  };

  dispose(): void {
    this.disposed = true;
    if (typeof window !== 'undefined') window.removeEventListener('online', this.resume);
    for (const upload of this.uploads.values()) {
      if (upload.timer) clearTimeout(upload.timer);
    }
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.uploads.clear();
    this.uploadQueue.length = 0;
    this.downloadQueue.length = 0;
    this.downloadsWaitingForNetwork.length = 0;
  }
}
