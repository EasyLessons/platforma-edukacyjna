/**
 * Testy zachowania FunctionTool spisane PRZED podzialem pliku na moduly.
 * Pilnuja, ze walidacja wyrazenia, tworzenie FunctionPlot, live preview,
 * modal pomocy i obsluga kolka myszy dzialaja tak samo po refaktorze.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { FunctionTool } from '../function-tool';
import type { FunctionPlot, ViewportTransform } from '@/_new/features/whiteboard/types';

const viewport: ViewportTransform = { x: 0, y: 0, scale: 1 };

function renderTool(overrides: Record<string, unknown> = {}) {
  const props = {
    viewport,
    canvasWidth: 1000,
    canvasHeight: 800,
    color: '#ff0000',
    lineWidth: 3,
    onFunctionCreate: vi.fn(),
    onColorChange: vi.fn(),
    onLineWidthChange: vi.fn(),
    onViewportChange: vi.fn(),
    ...overrides,
  };
  const utils = render(<FunctionTool {...props} />);
  return { ...utils, props };
}

function getMainInput(): HTMLInputElement {
  return screen.getByPlaceholderText('np. sin(x), x^2') as HTMLInputElement;
}

describe('FunctionTool - render', () => {
  it('pokazuje pole wyrazenia (z fokusem), suwaki X/Y i wylaczony przycisk dodawania', () => {
    renderTool();
    const input = getMainInput();
    expect(input).toBeInTheDocument();
    expect(document.activeElement).toBe(input);
    expect(screen.getByText('X: ±10')).toBeInTheDocument();
    expect(screen.getByText('Y: ±10')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dodaj funkcję' })).toBeDisabled();
    expect(document.querySelector('svg path')).toBeNull();
  });
});

describe('FunctionTool - tworzenie funkcji', () => {
  it('Enter z poprawnym wyrazeniem wola onFunctionCreate i czysci pole', async () => {
    const user = userEvent.setup();
    const { props } = renderTool();
    const input = getMainInput();

    await user.type(input, ' sin(x) {Enter}');

    expect(props.onFunctionCreate).toHaveBeenCalledTimes(1);
    const created = (props.onFunctionCreate as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as FunctionPlot;
    expect(created).toMatchObject({
      type: 'function',
      expression: 'sin(x)',
      color: '#ff0000',
      strokeWidth: 3,
      xRange: 10,
      yRange: 10,
      strokeDasharray: undefined,
    });
    expect(typeof created.id).toBe('string');
    expect(input.value).toBe('');
  });

  it('linia przerywana i zmieniony zakres X trafiaja do FunctionPlot', async () => {
    const user = userEvent.setup();
    const { props } = renderTool();

    // Najpierw styl i zakres, potem wyrazenie - handleGenerate jest memoizowany
    // po expression, wiec kolejnosc odzwierciedla realne uzycie.
    await user.click(screen.getByTitle('Linia przerywana'));
    const sliders = screen.getAllByRole('slider');
    fireEvent.change(sliders[0], { target: { value: '25' } });
    expect(screen.getByText('X: ±25')).toBeInTheDocument();

    await user.type(getMainInput(), 'x^2');
    await user.click(screen.getByRole('button', { name: 'Dodaj funkcję' }));

    expect(props.onFunctionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ expression: 'x^2', strokeDasharray: '5 5', xRange: 25 })
    );
  });

  it('niepoprawne wyrazenie pokazuje blad i nie wola onFunctionCreate', async () => {
    const user = userEvent.setup();
    const { props } = renderTool();

    await user.type(getMainInput(), 'sin({Enter}');

    expect(props.onFunctionCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/Nieprawidłowe wyrażenie matematyczne/)).toBeInTheDocument();
    expect(getMainInput().value).toBe('sin(');
  });

  it('blad znika po kolejnej edycji pola', async () => {
    const user = userEvent.setup();
    renderTool();

    await user.type(getMainInput(), 'sin({Enter}');
    expect(screen.getByText(/Nieprawidłowe wyrażenie/)).toBeInTheDocument();

    await user.type(getMainInput(), 'x)');
    expect(screen.queryByText(/Nieprawidłowe wyrażenie/)).toBeNull();
  });
});

describe('FunctionTool - live preview', () => {
  it('rysuje sciezke SVG z probek funkcji przeliczonych na ekran', async () => {
    const user = userEvent.setup();
    renderTool();

    await user.type(getMainInput(), 'x^2');

    const path = document.querySelector('svg path') as SVGPathElement;
    expect(path).not.toBeNull();
    expect(path.getAttribute('stroke')).toBe('#ff0000');
    expect(path.getAttribute('stroke-width')).toBe('3');
    expect(path.getAttribute('opacity')).toBe('0.5');
    const d = path.getAttribute('d') ?? '';
    expect(d.startsWith('M ')).toBe(true);
    // Probkowanie co 0.1 od -10; x^2 w zakresie |y| <= 10 zaczyna sie od x = -3.1
    // (y = 9.61). Ekran: sx = x * 100 + 500, sy = -y * 100 + 400.
    const first = d.split(' L ')[0].replace('M ', '').split(' ').map(Number);
    expect(first[0]).toBeCloseTo(500 - 3.1 * 100, 0);
    expect(first[1]).toBeCloseTo(400 - 9.61 * 100, 0);
  });

  it('nie rysuje preview, gdy wyrazenie nie daje co najmniej dwoch punktow', async () => {
    const user = userEvent.setup();
    renderTool();

    await user.type(getMainInput(), 'abc(');

    expect(document.querySelector('svg path')).toBeNull();
  });
});

describe('FunctionTool - modal pomocy', () => {
  it('otwiera sie przyciskiem "?" i zamyka krzyzykiem', async () => {
    const user = userEvent.setup();
    renderTool();

    expect(screen.queryByText(/Narzędzie Function - Przewodnik/)).toBeNull();
    await user.click(screen.getByTitle('Pomoc'));
    expect(screen.getByText(/Narzędzie Function - Przewodnik/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('np. sin(x), x^2, sqrt(x)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '✕' }));
    expect(screen.queryByText(/Narzędzie Function - Przewodnik/)).toBeNull();
  });

  it('dodanie funkcji z modala wola onFunctionCreate i zamyka modal', async () => {
    const user = userEvent.setup();
    const { props } = renderTool();

    await user.click(screen.getByTitle('Pomoc'));
    await user.type(screen.getByPlaceholderText('np. sin(x), x^2, sqrt(x)'), 'cos(x)');
    await user.click(screen.getByRole('button', { name: /Dodaj funkcję do tablicy/ }));

    expect(props.onFunctionCreate).toHaveBeenCalledWith(
      expect.objectContaining({ expression: 'cos(x)' })
    );
    expect(screen.queryByText(/Narzędzie Function - Przewodnik/)).toBeNull();
  });
});

describe('FunctionTool - kolko myszy', () => {
  it('Ctrl+scroll zoomuje, zwykly scroll przesuwa viewport', () => {
    const { props, container } = renderTool();
    const overlay = container.querySelector('.pointer-events-auto.z-30') as HTMLElement;

    fireEvent.wheel(overlay, { deltaY: -100, ctrlKey: true, clientX: 500, clientY: 400 });
    expect(props.onViewportChange).toHaveBeenCalledTimes(1);
    const zoomed = (props.onViewportChange as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as ViewportTransform;
    expect(zoomed.scale).toBeGreaterThan(1);

    fireEvent.wheel(overlay, { deltaX: 0, deltaY: 50 });
    const panned = (props.onViewportChange as ReturnType<typeof vi.fn>).mock
      .calls[1][0] as ViewportTransform;
    expect(panned.scale).toBe(1);
    expect(panned.y).not.toBe(0);
  });

  it('bez onViewportChange kolko nic nie robi', () => {
    const { container } = renderTool({ onViewportChange: undefined });
    const overlay = container.querySelector('.pointer-events-auto.z-30') as HTMLElement;
    expect(() => fireEvent.wheel(overlay, { deltaY: 10 })).not.toThrow();
  });
});
