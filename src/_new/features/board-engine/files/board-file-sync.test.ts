import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import {
  ExcalidrawYjsBinding,
  isFileRef,
  type StoredElement,
  type StoredFile,
  type StoredInlineFile,
} from '../yjs/excalidraw-binding';
import {
  BoardFileSync,
  RETRY_AFTER_FAILURE_MS,
  type BoardFileSyncOptions,
  type UploadFailure,
} from './board-file-sync';
import type { BoardFileTransport, UploadedBoardFile } from './board-file-api';

const PNG_DATA_URL = `data:image/png;base64,${btoa('to-nie-jest-prawdziwy-png')}`;
const FILE_NAME = `${'ab'.repeat(16)}.webp`;
const RETRY = [10, 20, 30];

const silentLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function pngFile(id = 'img1', dataURL = PNG_DATA_URL): StoredInlineFile {
  return { id, mimeType: 'image/png', dataURL, created: 123 };
}

function imageEl(id: string, fileId: string | null, extra: Partial<StoredElement> = {}) {
  return {
    id,
    type: 'image',
    fileId,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    ...extra,
  } as StoredElement & { type: string; fileId: string | null };
}

function rectEl(id: string) {
  return {
    id,
    type: 'rectangle',
    version: 1,
    versionNonce: 1,
    isDeleted: false,
  } as StoredElement & { type: string };
}

function apiError(status: number, code = 'APP_ERROR') {
  return Object.assign(new Error(`HTTP ${status}`), { status, code });
}

function uploaded(name = FILE_NAME): UploadedBoardFile {
  return { file_name: name, mime_type: 'image/webp', size: 10, width: 4, height: 4 };
}

/** Dwa dokumenty spięte w obie strony (jak dwie karty przez whiteboard-sync). */
function connectedDocs() {
  const docA = new Y.Doc();
  const docB = new Y.Doc();
  docA.on('update', (u: Uint8Array, origin: unknown) => {
    if (origin !== 'net') Y.applyUpdate(docB, u, 'net');
  });
  docB.on('update', (u: Uint8Array, origin: unknown) => {
    if (origin !== 'net') Y.applyUpdate(docA, u, 'net');
  });
  return { a: new ExcalidrawYjsBinding(docA, 'A'), b: new ExcalidrawYjsBinding(docB, 'B') };
}

interface Harness {
  sync: BoardFileSync;
  binding: ExcalidrawYjsBinding;
  transport: { upload: ReturnType<typeof vi.fn>; download: ReturnType<typeof vi.fn> };
  addFiles: ReturnType<typeof vi.fn>;
  onStored: ReturnType<typeof vi.fn>;
  onUploadFailed: ReturnType<typeof vi.fn>;
  online: { value: boolean };
  clock: { value: number };
}

function harness(
  binding = new ExcalidrawYjsBinding(new Y.Doc(), 'A'),
  options: Partial<BoardFileSyncOptions> = {}
): Harness {
  const transport = {
    upload: vi.fn<BoardFileTransport['upload']>().mockResolvedValue(uploaded()),
    download: vi
      .fn<BoardFileTransport['download']>()
      .mockResolvedValue(new Blob(['webp-bytes'], { type: 'image/webp' })),
  };
  const addFiles = vi.fn();
  const onStored = vi.fn();
  const onUploadFailed = vi.fn<(fileId: string, reason: UploadFailure) => void>();
  const online = { value: true };
  const clock = { value: 1_000_000 };
  const sync = new BoardFileSync({
    binding,
    boardId: '7',
    transport,
    addFiles,
    onStored,
    onUploadFailed,
    retryDelaysMs: RETRY,
    isOnline: () => online.value,
    now: () => clock.value,
    logger: silentLogger,
    ...options,
  });
  return { sync, binding, transport, addFiles, onStored, onUploadFailed, online, clock };
}

// Prawdziwy setTimeout sprzed vi.useFakeTimers(): FileReader z jsdom kończy odczyt poza
// podmienionymi timerami, więc trzeba mu oddać pętlę zdarzeń.
const realSetTimeout = globalThis.setTimeout;

/** Wykonuje zaległe mikrozadania, timery o zerowym opóźnieniu i odczyty FileReader. */
async function settle() {
  for (let i = 0; i < 4; i++) {
    await vi.advanceTimersByTimeAsync(0);
    await new Promise((resolve) => realSetTimeout(resolve, 2));
  }
}

