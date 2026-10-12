'use client';

/**
 * Jednorazowe wstawienie arkusza przekazanego z dashboardu (`/whiteboard?...&arkusz=<folder>`).
 * Czeka, aż scena ma stan z serwera (`ready`), żeby sprawdzenie "arkusz już jest" nie trafiło w pustą
 * scenę przed synchronizacją (F5 z parametrem w adresie nie może zdublować stron). Viewer niczego nie wstawia.
 */

import { useEffect, useRef, useState } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { createLogger } from '@/_new/lib/logger';
import { sheetById } from './catalog';
import { hasSheet, insertSheet } from './insert-sheet';

const log = createLogger('board-engine/use-sheet-insert');

export type SheetInsertState = 'idle' | 'loading' | 'done' | 'error';

interface Options {
  api: ExcalidrawImperativeAPI | null;
  templateId: string | null | undefined;
  ready: boolean;
  readOnly: boolean;
  /** Arkusz jest na tablicy (wstawiony teraz albo wcześniej) - strona czyści `?arkusz=`. */
  onDone?: () => void;
}

export function useSheetInsert({
  api,
  templateId,
  ready,
  readOnly,
  onDone,
}: Options): SheetInsertState {
  const [state, setState] = useState<SheetInsertState>('idle');
  const startedRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const template = sheetById(templateId);
    if (!api || !ready || !template || readOnly || startedRef.current) return;
    startedRef.current = true;
    if (hasSheet(api.getSceneElements(), template.id)) {
      setState('done');
      onDoneRef.current?.();
      return;
    }
    setState('loading');
    insertSheet(api, template)
      .then(() => {
        setState('done');
        onDoneRef.current?.();
      })
      .catch((error) => {
        log.error('Wstawianie arkusza nie powiodło się', error);
        setState('error');
      });
  }, [api, ready, templateId, readOnly]);

  return state;
}
