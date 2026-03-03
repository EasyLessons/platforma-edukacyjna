/**
 * ============================================================================
 * PLIK: src/app/tablica/smartsearch/searchService.ts
 * ============================================================================
 *
 * Serwis wyszukiwania w manifest.json + Quick Math (obliczenia)
 * ============================================================================
 */

import * as math from 'mathjs';
import {
  ResourceManifest,
  FormulaResource,
  CardResource,
  SearchResult,
  CalculationResult,
} from './types';

let cachedManifest: ResourceManifest | null = null;

export async function loadManifest(): Promise<ResourceManifest> {
  if (cachedManifest) return cachedManifest;

  const response = await fetch('/resources/manifest.json');
  if (!response.ok) {
    throw new Error('Nie udało się załadować manifestu zasobów');
  }

  cachedManifest = await response.json();
  return cachedManifest!;
}

/**
 * 🆕 QUICK MATH - próbuje obliczyć wyrażenie matematyczne
 * Zwraca CalculationResult jeśli się uda, null jeśli nie
 */
export function tryCalculate(query: string): CalculationResult | null {
  const trimmed = query.trim();

  // Pomiń jeśli wygląda jak szukanie tekstu (same litery bez operatorów)
  if (/^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s]+$/.test(trimmed)) {
    return null;
  }

  // Musi zawierać przynajmniej jeden znak matematyczny lub funkcję
  const hasMathContent = /[\d+\-*/^()%]|sqrt|sin|cos|tan|log|ln|exp|abs|pi|e\b/i.test(trimmed);
  if (!hasMathContent) {
    return null;
  }

  try {
    // Zamień polskie nazwy na angielskie
    const expression = trimmed
      .replace(/π/g, 'pi')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/√/g, 'sqrt');

    const result = math.evaluate(expression);

    // Sprawdź czy wynik jest liczbą
    if (typeof result === 'number' && isFinite(result)) {
      // Formatuj wynik (max 10 miejsc po przecinku, usuń zbędne zera)
      const formatted = Number(result.toFixed(10)).toString();

      return {
        resultType: 'calculation',
        id: 'quick-math-result',
        expression: trimmed,
        result: formatted,
        numericResult: result,
      };
    }

    return null;
  } catch {
    // MathJS nie potrafi obliczyć - to normalne dla zwykłych wyszukiwań
    return null;
  }
}

export function searchResources(manifest: ResourceManifest, query: string): SearchResult[] {
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) return [];

  const results: SearchResult[] = [];
  const queryWords = normalizedQuery.split(/\s+/);

  // 🆕 QUICK MATH - spróbuj obliczyć wyrażenie
  const calculation = tryCalculate(query);
  if (calculation) {
    results.push(calculation);
  }

  // Szukaj w wzorach/twierdzeniach/tabelach/diagramach
  for (const formula of manifest.formulas) {
    const score = calculateScore(formula, queryWords);
    if (score > 0) {
      results.push({ ...formula, resultType: 'formula' } as SearchResult);
    }
  }

  // Szukaj w kartach wzorów
  for (const card of manifest.cards) {
    const score = calculateCardScore(card, queryWords);
    if (score > 0) {
      results.push({ ...card, resultType: 'card' } as SearchResult);
    }
  }

  // Sortuj: obliczenia najpierw, potem karty, potem reszta
  return results.sort((a, b) => {
    // Obliczenia ZAWSZE na samej górze
    if (a.resultType === 'calculation') return -1;
    if (b.resultType === 'calculation') return 1;

    // Karty wzorów na drugim miejscu
    if (a.resultType === 'card' && b.resultType !== 'card') return -1;
    if (a.resultType !== 'card' && b.resultType === 'card') return 1;

    // Następnie po order
    if ('order' in a && 'order' in b) {
      return a.order - b.order;
    }
    return 0;
  });
}

function calculateScore(formula: FormulaResource, queryWords: string[]): number {
  let score = 0;

  const searchText = [formula.title, formula.description, formula.subcategory, ...formula.tags]
    .join(' ')
    .toLowerCase();

  for (const word of queryWords) {
    if (searchText.includes(word)) {
      score += 1;

      // Bonus za dokładne dopasowanie w tytule
      if (formula.title.toLowerCase().includes(word)) {
        score += 2;
      }

      // Bonus za tag
      if (formula.tags.some((t) => t.toLowerCase().includes(word))) {
        score += 1;
      }
    }
  }

  return score;
}

function calculateCardScore(card: CardResource, queryWords: string[]): number {
  let score = 0;

  const searchText = [
    card.title,
    card.description,
    ...card.tags,
    ...card.sections.map((s) => s.name),
  ]
    .join(' ')
    .toLowerCase();

  for (const word of queryWords) {
    if (searchText.includes(word)) {
      score += 1;

      // Bonus za "karta" w query
      if (word === 'karta' || word === 'wzorów' || word === 'matura') {
        score += 3;
      }
    }
  }

  return score;
}

export function getFormulaById(
  manifest: ResourceManifest,
  id: string
): FormulaResource | undefined {
  return manifest.formulas.find((f) => f.id === id);
}

export function getResourceTypeColor(manifest: ResourceManifest, type: string): string {
  return manifest.resourceTypes[type]?.color || '#3B82F6';
}

export function getResourceTypeBgColor(manifest: ResourceManifest, type: string): string {
  return manifest.resourceTypes[type]?.bgColor || 'bg-blue-500';
}
