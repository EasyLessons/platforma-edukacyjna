/**
 * ============================================================================
 * PLIK: src/app/tablica/smartsearch/types.ts
 * ============================================================================
 * 
 * Typy dla SmartSearch - wyszukiwanie wzorów i kart wzorów
 * ============================================================================
 */

export interface ResourceType {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  action: 'open-viewer' | 'instant-add';
  priority: number;
}

export interface FormulaResource {
  id: string;
  type: 'formula' | 'theorem' | 'table' | 'diagram';
  title: string;
  description: string;
  category: string;
  subcategory: string;
  tags: string[];
  path: string;
  dimensions: { width: number; height: number };
  order: number;
}

export interface CardSection {
  id: string;
  name: string;
  order: number;
  items: { ref: string }[];
}

export interface CardResource {
  id: string;
  type: 'card';
  title: string;
  description: string;
  category: string;
  tags: string[];
  sections: CardSection[];
}

export interface ResourceManifest {
  version: string;
  lastUpdated: string;
  resourceTypes: Record<string, ResourceType>;
  categories: {
    id: string;
    name: string;
    subcategories: { id: string; name: string; order: number }[];
  }[];
  formulas: FormulaResource[];
  cards: CardResource[];
}

export type SearchResult = 
  | (FormulaResource & { resultType: 'formula' })
  | (CardResource & { resultType: 'card' });
