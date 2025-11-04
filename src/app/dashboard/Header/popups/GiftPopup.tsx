'use client';

import { useState } from 'react';
import { Gift, Copy, Check, X, Info, UserPlus, Crown } from 'lucide-react';

interface GiftPopupProps {
  onClose: () => void;
}

export default function GiftPopup({ onClose }: GiftPopupProps) {
  const [copied, setCopied] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const referralLink = "https://easylesson.com/ref/mateusz123";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/15 backdrop-blur-sm flex items-center justify-center z-[100] px-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-5 border-b border-green-100 flex items-start justify-between rounded-t-2xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Gift size={24} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">
                Dostań 10% zniżki
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Na konto Premium
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-green-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          
          {/* Opis */}
          <div className="text-center">
            <p className="text-gray-700 leading-relaxed">
              Zapraszaj nowe osoby na <strong className="text-green-600">EasyLesson</strong> i otrzymaj{' '}
              <strong className="text-green-600">10% zniżki</strong> na konto Premium!
            </p>
          </div>

          {/* Jak to działa */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 text-blue-700 font-medium">
              <Info size={18} />
              <span>Jak to działa?</span>
            </div>
            <span className="text-blue-400 text-xl">{showInfo ? '−' : '+'}</span>
          </button>

          {/* 3 kroki */}
          {showInfo && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
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
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
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
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
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
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-mono cursor-pointer"
                onClick={(e) => e.currentTarget.select()}
              />
              
              <button
                onClick={handleCopy}
                className="px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shadow-sm hover:shadow-md"
              >
                {copied ? (
                  <>
                    <Check size={18} />
                    <span className="hidden sm:inline">Skopiowano!</span>
                  </>
                ) : (
                  <>
                    <Copy size={18} />
                    <span className="hidden sm:inline">Kopiuj</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Statystyki */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Twoje postępy:</span>
              <Crown size={16} className="text-green-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-green-600">0</span>
              <span className="text-sm text-gray-600">zaproszeń wysłanych</span>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Zaproś 10 osób = 100% zniżka na pierwszy miesiąc Premium! 🎉
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleCopy}
            className="w-full px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
          >
            <UserPlus size={18} />
            <span>Zaproś znajomych teraz</span>
          </button>
        </div>
      </div>
    </div>
  );
}