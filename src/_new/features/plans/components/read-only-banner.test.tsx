import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ReadOnlyBanner } from './read-only-banner';

describe('ReadOnlyBanner', () => {
  it('pokazuje komunikat z limitem 300 elementów', () => {
    render(<ReadOnlyBanner limit={300} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tablica przekroczyła limit 300 elementów planu Free — tryb tylko do odczytu.'
    );
  });

  it('bez limitu — tekst bez liczby', () => {
    render(<ReadOnlyBanner limit={null} />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Tablica przekroczyła limit elementów planu Free');
    expect(banner).not.toHaveTextContent('300');
  });

  it('bez onUpgradeClick nie ma przycisku', () => {
    render(<ReadOnlyBanner limit={300} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('przycisk „Przejdź na Premium" woła onUpgradeClick', () => {
    const onUpgradeClick = vi.fn();
    render(<ReadOnlyBanner limit={300} onUpgradeClick={onUpgradeClick} />);
    fireEvent.click(screen.getByRole('button', { name: 'Przejdź na Premium' }));
    expect(onUpgradeClick).toHaveBeenCalledTimes(1);
  });
});