beforeEach(() => {
  // Tylko setTimeout (ponowienia) - setImmediate zostaje prawdziwy dla FileReader z jsdom.
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BoardFileSync - wysyłka', () => {
  it('obraz rastrowy idzie do Storage, w Y.Doc ląduje odwołanie BEZ dataURL', async () => {
    const h = harness();
    h.sync.syncLocal({ img1: pngFile() }, [imageEl('e1', 'img1')]);
    await settle();

    expect(h.transport.upload).toHaveBeenCalledTimes(1);
    const [boardId, blob] = h.transport.upload.mock.calls[0];
    expect(boardId).toBe('7');
    expect(blob).toBeInstanceOf(Blob);
    expect((blob as Blob).type).toBe('image/png');

    const stored = h.binding.getFile('img1') as StoredFile;
    expect(stored).toEqual({
      id: 'img1',
      mimeType: 'image/webp',
      created: 123,
      ref: { v: 1, name: FILE_NAME },
    });
    expect(isFileRef(stored)).toBe(true);
    expect(JSON.stringify(stored)).not.toContain('data:');
    expect(h.onStored).toHaveBeenCalledWith('img1');
    expect(h.sync.pendingUploads).toBe(0);
  });

  it('element-obraz jest wstrzymany do czasu wpisu pliku w Y.Doc', async () => {
    const h = harness();
    let finish!: (value: UploadedBoardFile) => void;
    h.transport.upload.mockReturnValue(new Promise<UploadedBoardFile>((r) => (finish = r)));
    const elements = [rectEl('r1'), imageEl('e1', 'img1')];

    h.sync.syncLocal({ img1: pngFile() }, elements);
    expect(h.sync.shareable(elements).map((e) => e.id)).toEqual(['r1']);

    finish(uploaded());
    await settle();
    expect(h.sync.shareable(elements).map((e) => e.id)).toEqual(['r1', 'e1']);
  });

  it('druga osoba nie dostaje elementu-obrazu przed plikiem', async () => {
    const { a, b } = connectedDocs();
    const h = harness(a);
    let finish!: (value: UploadedBoardFile) => void;
    h.transport.upload.mockReturnValue(new Promise<UploadedBoardFile>((r) => (finish = r)));
    const elements = [imageEl('e1', 'img1')];
    h.onStored.mockImplementation(() => a.pushLocal(h.sync.shareable(elements)));

    h.sync.syncLocal({ img1: pngFile() }, elements);
    a.pushLocal(h.sync.shareable(elements));
    expect(b.getElements()).toEqual([]);
    expect(b.getFiles()).toEqual([]);

    finish(uploaded());
    await settle();
    expect(b.getElements().map((e) => e.id)).toEqual(['e1']);
    expect(isFileRef(b.getFile('img1') as StoredFile)).toBe(true);
  });

  it('element-obraz bez fileId (w trakcie wstawiania) też czeka', () => {
    const h = harness();
    expect(h.sync.shareable([imageEl('e1', null)])).toEqual([]);
  });

  it('element już obecny w dokumencie przechodzi nawet bez pliku (np. skasowanie)', () => {
    const h = harness();
    h.binding.pushLocal([imageEl('e1', 'brak')]);
    const moved = imageEl('e1', 'brak', { version: 2, isDeleted: true });
    expect(h.sync.shareable([moved])).toEqual([moved]);
  });

  it('nie wysyła ponownie pliku w toku ani pliku, który ma już wpis', async () => {
    const h = harness();
    const files = { img1: pngFile() };
    const elements = [imageEl('e1', 'img1')];
    h.sync.syncLocal(files, elements);
    h.sync.syncLocal(files, elements);
    await settle();
    h.sync.syncLocal(files, elements);
    await settle();

    expect(h.transport.upload).toHaveBeenCalledTimes(1);
  });

  it('plik z odbioru (ref w Y.Doc) wraca w BinaryFiles i NIE jest wysyłany ponownie', async () => {
    const h = harness();
    h.binding.setFileRef({ id: 'img1', mimeType: 'image/webp', created: 1, name: FILE_NAME });
    h.sync.receive(h.binding.getFiles());
    await settle();
    expect(h.addFiles).toHaveBeenCalledTimes(1);
    const received = h.addFiles.mock.calls[0][0][0] as StoredInlineFile;

    h.sync.syncLocal({ img1: received }, [imageEl('e1', 'img1')]);
    await settle();

    expect(h.transport.upload).not.toHaveBeenCalled();
    expect(isFileRef(h.binding.getFile('img1') as StoredFile)).toBe(true);
  });

  it('plik nieużywany przez żaden żywy element nie jest wysyłany', async () => {
    const h = harness();
    h.sync.syncLocal({ img1: pngFile() }, [
      imageEl('e1', 'img1', { isDeleted: true }),
      rectEl('r'),
    ]);
    await settle();
    expect(h.transport.upload).not.toHaveBeenCalled();
  });

  it('SVG wykresu zostaje w dokumencie jako dataURL', async () => {
    const h = harness();
    const svg: StoredInlineFile = {
      id: 'fn-1',
      mimeType: 'image/svg+xml',
      dataURL: `data:image/svg+xml;base64,${btoa('<svg/>')}`,
      created: 1,
    };
    h.sync.syncLocal({ 'fn-1': svg }, [imageEl('e1', 'fn-1')]);
    await settle();

    expect(h.transport.upload).not.toHaveBeenCalled();
    expect(h.binding.getFile('fn-1')).toEqual(svg);
    expect(h.sync.shareable([imageEl('e1', 'fn-1')])).toHaveLength(1);
  });

  it('tablica lokalna (demo, gość): obraz jako dataURL, bez wywołań backendu', async () => {
    const h = harness(undefined, { boardId: null });
    h.sync.syncLocal({ img1: pngFile() }, [imageEl('e1', 'img1')]);
    await settle();

    expect(h.transport.upload).not.toHaveBeenCalled();
    expect(h.binding.getFile('img1')).toEqual(pngFile());
    expect(h.sync.shareable([imageEl('e1', 'img1')])).toHaveLength(1);
  });

  it('gdy ktoś inny dodał ten sam plik w trakcie wysyłki - wpis nie jest nadpisywany', async () => {
    const h = harness();
    let finish!: (value: UploadedBoardFile) => void;
    h.transport.upload.mockReturnValue(new Promise<UploadedBoardFile>((r) => (finish = r)));
    h.sync.syncLocal({ img1: pngFile() }, [imageEl('e1', 'img1')]);
    const other = `${'cd'.repeat(16)}.webp`;
    h.binding.setFileRef({ id: 'img1', mimeType: 'image/webp', created: 5, name: other });

    finish(uploaded());
    await settle();

    expect((h.binding.getFile('img1') as { ref: { name: string } }).ref.name).toBe(other);
    expect(h.onStored).toHaveBeenCalledWith('img1');
  });
});

