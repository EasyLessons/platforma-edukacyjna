import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import {
  PanelLayer,
  PanelToggles,
  availablePanels,
  useBoardPanels,
  type BoardPanelId,
  type BoardPanelsState,
} from './board-panels';

// jsdom nie ma ResizeObservera i nie liczy layoutu (clientWidth = 0)
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1200);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Harness({
  placement = 'top-right',
  available = ['calculator'],
}: {
  placement?: 'top-right' | 'mobile';
  available?: BoardPanelId[];
}) {
  const panels = useBoardPanels();
  return (
    <>
      <PanelToggles panels={panels} available={available} placement={placement} />
      <PanelLayer panels={panels} available={available} api={null} />
    </>
  );
}

describe('availablePanels', () => {
  it('wzory tylko przy smartsearch_visible i prawie edycji, kalkulator zawsze', () => {
    expect(availablePanels({ readOnly: false, smartSearchVisible: true })).toEqual([
      'search',
      'calculator',
    ]);
    expect(availablePanels({ readOnly: false, smartSearchVisible: false })).toEqual(['calculator']);
    expect(availablePanels({ readOnly: true, smartSearchVisible: true })).toEqual(['calculator']);
  });
});

describe('panel wzorów', () => {
  it('przycisk otwiera wyszukiwarkę od razu z polem do wpisania', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {}))
    );
    render(<Harness available={['search', 'calculator']} />);
    expect(screen.queryByTestId('panel-search')).toBeNull();

    fireEvent.click(screen.getByTestId('panel-toggle-search'));
    const panel = screen.getByTestId('panel-search');
    expect(panel.querySelector('input')).not.toBeNull();

    fireEvent.click(screen.getByTestId('panel-toggle-search'));
    expect(screen.queryByTestId('panel-search')).toBeNull();
  });

  it('niedostępny panel nie ma przycisku', () => {
    render(<Harness available={['calculator']} />);
    expect(screen.queryByTestId('panel-toggle-search')).toBeNull();
  });
});

describe('useBoardPanels', () => {
  it('toggle otwiera i zamyka panel, close zamyka tylko otwarty', () => {
    const { result } = renderHook(() => useBoardPanels());
    const panels = (): BoardPanelsState => result.current;

    expect(panels().isOpen('calculator')).toBe(false);
    act(() => panels().toggle('calculator'));
    expect(panels().isOpen('calculator')).toBe(true);
    act(() => panels().toggle('calculator'));
    expect(panels().isOpen('calculator')).toBe(false);

    act(() => panels().toggle('calculator'));
    act(() => panels().close('calculator'));
    act(() => panels().close('calculator'));
    expect(panels().isOpen('calculator')).toBe(false);
  });
});

describe('panel kalkulatora', () => {
  it('przycisk otwiera kalkulator, a jego X go zamyka', () => {
    render(<Harness />);
    expect(screen.queryByTestId('panel-calculator')).toBeNull();

    const toggle = screen.getByTestId('panel-toggle-calculator');
    fireEvent.click(toggle);
    expect(screen.getByTestId('panel-calculator')).toBeTruthy();
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    // nagłówek kalkulatora: [fx] [X] - zamyka drugi przycisk (sama ikona)
    const panel = screen.getByTestId('panel-calculator');
    const closeButton = panel.querySelectorAll('button')[1];
    expect(closeButton).not.toBeNull();
    fireEvent.click(closeButton!);
    expect(screen.queryByTestId('panel-calculator')).toBeNull();
  });

  it('kalkulator liczy', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('panel-toggle-calculator'));
    const panel = screen.getByTestId('panel-calculator');
    const button = (label: string) =>
      [...panel.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;

    fireEvent.click(button('7'));
    fireEvent.click(button('8'));
    expect(panel.textContent).toContain('78');
  });

  it('na telefonie przycisk jest samą ikoną z etykietą dostępności', () => {
    render(<Harness placement="mobile" />);
    const toggle = screen.getByTestId('panel-toggle-calculator');
    expect(toggle.getAttribute('aria-label')).toBe('Kalkulator');
    expect(toggle.textContent).toBe('');
  });
});
