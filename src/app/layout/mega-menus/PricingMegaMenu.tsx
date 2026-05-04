'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CircleDollarSign, ChevronRight, X, Check, ArrowRight } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';

import MegaMenuFrame from './MegaMenuFrame';
import type { MegaMenuProps } from './types';
import NewsletterSection from './NewsletterSectionProps';

export default function PricingMegaMenu({
  isOpen,
  onMouseEnter,
  onMouseLeave,
  onClose,
}: MegaMenuProps) {
  const router = useRouter();

  return (
    <MegaMenuFrame
      isOpen={isOpen}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClose={onClose}
    >
      <div className="grid grid-cols-12 gap-8 pt-8">
        {/* Kolumna 1 - Ceny */}
        <div className="col-span-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Ceny
          </h3>

          {/* Link do szczegółowego cennika */}
          <Link
            href="/cennik"
            className="hover-shine flex items-start gap-3 px-4 py-3 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-lg transition-all group mb-5"
          >
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <CircleDollarSign className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base">Cennik - szczegóły</span>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
              <span className="text-xs text-gray-500 mt-1">Zobacz pełną listę funkcji</span>
            </div>
          </Link>

          {/* Film z Historiami użytkowników */}
          <div className="bg-gray-100 rounded-xl overflow-hidden shadow-md">
            <div className="aspect-video flex items-center justify-center border border-dashed border-gray-300 bg-gray-50 rounded-xl">
              <div className="text-center px-4">
                <p className="text-sm font-semibold text-gray-600">Wideo w przygotowaniu</p>
              </div>
            </div>
          </div>
        </div>

        {/* Kolumna 2 - Szybkie porównanie */}
        <div className="col-span-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Szybkie porównanie
          </h3>

          {/* Tabela porównawcza */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: '50%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Funkcja</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Free</th>
                  <th className="text-center px-4 py-3 font-semibold text-indigo-600">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700">Liczba workspace'ów</td>
                  <td className="text-center px-4 py-3 text-gray-600">3</td>
                  <td className="text-center px-4 py-3 font-semibold text-indigo-600">∞</td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700">Liczba tablic</td>
                  <td className="text-center px-4 py-3 text-gray-600">3</td>
                  <td className="text-center px-4 py-3 font-semibold text-indigo-600">∞</td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700">Współpraca realtime</td>
                  <td className="text-center px-4 py-3 text-gray-600">2 osoby</td>
                  <td className="text-center px-4 py-3 font-semibold text-indigo-600"> 15 osób</td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700">Ilość elementów na tablicy</td>
                  <td className="text-center px-4 py-3 text-gray-600">500</td>
                  <td className="text-center px-4 py-3 font-semibold text-indigo-600">∞</td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700">Chat na tablicy</td>
                  <td className="text-center px-4 py-3 text-gray-600">5 pytań</td>
                  <td className="text-center px-4 py-3 font-semibold text-indigo-600">∞</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Kolumna 3 - Zaawansowane funkcje + CTA */}
        <div className="col-span-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            &nbsp;
          </h3>

          {/* Kontynuacja tabeli - zaawansowane narzędzia */}
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-5">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: '50%' }} />
                <col style={{ width: '25%' }} />
                <col style={{ width: '25%' }} />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Zaawansowane</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">Free</th>
                  <th className="text-center px-4 py-3 font-semibold text-indigo-600">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700 h-14">Narzędzia matematyczne</td>
                  <td className="text-center px-4 py-3">
                    <X className="w-5 h-5 text-red-500 mx-auto" />
                  </td>
                  <td className="text-center px-4 py-3 align-middle">
                    <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700 h-14">Rysowanie funkcji</td>
                  <td className="text-center px-4 py-3">
                    <X className="w-5 h-5 text-red-500 mx-auto" />
                  </td>
                  <td className="text-center px-4 py-3 align-middle">
                    <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700 h-14">Kalkulator naukowy</td>
                  <td className="text-center px-4 py-3">
                    <X className="w-5 h-5 text-red-500 mx-auto" />
                  </td>
                  <td className="text-center px-4 py-3 align-middle">
                    <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700 h-14">AI Tutor</td>
                  <td className="text-center px-4 py-3">
                    <X className="w-5 h-5 text-red-500 mx-auto" />
                  </td>
                  <td className="text-center px-4 py-3 align-middle">
                    <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700 h-14">Export do PDF</td>
                  <td className="text-center px-4 py-3">
                    <X className="w-5 h-5 text-red-500 mx-auto" />
                  </td>
                  <td className="text-center px-4 py-3 align-middle">
                    <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* CTA Button */}
          <Button
            variant="dark"
            className="w-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 px-6 py-4 font-semibold"
            leftIcon={<ArrowRight className="w-5 h-5" />}
            onClick={() => router.push('/register?plan=premium')}
          >
            Przejdź na Premium
          </Button>
          <p className="text-center text-xs text-gray-500 mt-3">14 dni okres testowy za darmo</p>
        </div>
      </div>

      {/* Separator i Newsletter */}
      <div className="border-t border-gray-200 mt-8 pt-6" />
      <NewsletterSection
        title="Otrzymuj oferty specjalne"
        description="Darmowe miesiące, zniżki dla nauczycieli i ekskluzywne promocje - tylko dla subskrybentów."
      />
    </MegaMenuFrame>
  );
}