describe('BoardFileSync - błędy wysyłki', () => {
  it('błąd sieci / 5xx: ponowienia z odstępami, potem sukces', async () => {
    const h = harness();
    h.transport.upload
      .mockRejectedValueOnce(apiError(0, 'NETWORK_ERROR'))
      .mockRejectedValueOnce(apiError(502))
      .mockResolvedValueOnce(uploaded());

    h.sync.syncLocal({ img1: pngFile() }, [imageEl('e1', 'img1')]);
    await settle();
    expect(h.transport.upload).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(RETRY[0]);
    expect(h.transport.upload).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(RETRY[1]);
    expect(h.transport.upload).toHaveBeenCalledTimes(3);
    await settle();

    expect(h.onUploadFailed).not.toHaveBeenCalled();
    expect(isFileRef(h.binding.getFile('img1') as StoredFile)).toBe(true);
  });

  it('po wyczerpaniu ponowień: onUploadFailed, brak wpisu, brak kolejnych prób', async () => {
    const h = harness();
    h.transport.upload.mockRejectedValue(apiError(502));
    const files = { img1: pngFile() };
    const elements = [imageEl('e1', 'img1')];

    h.sync.syncLocal(files, elements);
    await vi.advanceTimersByTimeAsync(RETRY[0] + RETRY[1] + RETRY[2] + 5);

    expect(h.transport.upload).toHaveBeenCalledTimes(1 + RETRY.length);
    expect(h.onUploadFailed).toHaveBeenCalledTimes(1);
    expect(h.onUploadFailed).toHaveBeenCalledWith('img1', 'failed');
    expect(h.binding.hasFile('img1')).toBe(false);
    expect(h.sync.shareable(elements)).toEqual([]);

    h.sync.syncLocal(files, elements);
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.transport.upload).toHaveBeenCalledTimes(1 + RETRY.length);
  });

  it('ten sam obraz wstawiony ponownie po nieudanej wysyłce jest wysyłany jeszcze raz', async () => {
    const h = harness();
    h.transport.upload.mockRejectedValueOnce(apiError(413)).mockResolvedValueOnce(uploaded());
    const files = { img1: pngFile() };

    h.sync.syncLocal(files, [imageEl('e1', 'img1')]);
    await settle();
    expect(h.onUploadFailed).toHaveBeenCalledTimes(1);

    // Zaległy stan sceny tuż po błędzie (element jeszcze nieusunięty) nie wznawia wysyłki.
    h.sync.syncLocal(files, [imageEl('e1', 'img1')]);
    await settle();
    expect(h.transport.upload).toHaveBeenCalledTimes(1);

    h.clock.value += RETRY_AFTER_FAILURE_MS;
    const again = [imageEl('e1', 'img1', { isDeleted: true }), imageEl('e2', 'img1')];
    h.sync.syncLocal(files, again);
    await settle();

    expect(h.transport.upload).toHaveBeenCalledTimes(2);
    expect(isFileRef(h.binding.getFile('img1') as StoredFile)).toBe(true);
    expect(h.sync.shareable(again).map((e) => e.id)).toContain('e2');
  });

  it.each([
    [413, 'too-large'],
    [400, 'unsupported'],
    [403, 'forbidden'],
  ] as const)('HTTP %i: bez ponowień, powód "%s"', async (status, reason) => {
    const h = harness();
    h.transport.upload.mockRejectedValue(apiError(status));

    h.sync.syncLocal({ img1: pngFile() }, [imageEl('e1', 'img1')]);
    await vi.advanceTimersByTimeAsync(1000);

    expect(h.transport.upload).toHaveBeenCalledTimes(1);
    expect(h.onUploadFailed).toHaveBeenCalledWith('img1', reason);
    expect(h.binding.hasFile('img1')).toBe(false);
  });

  it('503 STORAGE_NOT_CONFIGURED: obraz zostaje w dokumencie jako dataURL (jak dawniej) + log', async () => {
    const h = harness();
    h.transport.upload.mockRejectedValue(apiError(503, 'STORAGE_NOT_CONFIGURED'));

    h.sync.syncLocal({ img1: pngFile() }, [imageEl('e1', 'img1')]);
    await settle();

    expect(h.transport.upload).toHaveBeenCalledTimes(1);
    expect(h.binding.getFile('img1')).toEqual(pngFile());
    expect(h.onStored).toHaveBeenCalledWith('img1');
    expect(h.onUploadFailed).not.toHaveBeenCalled();
    expect(silentLogger.error).toHaveBeenCalled();
  });

  it('inne 503 (np. chwilowa awaria) jest ponawiane, nie przełącza na dataURL', async () => {
    const h = harness();
    h.transport.upload
      .mockRejectedValueOnce(apiError(503, 'REDIS_ERROR'))
      .mockResolvedValueOnce(uploaded());

    h.sync.syncLocal({ img1: pngFile() }, [imageEl('e1', 'img1')]);
    await vi.advanceTimersByTimeAsync(RETRY[0] + 1);

    expect(h.transport.upload).toHaveBeenCalledTimes(2);
    expect(isFileRef(h.binding.getFile('img1') as StoredFile)).toBe(true);
  });

  it('nieoczekiwana nazwa pliku z backendu: bez wpisu i bez ponowień', async () => {
    const h = harness();
    h.transport.upload.mockResolvedValue(uploaded('../../evil.webp'));

    h.sync.syncLocal({ img1: pngFile() }, [imageEl('e1', 'img1')]);
    await vi.advanceTimersByTimeAsync(1000);

    expect(h.transport.upload).toHaveBeenCalledTimes(1);
    expect(h.binding.hasFile('img1')).toBe(false);
    expect(h.onUploadFailed).toHaveBeenCalledWith('img1', 'failed');
  });

  it('niepoprawny dataURL: od razu błąd, bez wywołania backendu', async () => {
    const h = harness();
    h.sync.syncLocal({ img1: pngFile('img1', 'to-nie-dataurl') }, [imageEl('e1', 'img1')]);
    await settle();

    expect(h.transport.upload).not.toHaveBeenCalled();
    expect(h.onUploadFailed).toHaveBeenCalledWith('img1', 'unsupported');
  });
});

