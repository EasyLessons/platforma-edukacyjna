/**
 * Notatka Markdown + KaTeX na prawdziwym Excalidraw: wstawienie, render (KaTeX), edycja i zapis treści.
 */

import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawEmbeddableElement, NonDeleted } from '@excalidraw/excalidraw/element/types';
import {
  NOTE_LINK,
  NOTE_MAX_HEIGHT,
  NOTE_MIN_HEIGHT,
  NOTE_WIDTH,
  insertNote,
  isNoteElement,
  noteHeight,
  useNoteElements,
  validateNoteLink,
  withNoteContent,
  type NoteElement,
} from './note';

// Montowanie Excalidraw w jsdom trwa kilka sekund pod obciążeniem (pełny przebieg) - 5 s to za mało.
vi.setConfig({ testTimeout: 20_000 });

beforeAll(() => {
  // src/test/setup.ts podmienia window.location bez `search`/`hash`, a Excalidraw ich używa.
  Object.assign(window.location, { search: '', hash: '' });
});

afterEach(() => cleanup());

async function mountExcalidraw(): Promise<ExcalidrawImperativeAPI> {
  let api: ExcalidrawImperativeAPI | null = null;
  render(
    <div style={{ width: 800, height: 600 }}>
      <Excalidraw excalidrawAPI={(a) => (api = a)} validateEmbeddable={validateNoteLink} />
    </div>
  );
  await waitFor(() => expect(api).not.toBeNull());
  return api as unknown as ExcalidrawImperativeAPI;
}

const notes = (api: ExcalidrawImperativeAPI) =>
  api.getSceneElements().filter((e) => isNoteElement(e)) as unknown as NoteElement[];

describe('validateNoteLink / noteHeight', () => {
  it('przepuszcza tylko link notatki, resztę oddaje domyślnej liście Excalidraw', () => {
    expect(validateNoteLink(NOTE_LINK)).toBe(true);
    expect(validateNoteLink('https://youtube.com/watch?v=x')).toBeUndefined();
  });

  it('wysokość rośnie z treścią w granicach', () => {
    expect(noteHeight('a')).toBe(NOTE_MIN_HEIGHT);
    expect(noteHeight('x\n'.repeat(200))).toBe(NOTE_MAX_HEIGHT);
    expect(noteHeight('x\n'.repeat(10))).toBeGreaterThan(NOTE_MIN_HEIGHT);
  });
});

describe('insertNote', () => {
  it('wstawia embeddable z linkiem i treścią, zaznaczony', async () => {
    const api = await mountExcalidraw();
    const id = await insertNote(api, 'Pole koła: $P = \\pi r^2$');

    const [note] = notes(api);
    expect(note.id).toBe(id);
    expect(note.link).toBe(NOTE_LINK);
    expect(note.width).toBe(NOTE_WIDTH);
    expect(note.customData).toEqual({ kind: 'note', content: 'Pole koła: $P = \\pi r^2$' });
    await waitFor(() => expect(api.getAppState().selectedElementIds).toEqual({ [id]: true }));
  });
});

describe('withNoteContent', () => {
  it('nowa treść = nowy obiekt z podbitą wersją', async () => {
    const api = await mountExcalidraw();
    await insertNote(api, 'stara');
    const [note] = notes(api);
    const next = withNoteContent(note, 'nowa');
    expect(next).not.toBe(note);
    expect(next.customData.content).toBe('nowa');
    expect(next.version).toBe(note.version + 1);
    expect(note.customData.content).toBe('stara');
  });
});

describe('useNoteElements', () => {
  it('render: Markdown + KaTeX; podwójne kliknięcie w treść -> edycja -> zapis do elementu', async () => {
    const api = await mountExcalidraw();
    await insertNote(api, '## Tytuł\n\nWzór: $a^2$');
    const { result } = renderHook(() => useNoteElements({ api, readOnly: false }));

    const view = () =>
      render(
        <>
          {result.current.renderEmbeddable(
            notes(api)[0] as NonDeleted<ExcalidrawEmbeddableElement>
          )}
        </>
      );
    const first = view();
    expect(screen.getByRole('heading', { name: 'Tytuł' })).toBeTruthy();
    expect(first.container.querySelector('.katex')).not.toBeNull();

    // edycja (MarkdownNoteView: podwójne kliknięcie w treść)
    fireEvent.doubleClick(screen.getByText(/Wzór/));
    first.unmount();
    const editing = view();
    const textarea = editing.container.querySelector('textarea')!;
    expect(textarea.value).toBe('## Tytuł\n\nWzór: $a^2$');
    fireEvent.change(textarea, { target: { value: 'Nowa treść' } });
    act(() => {
      fireEvent.blur(textarea);
    });

    await waitFor(() => expect(notes(api)[0].customData.content).toBe('Nowa treść'));
  });

  it('viewer: nie wchodzi w edycję i nie zapisuje', async () => {
    const api = await mountExcalidraw();
    await insertNote(api, 'treść');
    const { result } = renderHook(() => useNoteElements({ api, readOnly: true }));
    const note = notes(api)[0] as NoteElement;

    act(() => result.current.startEditing(note.id));
    const { container } = render(
      <>{result.current.renderEmbeddable(note as NonDeleted<ExcalidrawEmbeddableElement>)}</>
    );
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('obcy embeddable (np. YouTube) zostaje Excalidraw (null)', async () => {
    const { result } = renderHook(() => useNoteElements({ api: null, readOnly: false }));
    const foreign = {
      type: 'embeddable',
      link: 'https://youtube.com/watch?v=x',
      isDeleted: false,
      customData: undefined,
    } as unknown as NonDeleted<ExcalidrawEmbeddableElement>;
    expect(result.current.renderEmbeddable(foreign)).toBeNull();
  });
});
