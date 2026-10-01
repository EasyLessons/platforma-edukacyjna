/**
 * Kopiuje fonty Excalidraw z node_modules do public/excalidraw-assets/, żeby tablica
 * nie pobierała ich z CDN (esm.sh) - szkoły bywają bez dostępu do zewnętrznych CDN.
 *
 * Uruchamiany automatycznie przez `predev` i `prebuild` (package.json). Folder docelowy
 * jest w .gitignore: ~14 MB binariów, zawsze w wersji zgodnej z zainstalowanym pakietem.
 * Ścieżkę podaje Excalidraw-owi `window.EXCALIDRAW_ASSET_PATH`
 * (src/_new/features/board-engine/components/excalidraw-whiteboard.tsx).
 */

import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules/@excalidraw/excalidraw/dist/prod/fonts');
const target = path.join(root, 'public/excalidraw-assets/fonts');

if (!existsSync(source)) {
  console.error(`[excalidraw-assets] brak ${source} - czy wykonano npm ci?`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log(`[excalidraw-assets] fonty skopiowane do ${path.relative(root, target)}`);
