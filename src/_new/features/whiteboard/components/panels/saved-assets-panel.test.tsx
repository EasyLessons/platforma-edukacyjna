import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { SavedAsset } from '../../types/assets';

const fetchUserAssets = vi.fn<() => Promise<SavedAsset[]>>();

vi.mock('../../api/assets-api', () => ({
  fetchUserAssets: () => fetchUserAssets(),
  deleteUserAsset: vi.fn(),
}));

import { SavedAssetsPanel } from './saved-assets-panel';

/** Miniatury, jakie mogl zapisac w bazie atakujacy (POST /api/v1/assets/ przyjmuje dowolny string). */
const MALICIOUS_THUMBNAILS = [
  '<img src=x onerror="window.__xss = 1">',
  '<script>window.__xss = 1</script>',
  '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__xss = 1"><script>window.__xss = 1</script></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror="window.__xss = 1"/></body></foreignObject></svg>',
  '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:window.__xss = 1"><rect width="100" height="100"/></a></svg>',
  '"><img src=x onerror="window.__xss = 1">',
  '<iframe src="javascript:window.__xss = 1"></iframe>',
];

const asset = (id: number, thumbnail: string | null): SavedAsset => ({
  id,
  name: `Szablon ${id}`,
  elements_data: [],
  thumbnail,
  created_at: '2026-10-02T00:00:00Z',
});

describe('SavedAssetsPanel - miniatura z serwera (SEC-07)', () => {
  beforeEach(() => {
    fetchUserAssets.mockReset();
    delete (window as unknown as Record<string, unknown>).__xss;
  });

  afterEach(() => {
    cleanup();
  });

  it('zlosliwa miniatura nie tworzy w DOM zadnego wykonywalnego wezla', async () => {
    fetchUserAssets.mockResolvedValue(MALICIOUS_THUMBNAILS.map((t, i) => asset(i + 1, t)));

    const { container } = render(<SavedAssetsPanel onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText(`Szablon ${MALICIOUS_THUMBNAILS.length}`)).toBeInTheDocument()
    );

    expect(
      container.querySelector('script, iframe, foreignObject, object, embed, a[href]')
    ).toBeNull();
    // Ikony lucide to jedyne dozwolone <svg>; zadne nie pochodzi z miniatury.
    for (const svg of Array.from(container.querySelectorAll('svg'))) {
      expect(svg.classList.contains('lucide')).toBe(true);
    }
    for (const node of Array.from(container.querySelectorAll('*'))) {
      for (const attr of Array.from(node.attributes)) {
        expect(attr.name.toLowerCase().startsWith('on')).toBe(false);
      }
    }
    // Kazdy <img> wskazuje wylacznie na data:image/svg+xml (tryb statyczny - bez skryptow).
    for (const img of Array.from(container.querySelectorAll('img'))) {
      expect(img.getAttribute('src')!.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
      expect(img.getAttribute('src')).not.toMatch(/[<>"']/);
    }
    expect((window as unknown as Record<string, unknown>).__xss).toBeUndefined();
  });

  it('poprawna miniatura SVG renderuje sie jako <img> z data URI', async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#f00"/></svg>';
    fetchUserAssets.mockResolvedValue([asset(1, svg)]);

    const { container } = render(<SavedAssetsPanel onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Szablon 1')).toBeInTheDocument());

    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toBe(
      'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    );
    expect(imgs[0].getAttribute('draggable')).toBe('false');
  });

  it('brak miniatury lub tresc inna niz SVG nie renderuje obrazka', async () => {
    fetchUserAssets.mockResolvedValue([asset(1, null), asset(2, 'zwykly tekst')]);

    const { container } = render(<SavedAssetsPanel onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Szablon 2')).toBeInTheDocument());

    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(container.textContent).not.toContain('zwykly tekst');
  });
});
