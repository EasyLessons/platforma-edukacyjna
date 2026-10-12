/**
 * Generuje strony arkuszy CKE jako obrazy WebP - RAZ, przy dodaniu / zmianie arkusza (nie w buildzie).
 *
 *   node scripts/build-templates.mjs
 *
 * Wejście: PDF-y z `public/arkusze/**` (lista SOURCES niżej - id musi zgadzać się z
 * `src/_new/features/board-engine/templates/catalog.ts`).
 * Wyjście: `public/templates/arkusze/<id>/p01.webp, p02.webp, ...` (statycznie, CDN Vercela) i na koniec
 * liczba stron każdego arkusza do przepisania w katalogu (test `catalog.test.ts` pilnuje zgodności).
 *
 * Render: pdf.js w Chromium z Playwrighta (już w devDependencies) - przeglądarka koduje WebP sama,
 * więc bez nowych zależności (node-canvas / sharp) i bez narzędzi systemowych (pdftoppm nie zapisuje WebP).
 * Strona: dłuższy bok PAGE_MAX_SIDE px (tyle co obrazy tablicy, czytelne na ekranie), WebP jakości WEBP_QUALITY.
 */

import { createServer } from 'node:http';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'templates', 'arkusze');
const PAGE_MAX_SIDE = 1440;
const WEBP_QUALITY = 0.82;

/** id szablonu -> PDF w public/arkusze. */
export const SOURCES = {
  'matura-podstawowa-2025':
    'matura-podstawowa/2025/glowna/matematyka-2025-maj-matura-podstawowa.pdf',
  'matura-podstawowa-2024':
    'matura-podstawowa/2024/glowna/matematyka-2024-czerwiec-matura-podstawowa.pdf',
  'matura-podstawowa-2023':
    'matura-podstawowa/2023/glowna/matematyka-2023-maj-matura-podstawowa.pdf',
  'matura-rozszerzona-2025':
    'matura-rozszerzona/2025/glowna/matematyka-2025-maj-matura-rozszerzona.pdf',
  'matura-rozszerzona-2024':
    'matura-rozszerzona/2024/glowna/matematyka-2024-maj-matura-rozszerzona.pdf',
  'matura-rozszerzona-2023':
    'matura-rozszerzona/2023/glowna/matematyka-2023-maj-matura-rozszerzona.pdf',
  'egzamin-8-2025': 'egzamin-8/2025/glowny/matematyka-2025-egzamin-osmoklasisty.pdf',
  'egzamin-8-2024': 'egzamin-8/2024/glowny/matematyka-2024-egzamin-osmoklasisty.pdf',
  'egzamin-8-2023': 'egzamin-8/2023/glowny/matematyka-2023-egzamin-osmoklasisty.pdf',
};

const MIME = { '.mjs': 'text/javascript', '.pdf': 'application/pdf', '.html': 'text/html' };

/** Minimalny serwer: pdf.js z node_modules i PDF-y z public/arkusze (moduły ES nie ładują się z file://). */
function serve() {
  const files = {
    '/pdf.mjs': join(ROOT, 'node_modules/pdfjs-dist/build/pdf.min.mjs'),
    '/pdf.worker.mjs': join(ROOT, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
  };
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent(req.url ?? '/');
    if (url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><body></body>');
      return;
    }
    const path = files[url] ?? (url.startsWith('/arkusze/') ? join(ROOT, 'public', url) : null);
    if (!path || path.includes('..')) return void res.writeHead(404).end();
    try {
      const body = await readFile(path);
      res.writeHead(200, {
        'content-type': MIME[path.slice(path.lastIndexOf('.'))] ?? 'application/octet-stream',
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function main() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(base + '/');
  const counts = {};
  try {
    for (const [id, source] of Object.entries(SOURCES)) {
      const pages = await page.evaluate(
        async ({ base, source, maxSide, quality }) => {
          const pdfjs = await import(base + '/pdf.mjs');
          pdfjs.GlobalWorkerOptions.workerSrc = base + '/pdf.worker.mjs';
          const pdf = await pdfjs.getDocument(base + '/arkusze/' + source).promise;
          const out = [];
          for (let n = 1; n <= pdf.numPages; n++) {
            const p = await pdf.getPage(n);
            const v1 = p.getViewport({ scale: 1 });
            const viewport = p.getViewport({ scale: maxSide / Math.max(v1.width, v1.height) });
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await p.render({ canvas, canvasContext: ctx, viewport }).promise;
            out.push({
              dataURL: canvas.toDataURL('image/webp', quality),
              width: canvas.width,
              height: canvas.height,
            });
          }
          return out;
        },
        { base, source, maxSide: PAGE_MAX_SIDE, quality: WEBP_QUALITY }
      );
      const dir = join(OUT, id);
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
      let bytes = 0;
      for (const [i, p] of pages.entries()) {
        const buf = Buffer.from(p.dataURL.slice(p.dataURL.indexOf(',') + 1), 'base64');
        bytes += buf.length;
        await writeFile(join(dir, `p${String(i + 1).padStart(2, '0')}.webp`), buf);
      }
      counts[id] = { pages: pages.length, width: pages[0].width, height: pages[0].height };
      console.log(`${id}: ${pages.length} stron, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log('\nLiczby stron do catalog.ts:\n' + JSON.stringify(counts, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
