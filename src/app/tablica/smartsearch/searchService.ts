/**
 * ============================================================================
 * PLIK: src/app/tablica/smartsearch/searchService.ts
 * ============================================================================
 * 
 * Serwis wyszukiwania w manifest.json
 * ============================================================================
 */

import { ResourceManifest, FormulaResource, CardResource, SearchResult } from './types';

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

export function searchResources(
  manifest: ResourceManifest,
  query: string
): SearchResult[] {
  const normalizedQuery = query.toLowerCase().trim();
  
  if (!normalizedQuery) return [];
  
  const results: SearchResult[] = [];
  const queryWords = normalizedQuery.split(/\s+/);
  
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
  
  // Sortuj: karty najpierw (mają wyższy priorytet), potem po kolejności
  return results.sort((a, b) => {
    // Karty wzorów zawsze na górze
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
  
  const searchText = [
    formula.title,
    formula.description,
    formula.subcategory,
    ...formula.tags
  ].join(' ').toLowerCase();
  
  for (const word of queryWords) {
    if (searchText.includes(word)) {
      score += 1;
      
      // Bonus za dokładne dopasowanie w tytule
      if (formula.title.toLowerCase().includes(word)) {
        score += 2;
      }
      
      // Bonus za tag
      if (formula.tags.some(t => t.toLowerCase().includes(word))) {
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
    ...card.sections.map(s => s.name)
  ].join(' ').toLowerCase();
  
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
  return manifest.formulas.find(f => f.id === id);
}

export function getResourceTypeColor(
  manifest: ResourceManifest,
  type: string
): string {
  return manifest.resourceTypes[type]?.color || '#3B82F6';
}

export function getResourceTypeBgColor(
  manifest: ResourceManifest,
  type: string
): string {
  return manifest.resourceTypes[type]?.bgColor || 'bg-blue-500';
}
