'use client';

/**
 * Notatka Markdown + KaTeX na tablicy Excalidraw (etap B2, ADR silnika tablicy - "Decyzja 01.10.2026" pkt 1).
 *
 * Element `embeddable` z linkiem `easylesson:note` (Excalidraw wpuszcza go przez `validateEmbeddable`)
 * i treścią w `customData.content`. Excalidraw rysuje go przez `renderEmbeddable` - tu własny React
 * (`MarkdownNoteView` ze starego silnika: react-markdown + remark-math + rehype-katex). Treść jedzie
 * z elementem przez Y.Doc jak każde pole elementu - synchronizacja i F5 bez dodatkowego kodu.
 *
 * Edycja: podwójne kliknięcie zaznaczonej notatki (przechwycone, zanim Excalidraw wstawi w tym miejscu
 * tekst) albo w treść aktywnej notatki; zapis przy wyjściu z pola, Escape anuluje. Viewer tylko czyta.
 * Eksport PNG: Excalidraw rysuje embeddable jako zastępczy prostokąt (ograniczenie biblioteki).
 *
 * Runtime `@excalidraw/excalidraw` tylko przez dynamiczny import - moduł trafia do strony z SSR.
 */

import { useCallback, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type {
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
  NonDeleted,
} from '@excalidraw/excalidraw/element/types';
import { MarkdownNoteView } from '@/_new/features/whiteboard/components/toolbar/markdown-note-tool';
import type { MarkdownNote } from '@/_new/features/whiteboard/types';
import { viewportCenter } from '../panels/insert-resources';

export const NOTE_LINK = 'easylesson:note';
export const NOTE_KIND = 'note' as const;
export const NOTE_WIDTH = 420;
export const NOTE_MIN_HEIGHT = 160;
export const NOTE_MAX_HEIGHT = 640;

export const NEW_NOTE_CONTENT =
  '## Notatka\n\nKliknij dwukrotnie, aby edytować.\n\nWzory: $a^2 + b^2 = c^2$';

export interface NoteCustomData {
  kind: typeof NOTE_KIND;
  content: string;
}

export type NoteElement = ExcalidrawEmbeddableElement & { customData: NoteCustomData };

/** `validateEmbeddable`: nasz link = true, reszta = undefined (domyślna lista domen Excalidraw). */
export function validateNoteLink(link: string): boolean | undefined {
  return link === NOTE_LINK ? true : undefined;
}

export function isNoteElement(el: ExcalidrawElement | null | undefined): el is NoteElement {
  return (
    !!el &&
    el.type === 'embeddable' &&
    !el.isDeleted &&
    el.link === NOTE_LINK &&
    (el.customData as Partial<NoteCustomData> | undefined)?.kind === NOTE_KIND
  );
}

/** Wysokość startowa wg liczby linii (po zawinięciu ~55 znaków); potem użytkownik zmienia rozmiar sam. */
export function noteHeight(content: string): number {
  const lines = content
    .split('\n')
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 55)), 0);
  return Math.min(NOTE_MAX_HEIGHT, Math.max(NOTE_MIN_HEIGHT, 24 + lines * 22));
}

/** Nowy element (niemutujący) z podmienioną treścią - wersja podbita, Excalidraw i Yjs widzą edycję. */
export function withNoteContent(el: NoteElement, content: string): NoteElement {
  return {
    ...el,
    customData: { ...el.customData, kind: NOTE_KIND, content },
    version: el.version + 1,
    versionNonce: Math.floor(Math.random() * 2 ** 31),
    updated: Date.now(),
  };
}