describe('BoardFileSync - offline', () => {
  it('bez sieci plik czeka w kolejce i wysyła się po zdarzeniu online', async () => {
    const h = harness();
    h.online.value = false;

    h.sync.syncLocal({ img1: pngFile() }, [imageEl('e1', 'img1')]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.transport.upload).not.toHaveBeenCalled();
    expect(h.onUploadFailed).not.toHaveBeenCalled();
    expect(h.sync.pendingUploads).toBe(1);

    h.online.value = true;
    window.dispatchEvent(new Event('online'));
    await settle();

    expect(h.transport.upload).toHaveBeenCalledTimes(1);
    expect(isFileRef(h.binding.getFile('img1') as StoredFile)).toBe(true);
  });

  it('błąd sieci po utracie połączenia nie zużywa prób - czeka na online', async () => {
    const h = harness();
    h.transport.upload.mockImplementationOnce(async () => {
      h.online.value = false;
      throw apiError(0, 'NETWORK_ERROR');
    });

    h.sync.syncLocal({ img1: pngFile() }, [imageEl('e1', 'img1')]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.transport.upload).toHaveBeenCalledTimes(1);
    expect(h.onUploadFailed).not.toHaveBeenCalled();

    h.online.value = true;
    h.sync.resume();
    await settle();
    expect(h.transport.upload).toHaveBeenCalledTimes(2);
    expect(h.binding.hasFile('img1')).toBe(true);
  });

  it('dispose: wynik spóźnionej wysyłki jest ignorowany, listener online odpięty', async () => {
    const h = harness();
    let finish!: (value: UploadedBoardFile) => void;
    h.transport.upload.mockReturnValue(new Promise<UploadedBoardFile>((r) => (finish = r)));
    h.sync.syncLocal({ img1: pngFile() }, [imageEl('e1', 'img1')]);

    h.sync.dispose();
    finish(uploaded());
    await settle();
    window.dispatchEvent(new Event('online'));
    await settle();

    expect(h.binding.hasFile('img1')).toBe(false);
    expect(h.onStored).not.toHaveBeenCalled();
    expect(h.transport.upload).toHaveBeenCalledTimes(1);
  });
});

