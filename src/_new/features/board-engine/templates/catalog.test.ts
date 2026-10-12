import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SHEET_TEMPLATES, sheetByFolder, sheetById, sheetPagePath } from './catalog';

const PUBLIC = join(process.cwd(), 'public');

describe('katalog arkuszy', () => {
  it('każdy arkusz ma dokładnie tyle plików stron, ile mówi katalog (scripts/build-templates.mjs)', () => {
    for (const template of SHEET_TEMPLATES) {
      for (let page = 1; page <= template.pages; page++) {
        expect(
          existsSync(join(PUBLIC, sheetPagePath(template, page))),
          `${template.id} p${page}`
        ).toBe(true);
      }
      expect(existsSync(join(PUBLIC, sheetPagePath(template, template.pages + 1)))).toBe(false);
    }
  });

  it('id unikalne, folder z dashboardu znajduje arkusz', () => {
    expect(new Set(SHEET_TEMPLATES.map((t) => t.id)).size).toBe(SHEET_TEMPLATES.length);
    expect(sheetByFolder('/arkusze/egzamin-8/2025/glowny')?.id).toBe('egzamin-8-2025');
    expect(sheetByFolder('/arkusze/egzamin-8/2025/glowny/')?.id).toBe('egzamin-8-2025');
    expect(sheetByFolder('/arkusze/matura-podstawowa/2025/dodatkowa')).toBeNull();
    expect(sheetById('nie-ma')).toBeNull();
  });
});
