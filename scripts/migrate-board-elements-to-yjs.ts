/**
 * scripts/migrate-board-elements-to-yjs.ts
 *
 * JEDNORAZOWY (ale bezpiecznie powtarzalny) skrypt migracyjny: board_elements
 * -> Y.Doc -> board_documents, DLA WSZYSTKICH tablic z elementami — NADPISUJE
 * istniejący wiersz w board_documents, jeśli już jest (ON CONFLICT DO
 * UPDATE). Dzisiejsza zawartość board_documents (dane testowe) uznana za
 * nieistotną — patrz plan.
 *
 * Reużywa przetestowaną logikę z Fazy 0 (board-doc.ts) zamiast pisać
 * transformację od zera w innym języku/bibliotece.
 *
 * UŻYCIE (zawsze najpierw --dry-run):
 *   DATABASE_URL="postgres://..." npx tsx scripts/migrate-board-elements-to-yjs.ts --dry-run
 *   DATABASE_URL="postgres://..." npx tsx scripts/migrate-board-elements-to-yjs.ts --dry-run --board-id=123
 *   DATABASE_URL="postgres://..." npx tsx scripts/migrate-board-elements-to-yjs.ts --apply
 *   DATABASE_URL="postgres://..." npx tsx scripts/migrate-board-elements-to-yjs.ts --apply --board-id=123
 *
 * `DATABASE_URL` — ta sama wartość co `backend/.env`'s DATABASE_URL.
 * `--board-id=<id>` — ogranicza do jednej tablicy (testuj na jednej przed
 * puszczeniem na wszystkie).
 */


import { Client } from 'pg';
import * as Y from 'yjs';
import {
  createBoardDoc,
  hydrate,
  getElements,
} from '../src/_new/features/whiteboard/yjs/board-doc';
import type { DrawingElement } from '../src/_new/features/whiteboard/types';

const DRY_RUN = !process.argv.includes('--apply');
const boardIdArg = process.argv.find((a) => a.startsWith('--board-id='));
const ONLY_BOARD_ID = boardIdArg ? Number(boardIdArg.split('=')[1]) : null;

interface ElementRow {
  element_id: string;
  data: DrawingElement;
  created_by: number | null;
  created_at: Date;
  username: string | null;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log(
    DRY_RUN ? 'DRY RUN — nic nie zostanie zapisane' : 'APPLY — zapisuję do board_documents'
  );
  if (ONLY_BOARD_ID) console.log(`Ograniczone do tablicy ${ONLY_BOARD_ID}`);

  const { rows: boards } = await client.query<{ board_id: number }>(
    `
    SELECT DISTINCT be.board_id
    FROM board_elements be
    WHERE be.is_deleted IS NOT TRUE
      AND ($1::int IS NULL OR be.board_id = $1)
    ORDER BY be.board_id
    `,
    [ONLY_BOARD_ID]
  );

  console.log(`Znaleziono ${boards.length} tablic do migracji.`);

  let migrated = 0;
  let failed = 0;

  for (const { board_id } of boards) {
    try {
      const { rows: elementRows } = await client.query<ElementRow>(
        `
        SELECT be.element_id, be.data, be.created_by, be.created_at, u.username
        FROM board_elements be
        LEFT JOIN users u ON u.id = be.created_by
        WHERE be.board_id = $1 AND be.is_deleted IS NOT TRUE
        ORDER BY be.created_at ASC
        `,
        [board_id]
      );

      if (elementRows.length === 0) continue;

      const elements: DrawingElement[] = elementRows.map((r) => r.data);
      const metaById = new Map(
        elementRows.map((r) => [
          r.element_id,
          {
            createdBy: r.created_by,
            createdByName: r.username,
            createdAt: new Date(r.created_at).toISOString(),
          },
        ])
      );

      const doc = createBoardDoc();
      hydrate(doc, elements, 'migration-script', (id) => metaById.get(id) ?? {});

      // Weryfikacja round-trip PRZED zapisem — "dry-run + weryfikacja
      // liczby elementów" z planu nadrzędnego, dosłownie.
      const roundTripped = getElements(doc);
      if (roundTripped.length !== elements.length) {
        throw new Error(
          `Niezgodność liczby elementów: źródło ${elements.length}, po hydrate ${roundTripped.length}`
        );
      }

      const snapshot = Y.encodeStateAsUpdate(doc);
      console.log(
        `Tablica ${board_id}: ${elements.length} elementów -> snapshot ${snapshot.byteLength} B` +
          (DRY_RUN ? ' (dry-run, pomijam zapis)' : '')
      );

      if (!DRY_RUN) {
        await client.query(
          `INSERT INTO board_documents (board_id, snapshot, updated_at)
           VALUES ($1, $2, now())
           ON CONFLICT (board_id) DO UPDATE
           SET snapshot = EXCLUDED.snapshot, updated_at = EXCLUDED.updated_at`,
          [board_id, Buffer.from(snapshot)]
        );
      }

      migrated++;
    } catch (err) {
      failed++;
      console.error(`Tablica ${board_id} — błąd:`, err);
    }
  }

  console.log(
    `\nGotowe. Zmigrowano: ${migrated}, błędy: ${failed}, pominięte (0 elementów): ${
      boards.length - migrated - failed
    }`
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
