/**
 * Domyślne lekkie wypełnienie kształtów (decyzja Patryka z 01.10.2026).
 *
 * Excalidraw zaznacza kształt bez wypełnienia tylko po obrysie - klik w środek pustego
 * prostokąta nic nie robi, a na starej tablicy zaznaczał. Kształt z dowolnym
 * nieprzezroczystym tłem (także półprzezroczystym `#rrggbbaa`) łapie klik w środku.
 *
 * Wypełnienie dostają tylko prostokąt, elipsa i romb. Pióro i linie NIE - zamknięta
 * pętla odręcznego pisma (np. "o", "0") też by się wypełniała.
 *
 * Reagujemy wyłącznie na ZMIANĘ narzędzia, więc własny wybór użytkownika w panelu
 * (np. "bez tła" dla prostokąta) obowiązuje do następnej zmiany narzędzia.
 */

/** 5% czerni - widać kształt, nie zasłania tego, co pod spodem. */
export const DEFAULT_SHAPE_FILL = '#1e1e1e0d';
export const NO_FILL = 'transparent';

const FILLED_TOOLS = new Set(['rectangle', 'ellipse', 'diamond']);

/** Nowe `currentItemBackgroundColor` po zmianie narzędzia albo null (bez zmiany). */
export function backgroundForTool(tool: string, currentBackground: string): string | null {
  if (FILLED_TOOLS.has(tool)) return currentBackground === NO_FILL ? DEFAULT_SHAPE_FILL : null;
  return currentBackground === DEFAULT_SHAPE_FILL ? NO_FILL : null;
}
