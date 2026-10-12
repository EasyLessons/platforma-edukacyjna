/**
 * Katalog wspólnych szablonów tablicy: arkusze CKE (strony jako WebP w `public/templates/arkusze/<id>/`).
 *
 * Strony generuje RAZ `scripts/build-templates.mjs` (z PDF-ów w `public/arkusze/`); liczba stron poniżej
 * musi się zgadzać z plikami - pilnuje tego `catalog.test.ts`. Dodanie arkusza: PDF do `public/arkusze/`,
 * wpis w SOURCES skryptu, `node scripts/build-templates.mjs`, wpis tutaj.
 * Tabela w bazie - dopiero przy dodawaniu szablonów z panelu admina (decyzja 12.10.2026).
 *
 * Karty wzorów (panel "Wzory") korzystają z tego samego mechanizmu wspólnych plików
 * (files/shared-files.ts), ale ich listą jest manifest SmartSearch (`public/resources/manifest.json`).
 */

export type SheetExam = 'matura-podstawowa' | 'matura-rozszerzona' | 'egzamin-8';

export interface SheetTemplate {
  id: string;
  kind: 'arkusz';
  exam: SheetExam;
  title: string;
  subtitle: string;
  year: number;
  pages: number;
  /** Rozmiar strony w px (wszystkie strony arkusza CKE są A4). */
  pageSize: { width: number; height: number };
  /** Folder PDF-a w `public/arkusze` - tak dashboard przekazuje arkusz w `?arkusz=`. */
  folder: string;
}

const A4 = { width: 1018, height: 1440 };

const sheet = (
  exam: SheetExam,
  year: number,
  pages: number,
  folder: string,
  title: string,
  subtitle: string
): SheetTemplate => ({
  id: `${exam}-${year}`,
  kind: 'arkusz',
  exam,
  title,
  subtitle,
  year,
  pages,
  pageSize: A4,
  folder,
});

export const SHEET_TEMPLATES: readonly SheetTemplate[] = [
  sheet(
    'matura-podstawowa',
    2025,
    32,
    '/arkusze/matura-podstawowa/2025/glowna',
    'Matura podstawowa 2025',
    'Matura główna (maj)'
  ),
  sheet(
    'matura-podstawowa',
    2024,
    32,
    '/arkusze/matura-podstawowa/2024/glowna',
    'Matura podstawowa 2024',
    'Matura (czerwiec)'
  ),
  sheet(
    'matura-podstawowa',
    2023,
    32,
    '/arkusze/matura-podstawowa/2023/glowna',
    'Matura podstawowa 2023',
    'Matura główna (maj)'
  ),
  sheet(
    'matura-rozszerzona',
    2025,
    32,
    '/arkusze/matura-rozszerzona/2025/glowna',
    'Matura rozszerzona 2025',
    'Matura główna (maj)'
  ),
  sheet(
    'matura-rozszerzona',
    2024,
    28,
    '/arkusze/matura-rozszerzona/2024/glowna',
    'Matura rozszerzona 2024',
    'Matura główna (maj)'
  ),
  sheet(
    'matura-rozszerzona',
    2023,
    28,
    '/arkusze/matura-rozszerzona/2023/glowna',
    'Matura rozszerzona 2023',
    'Matura główna (maj)'
  ),
  sheet(
    'egzamin-8',
    2025,
    25,
    '/arkusze/egzamin-8/2025/glowny',
    'Egzamin 8-klasisty 2025',
    'Arkusz główny'
  ),
  sheet(
    'egzamin-8',
    2024,
    24,
    '/arkusze/egzamin-8/2024/glowny',
    'Egzamin 8-klasisty 2024',
    'Arkusz główny'
  ),
  sheet(
    'egzamin-8',
    2023,
    24,
    '/arkusze/egzamin-8/2023/glowny',
    'Egzamin 8-klasisty 2023',
    'Arkusz główny'
  ),
];

/** Ścieżka strony (1..pages) względem `public/`: `templates/arkusze/<id>/p01.webp`. */
export function sheetPagePath(template: Pick<SheetTemplate, 'id'>, page: number): string {
  return `templates/arkusze/${template.id}/p${String(page).padStart(2, '0')}.webp`;
}

/** Miniatura = pierwsza strona arkusza. */
export function sheetThumbnail(template: Pick<SheetTemplate, 'id'>): string {
  return '/' + sheetPagePath(template, 1);
}

export function sheetById(id: string | null | undefined): SheetTemplate | null {
  return SHEET_TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Arkusz z parametru `?arkusz=` (folder z dashboardu; z albo bez końcowego `/`). */
export function sheetByFolder(folder: string | null | undefined): SheetTemplate | null {
  if (!folder) return null;
  const clean = folder.replace(/\/+$/, '');
  return SHEET_TEMPLATES.find((t) => t.folder === clean) ?? null;
}
