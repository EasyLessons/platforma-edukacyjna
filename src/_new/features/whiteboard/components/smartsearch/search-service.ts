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

function normalizeText(text: string): string {
  const map: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z'
  };
  return text.toLowerCase().replace(/[ąćęłńóśźż]/g, match => map[match]);
}

export function searchResources(manifest: ResourceManifest, query: string): SearchResult[] {
  const rawQuery = query.trim();
  const normalizedQuery = normalizeText(rawQuery);

  if (!normalizedQuery) return [];

  // Pokaż tylko karty wzorów dla polecenia docelowego
  if (normalizedQuery === 'karty wzorow') {
    return manifest.cards.map(card => ({ ...card, resultType: 'card' } as SearchResult))
      .sort((a, b) => {
        const orderA = 'order' in a ? (a.order as number) : 0;
        const orderB = 'order' in b ? (b.order as number) : 0;
        return orderA - orderB;
      });
  }

  const resultsWithScore: { item: SearchResult; score: number }[] = [];
  const queryWords = normalizedQuery.split(/\s+/);

  // 🆕 QUICK MATH - spróbuj obliczyć wyrażenie
  const calculation = tryCalculate(query);
  if (calculation) {
    resultsWithScore.push({ item: calculation, score: 999999 });
  }

  // Szukaj w wzorach/twierdzeniach/tabelach/diagramach
  for (const formula of manifest.formulas) {
    const score = calculateScore(formula, queryWords);
    if (score > 0) {
      resultsWithScore.push({ item: { ...formula, resultType: 'formula' } as SearchResult, score });
    }
  }

  // Szukaj w kartach wzorów
  for (const card of manifest.cards) {
    const score = calculateCardScore(card, queryWords);
    if (score > 0) {
      resultsWithScore.push({ item: { ...card, resultType: 'card' } as SearchResult, score });
    }
  }

  // Sortuj według wyniku (i po kategoriach)
  resultsWithScore.sort((a, b) => {
    // Obliczenia ZAWSZE na samej górze
    if (a.item.resultType === 'calculation') return -1;
    if (b.item.resultType === 'calculation') return 1;

    // Najważniejszy jest wynik dopasowania robiony przez algorytm (punkty)
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    // Jeśli wynik (score) jest idealnie Taki Sam, jako drugi priorytet weź typ "karta"
    if (a.item.resultType === 'card' && b.item.resultType !== 'card') return -1;
    if (a.item.resultType !== 'card' && b.item.resultType === 'card') return 1;

    // Jeśli wszystko jest to samo, sortuj po naturalnym polu 'order'
    const orderA = 'order' in a.item ? (a.item.order as number) : 0;
    const orderB = 'order' in b.item ? (b.item.order as number) : 0;
    return orderA - orderB;
  });

  return resultsWithScore.map(r => r.item);
}

function calculateScore(formula: FormulaResource, queryWords: string[]): number {
  let score = 0;

  const normalizedTitle = normalizeText(formula.title);
  const normalizedDesc = normalizeText(formula.description);
  const normalizedTags = formula.tags.map(normalizeText);
  const normalizedSubcat = normalizeText(formula.subcategory);

  for (const word of queryWords) {
    let wordMatched = false;

    // Przeszukujemy pola z RÓŻNYMI WAGAMI

    // Tytuł - super priorytet (+10 punktów)
    if (normalizedTitle.includes(word)) {
      score += 10;
      wordMatched = true;
    }

    // Tagi - wysoki priorytet (+5 punktów)
    if (normalizedTags.some(t => t.includes(word))) {
      score += 5;
      wordMatched = true;
    }

    // Kategoria/Podkategoria - średni priorytet (+2 punkty)
    if (normalizedSubcat.includes(word)) {
      score += 2;
      wordMatched = true;
    }

    // Opis - niski priorytet (+1 punkt) - dopiero gdy zgadza się cokolwiek
    if (normalizedDesc.includes(word)) {
      score += 1;
      wordMatched = true;
    }
  }

  return score;
}

function calculateCardScore(card: CardResource, queryWords: string[]): number {
  let score = 0;

  const searchText = normalizeText([
    card.title,
    card.description,
    ...card.tags,
    ...card.sections.map((s) => s.name),
  ]
    .join(' '));

  for (const word of queryWords) {
    if (searchText.includes(word)) {
      score += 1;

      // Bonus za "karta" w query
      if (word === 'karta' || word === 'wzorow' || word === 'matura') {
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
