'use client';

/**
 * Mały panel "Wykres funkcji" renderowany przez `renderTopRightUI` Excalidraw.
 * Tryb "dodaj" (brak zaznaczenia) albo "edytuj" (zaznaczony jeden wykres).
 */

import { useEffect, useState } from 'react';
import {
  DEFAULT_FUNCTION_SPEC,
  validateExpression,
  type FunctionSpec,
} from '../math/function-plot';

interface FunctionPanelProps {
  /** Spec zaznaczonego wykresu (tryb edycji) albo null (tryb dodawania). */
  editingSpec: FunctionSpec | null;
  onAdd: (spec: FunctionSpec) => void;
  onUpdate: (spec: FunctionSpec) => void;
}

export function FunctionPanel({ editingSpec, onAdd, onUpdate }: FunctionPanelProps) {
  const [open, setOpen] = useState(false);
  const [spec, setSpec] = useState<FunctionSpec>(DEFAULT_FUNCTION_SPEC);
  const [error, setError] = useState<string | null>(null);

  // Zaznaczenie wykresu wypełnia formularz i otwiera panel
  useEffect(() => {
    if (editingSpec) {
      setSpec(editingSpec);
      setError(null);
      setOpen(true);
    }
  }, [editingSpec]);

  const submit = () => {
    const err = validateExpression(spec.expression);
    setError(err);
    if (err) return;
    const clean = { ...spec, expression: spec.expression.trim() };
    if (editingSpec) onUpdate(clean);
    else onAdd(clean);
  };

  return (
    <div className="flex items-start gap-2" data-testid="function-panel">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
        data-testid="function-panel-toggle"
      >
        f(x)
      </button>
      {open && (
        <div className="w-64 rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-lg">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {editingSpec ? 'Edytuj wykres' : 'Nowy wykres'}
          </div>
          <input
            data-testid="function-expression"
            className={`mb-2 w-full rounded border px-2 py-1 font-mono text-black focus:outline-none ${
              error ? 'border-red-400' : 'border-gray-300 focus:border-blue-500'
            }`}
            placeholder="np. sin(x), x^2"
            value={spec.expression}
            onChange={(e) => {
              setSpec({ ...spec, expression: e.target.value });
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              e.stopPropagation();
            }}
          />
          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          <div className="mb-2 grid grid-cols-2 gap-2">
            <label className="flex flex-col text-xs text-gray-600">
              X: ±{spec.xRange}
              <input
                type="range"
                min={1}
                max={100}
                value={spec.xRange}
                onChange={(e) => setSpec({ ...spec, xRange: Number(e.target.value) })}
              />
            </label>
            <label className="flex flex-col text-xs text-gray-600">
              Y: ±{spec.yRange}
              <input
                type="range"
                min={1}
                max={100}
                value={spec.yRange}
                onChange={(e) => setSpec({ ...spec, yRange: Number(e.target.value) })}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              Kolor
              <input
                type="color"
                value={spec.color}
                onChange={(e) => setSpec({ ...spec, color: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={!!spec.dashed}
                onChange={(e) => setSpec({ ...spec, dashed: e.target.checked })}
              />
              Przerywana
            </label>
          </div>
          <button
            type="button"
            data-testid="function-submit"
            onClick={submit}
            className="w-full rounded bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
          >
            {editingSpec ? 'Zastosuj' : 'Dodaj wykres'}
          </button>
        </div>
      )}
    </div>
  );
}
