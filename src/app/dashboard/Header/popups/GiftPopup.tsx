'use client';

import { useState } from 'react';
import { Gift, Copy, Check, X, Info, UserPlus, Crown } from 'lucide-react';
import { DashboardButton } from '@/app/dashboard/Components/DashboardButton';

interface GiftPopupProps {
  onClose: () => void;
}

export default function GiftPopup({ onClose }: GiftPopupProps) {
  const [copied, setCopied] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const referralLink = 'https://easylesson.com/ref/mateusz123';

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="dashboard-modal-overlay"
      onClick={onClose}
    >
      <div
        className="dashboard-modal-surface max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="dashboard-modal-header">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-[var(--dash-hover)] p-2">
              <Gift size={22} className="text-gray-700" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Dostań 10% zniżki</h2>
              <p className="mt-1 text-sm text-gray-600">Na konto Premium</p>
            </div>
          </div>
          <DashboardButton variant="secondary" onClick={onClose} className="h-9 w-9 rounded-full p-0">
            <X size={20} />
          </DashboardButton>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Opis */}
          <div className="text-center">
            <p className="text-gray-700 leading-relaxed">
              Zapraszaj nowe osoby na <strong className="text-gray-900">EasyLesson</strong> i
              otrzymaj <strong className="text-gray-900">10% zniżki</strong> na konto Premium.
            </p>
          </div>

          {/* Jak to działa */}
          <DashboardButton
            variant="secondary"
            rightIcon={<Info size={18} />}
            leftIcon={showInfo ? '−' : '+'}
            onClick={() => setShowInfo(!showInfo)}
            className="w-full items-center justify-between border border-[var(--dash-border)]"
          >
            Jak to działa?
          </DashboardButton>

          {/* 3 kroki */}
          {showInfo && (
            <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-panel)] p-4 space-y-3">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#212224] text-sm font-bold text-white">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Skopiuj swój link</h4>
                  <p className="text-sm text-gray-600">
                    Użyj swojego unikalnego linku zaproszenia poniżej
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#212224] text-sm font-bold text-white">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Udostępnij znajomym</h4>
                  <p className="text-sm text-gray-600">
                    Wyślij link mailiem, na czacie lub mediach społecznościowych
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#212224] text-sm font-bold text-white">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 mb-1">Otrzymaj zniżkę</h4>
                  <p className="text-sm text-gray-600">
                    Za każdą osobę która się zarejestruje, dostajesz 10% rabatu!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Twój link zaproszenia:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={referralLink}
                readOnly
                className="flex-1 cursor-pointer rounded-lg border border-[var(--dash-border)] bg-[var(--dash-panel)] px-4 py-3 font-mono text-sm text-gray-700"
                onClick={(e) => e.currentTarget.select()}
              />

              <DashboardButton
                variant="primary"
                leftIcon={copied ? <Check size={18} /> : <Copy size={18} />}
                onClick={handleCopy}
              >
                {copied ? 
                    <span className="hidden sm:inline">Skopiowano!</span>
                 : <span className="hidden sm:inline">Kopiuj</span>
                }
              </DashboardButton>
            </div>
          </div>

          {/* Statystyki */}
          <div className="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-panel)] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Twoje postępy:</span>
              <Crown size={16} className="text-gray-700" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">0</span>
              <span className="text-sm text-gray-600">zaproszeń wysłanych</span>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Zaproś 10 osób = 100% zniżka na pierwszy miesiąc Premium! 🎉
            </div>
          </div>

          {/* CTA */}
          <DashboardButton
            variant="primary"
            leftIcon={<UserPlus size={18} />}
            onClick={handleCopy}
            className="w-full"
          >
            <span>Zaproś znajomych teraz</span>
          </DashboardButton>
        </div>
      </div>
    </div>
  );
}