/** Wstawia notatkę na środek widoku i zaznacza ją. Zwraca id elementu. */
export async function insertNote(api: ExcalidrawImperativeAPI, content: string): Promise<string> {
  const { convertToExcalidrawElements, CaptureUpdateAction } =
    await import('@excalidraw/excalidraw');
  const height = noteHeight(content);
  const center = viewportCenter(api.getAppState());
  // Szkielet embeddable wymaga pełnego elementu - bierzemy prostokąt i zmieniamy typ
  // (embeddable nie ma własnych pól poza `link`).
  const [base] = convertToExcalidrawElements([
    {
      type: 'rectangle',
      x: center.x - NOTE_WIDTH / 2,
      y: center.y - height / 2,
      width: NOTE_WIDTH,
      height,
      strokeColor: '#d1d5db',
      backgroundColor: '#ffffff',
      fillStyle: 'solid',
      roughness: 0,
    },
  ]);
  const note = {
    ...base,
    type: 'embeddable',
    link: NOTE_LINK,
    roundness: null,
    customData: { kind: NOTE_KIND, content } satisfies NoteCustomData,
  } as unknown as NoteElement;

  api.updateScene({
    elements: [...api.getSceneElementsIncludingDeleted(), note],
    appState: { selectedElementIds: { [note.id]: true } },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  return note.id;
}

async function saveNoteContent(api: ExcalidrawImperativeAPI, id: string, content: string) {
  const current = api.getSceneElementsIncludingDeleted().find((e) => e.id === id);
  if (!isNoteElement(current) || current.customData.content === content) return;
  const { CaptureUpdateAction } = await import('@excalidraw/excalidraw');
  const next = withNoteContent(current, content);
  api.updateScene({
    elements: api
      .getSceneElementsIncludingDeleted()
      .map((e): ExcalidrawElement => (e.id === id ? next : e)),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
}

interface UseNoteElementsOptions {
  api: ExcalidrawImperativeAPI | null;
  readOnly: boolean;
}

/**
 * Spina notatki z Excalidraw: `validateEmbeddable` i `renderEmbeddable` dla `<Excalidraw>`,
 * przechwycenie podwójnego kliknięcia (na kontenerze tablicy) i `startEditing` dla przycisku "Notatka".
 */
export function useNoteElements({ api, readOnly }: UseNoteElementsOptions) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const startEditing = useCallback(
    (id: string) => {
      if (!readOnly) setEditingId(id);
    },
    [readOnly]
  );
  const endEditing = useCallback(() => setEditingId(null), []);

  const saveContent = useCallback(
    (id: string, content: string) => {
      if (api && !readOnly) void saveNoteContent(api, id, content);
    },
    [api, readOnly]
  );

  const renderEmbeddable = useCallback(
    (element: NonDeleted<ExcalidrawEmbeddableElement>) => {
      if (!isNoteElement(element)) return null;
      const editing = editingId === element.id;
      return (
        <div
          className="h-full w-full overflow-hidden rounded-md bg-white"
          // W edycji pole tekstowe musi dostawać mysz, także gdy Excalidraw nie aktywował osadzenia
          style={editing ? { pointerEvents: 'auto' } : undefined}
          data-testid="board-note"
          data-note-id={element.id}
        >
          <MarkdownNoteView
            // MarkdownNoteView czyta z notatki tylko `content`
            note={
              { content: element.customData.content } as Pick<
                MarkdownNote,
                'content'
              > as MarkdownNote
            }
            noteId={element.id}
            isEditing={editing}
            onContentChange={saveContent}
            onEditStart={startEditing}
            onEditEnd={endEditing}
          />
        </div>
      );
    },
    [editingId, saveContent, startEditing, endEditing]
  );

  /** Podwójne kliknięcie, gdy zaznaczona jest dokładnie jedna notatka -> edycja (zamiast tekstu Excalidraw). */
  const handleDoubleClickCapture = useCallback(
    (event: ReactMouseEvent) => {
      if (!api || readOnly) return;
      const ids = Object.keys(api.getAppState().selectedElementIds);
      if (ids.length !== 1) return;
      const selected = api.getSceneElements().find((e) => e.id === ids[0]);
      if (!isNoteElement(selected)) return;
      event.stopPropagation();
      setEditingId(selected.id);
    },
    [api, readOnly]
  );

  return {
    renderEmbeddable,
    validateEmbeddable: validateNoteLink,
    handleDoubleClickCapture,
    startEditing,
  };
}
