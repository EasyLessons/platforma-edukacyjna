/**
 * UPGRADE MODAL — „Przejdź na Premium"
 *
 * Bez płatności (Stripe później): tekst, lista korzyści, przycisk zamknij
 * i opcjonalny link zainteresowania (NEXT_PUBLIC_PREMIUM_INTEREST_URL —
 * mailto: albo formularz; gdy brak zmiennej, przycisk się nie renderuje).
 *
 * Otwierany, gdy API zwróci 403 z kodem PLAN_LIMIT_* (patrz utils/plan-limit-error.ts)
 * albo gdy tablica jest w trybie tylko do odczytu (PLAN_LIMIT_ELEMENTS).
 *
 * Style są samowystarczalne (Tailwind), bo modal pojawia się zarówno w dashboardzie,
 * jak i na stronie tablicy — nie polega na klasach `dashboard-modal-*`.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Sparkles, X } from 'lucide-react';
import { useModal } from '@/_new/shared/hooks/use-modal';
import type { PlanLimitCode } from '../types';

const REASON_TEXT: Record<PlanLimitCode, string> = {
  PLAN_LIMIT_WORKSPACES: 'Osiągnąłeś limit własnych workspace’ów w planie Free.',
  PLAN_LIMIT_BOARDS: 'Osiągnąłeś limit tablic w planie Free.',
  PLAN_LIMIT_ELEMENTS:
    'Ta tablica przekroczyła limit elementów planu Free i jest teraz tylko do odczytu.',
};

const BENEFITS = [
  'Nielimitowana liczba workspace’ów',
  'Nielimitowana liczba tablic',
  'Tablice bez limitu elementów',
  'Pierwszeństwo w dostępie do nowych funkcji AI',
];

const PREMIUM_INTEREST_URL = process.env.NEXT_PUBLIC_PREMIUM_INTEREST_URL;

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: PlanLimitCode | null;
}

export function UpgradeModal({ isOpen, onClose, reason }: UpgradeModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useModal({ isOpen, onClose, modalRef, focusRef: closeRef });

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <Sparkles size={18} />
            </span>
            <h2 id="upgrade-modal-title" className="text-xl font-bold text-gray-900">
              Przejdź na Premium
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij okno"
            className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        {reason && <p className="mb-4 text-sm text-gray-700">{REASON_TEXT[reason]}</p>}

        <p className="mb-3 text-sm text-gray-600">Premium odblokowuje:</p>
        <ul className="mb-6 space-y-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2 text-sm text-gray-800">
              <Check size={16} className="shrink-0 text-green-600" />
              {benefit}
            </li>
          ))}
        </ul>

        <p className="mb-5 text-xs text-gray-500">
          Płatności jeszcze nie ma — Premium nadajemy ręcznie. Daj znać, jeśli chcesz z niego
          korzystać.
        </p>

        <div className="flex justify-end gap-2">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Zamknij
          </button>
          {PREMIUM_INTEREST_URL && (
            <a
              href={PREMIUM_INTEREST_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Chcę Premium
            </a>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
