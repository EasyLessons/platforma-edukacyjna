import { describe, expect, it, vi } from 'vitest';

// `next/font/local` jest przeksztalcane przez kompilator Nexta; w vitest podmieniamy loader
// na funkcje, ktora oddaje przekazane opcje - test pilnuje samej konfiguracji fontow.
vi.mock('next/font/local', () => ({
  default: (options: unknown) => ({ className: 'mock', options }),
}));

type SrcEntry = { path: string; weight?: string; style?: string };
type Loaded = { options: { src: string | SrcEntry[]; weight?: string; preload?: boolean } };

async function load() {
  return (await import('./index')) as unknown as Record<string, Loaded>;
}

describe('shared/fonts', () => {
  it('plusJakartaSansDiscrete ma dokladnie wagi 300/400/600/700/800 (bez 500)', async () => {
    const { plusJakartaSansDiscrete } = await load();
    const src = plusJakartaSansDiscrete.options.src as SrcEntry[];

    // Regresja: jeden wpis z zakresem "200 800" dawal prawdziwe 500 dla `font-medium`
    // i pogrubial teksty w Hero/Pricing wzgledem wersji z next/font/google.
    expect(src.map((entry) => entry.weight)).toEqual(['300', '400', '600', '700', '800']);
    expect(plusJakartaSansDiscrete.options.weight).toBeUndefined();
    expect(new Set(src.map((entry) => entry.path)).size).toBe(1);
  });

  it('loadery o pelnym zakresie wag zostaja przy 200-800, root bez preloadu', async () => {
    const { plusJakartaSans, plusJakartaSansRoot, playfairDisplayRoot } = await load();

    expect(plusJakartaSans.options.weight).toBe('200 800');
    expect(plusJakartaSansRoot.options.weight).toBe('200 800');
    expect(plusJakartaSansRoot.options.preload).toBe(false);
    expect(playfairDisplayRoot.options.preload).toBe(false);
  });
});