describe('BoardFileSync - odbiór', () => {
  it('stary format (dataURL) trafia do Excalidraw bez pobierania', async () => {
    const h = harness();
    h.sync.receive([pngFile()]);
    await settle();

    expect(h.transport.download).not.toHaveBeenCalled();
    expect(h.addFiles).toHaveBeenCalledWith([pngFile()]);
  });

  it('odwołanie: pobranie przez backend i dataURL tylko w pamięci', async () => {
    const h = harness();
    h.binding.setFileRef({ id: 'img1', mimeType: 'image/webp', created: 9, name: FILE_NAME });

    h.sync.receive(h.binding.getFiles());
    await settle();

    expect(h.transport.download).toHaveBeenCalledWith('7', FILE_NAME);
    const [file] = h.addFiles.mock.calls[0][0] as StoredInlineFile[];
    expect(file.id).toBe('img1');
    expect(file.mimeType).toBe('image/webp');
    expect(file.created).toBe(9);
    expect(file.dataURL).toBe(`data:image/webp;base64,${btoa('webp-bytes')}`);
    // Dokument nadal trzyma samo odwołanie.
    expect(JSON.stringify(h.binding.getFile('img1'))).not.toContain('data:');
  });

  it('oba formaty naraz + zmiana zdalna od drugiej osoby', async () => {
    const { a, b } = connectedDocs();
    const h = harness(b);
    b.observeRemoteFiles((added) => h.sync.receive(added));

    a.pushFiles([pngFile('stary')]);
    a.setFileRef({ id: 'nowy', mimeType: 'image/webp', created: 1, name: FILE_NAME });
    await settle();

    const ids = h.addFiles.mock.calls.flatMap((c) => (c[0] as StoredInlineFile[]).map((f) => f.id));
    expect(ids.sort()).toEqual(['nowy', 'stary']);
    expect(h.transport.download).toHaveBeenCalledTimes(1);
  });

  it('ten sam plik nie jest pobierany dwa razy', async () => {
    const h = harness();
    h.binding.setFileRef({ id: 'img1', mimeType: 'image/webp', created: 1, name: FILE_NAME });
    h.sync.receive(h.binding.getFiles());
    h.sync.receive(h.binding.getFiles());
    await settle();
    h.sync.receive(h.binding.getFiles());
    await settle();

    expect(h.transport.download).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['../../auth/users/me'],
    ['abc.webp'],
    [`${'AB'.repeat(16)}.webp`],
    [`${'ab'.repeat(16)}.webp/../x`],
    [`${'ab'.repeat(16)}.png`],
  ])('odwołanie z nazwą spoza formatu backendu (%s) nie trafia do adresu', async (name) => {
    const h = harness();
    h.sync.receive([{ id: 'x', mimeType: 'image/webp', created: 1, ref: { v: 1, name } }]);
    await settle();

    expect(h.transport.download).not.toHaveBeenCalled();
    expect(h.addFiles).not.toHaveBeenCalled();
  });

  it('nieznana wersja odwołania jest pomijana', async () => {
    const h = harness();
    h.sync.receive([
      {
        id: 'x',
        mimeType: 'image/webp',
        created: 1,
        ref: { v: 2, name: FILE_NAME },
      } as unknown as StoredFile,
    ]);
    await settle();
    expect(h.transport.download).not.toHaveBeenCalled();
  });

  it('najwyżej 4 pobrania równolegle, reszta w kolejce', async () => {
    const h = harness();
    const resolvers: Array<(b: Blob) => void> = [];
    h.transport.download.mockImplementation(() => new Promise<Blob>((r) => resolvers.push(r)));
    const entries: StoredFile[] = Array.from({ length: 7 }, (_, i) => ({
      id: `f${i}`,
      mimeType: 'image/webp',
      created: i,
      ref: { v: 1 as const, name: `${i.toString(16).repeat(32)}.webp` },
    }));

    h.sync.receive(entries);
    await settle();
    expect(h.transport.download).toHaveBeenCalledTimes(4);

    resolvers[0](new Blob(['x'], { type: 'image/webp' }));
    await settle();
    expect(h.transport.download).toHaveBeenCalledTimes(5);

    resolvers.slice(1).forEach((r) => r(new Blob(['x'], { type: 'image/webp' })));
    await settle();
    resolvers.slice(5).forEach((r) => r(new Blob(['x'], { type: 'image/webp' })));
    await settle();
    expect(h.transport.download).toHaveBeenCalledTimes(7);
    expect(h.addFiles).toHaveBeenCalledTimes(7);
  });

  it('404: bez ponowień, zostaje puste miejsce i ostrzeżenie w logu', async () => {
    const h = harness();
    h.transport.download.mockRejectedValue(apiError(404, 'NOT_FOUND'));
    h.sync.receive([
      { id: 'x', mimeType: 'image/webp', created: 1, ref: { v: 1, name: FILE_NAME } },
    ]);
    await vi.advanceTimersByTimeAsync(1000);

    expect(h.transport.download).toHaveBeenCalledTimes(1);
    expect(h.addFiles).not.toHaveBeenCalled();
    expect(silentLogger.warn).toHaveBeenCalled();
  });

  it('błąd serwera przy pobieraniu jest ponawiany', async () => {
    const h = harness();
    h.transport.download
      .mockRejectedValueOnce(apiError(502))
      .mockResolvedValueOnce(new Blob(['ok'], { type: 'image/webp' }));
    h.sync.receive([
      { id: 'x', mimeType: 'image/webp', created: 1, ref: { v: 1, name: FILE_NAME } },
    ]);
    await vi.advanceTimersByTimeAsync(RETRY[0] + 1);
    await settle();

    expect(h.transport.download).toHaveBeenCalledTimes(2);
    expect(h.addFiles).toHaveBeenCalledTimes(1);
  });

  it('bez sieci pobranie czeka na online', async () => {
    const h = harness();
    h.online.value = false;
    h.sync.receive([
      { id: 'x', mimeType: 'image/webp', created: 1, ref: { v: 1, name: FILE_NAME } },
    ]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.transport.download).not.toHaveBeenCalled();

    h.online.value = true;
    window.dispatchEvent(new Event('online'));
    await settle();
    expect(h.transport.download).toHaveBeenCalledTimes(1);
    expect(h.addFiles).toHaveBeenCalledTimes(1);
  });

  it('tablica lokalna z odwołaniem (nie powinno się zdarzyć): pominięte bez wywołania backendu', async () => {
    const h = harness(undefined, { boardId: null });
    h.sync.receive([
      { id: 'x', mimeType: 'image/webp', created: 1, ref: { v: 1, name: FILE_NAME } },
    ]);
    await settle();
    expect(h.transport.download).not.toHaveBeenCalled();
  });
});
