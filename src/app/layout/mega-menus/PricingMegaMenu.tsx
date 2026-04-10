'use client';

import Link from 'next/link';

import MegaMenuFrame from './MegaMenuFrame';
import type { MegaMenuProps } from './types';

export default function PricingMegaMenu({
  isOpen,
  onMouseEnter,
  onMouseLeave,
  onClose,
}: MegaMenuProps) {
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
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Ceny</h3>

          {/* Link do szczegółowego cennika */}
          <Link
            href="/cennik"
            className="hover-shine flex items-start gap-3 px-4 py-3 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-lg transition-all group mb-5"
          >
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex flex-col flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base">Cennik - szczegóły</span>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
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
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Szybkie porównanie</h3>

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
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">&nbsp;</h3>

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
                    <svg className="w-5 h-5 text-red-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </td>
                  <td className="text-center px-4 py-3 align-middle">
                    <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700 h-14">Rysowanie funkcji</td>
                  <td className="text-center px-4 py-3">
                    <svg className="w-5 h-5 text-red-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </td>
                  <td className="text-center px-4 py-3 align-middle">
                    <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700 h-14">Kalkulator naukowy</td>
                  <td className="text-center px-4 py-3">
                    <svg className="w-5 h-5 text-red-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </td>
                  <td className="text-center px-4 py-3 align-middle">
                    <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700 h-14">AI Tutor</td>
                  <td className="text-center px-4 py-3">
                    <svg className="w-5 h-5 text-red-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </td>
                  <td className="text-center px-4 py-3 align-middle">
                    <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 transition-colors h-14">
                  <td className="px-4 py-3 text-gray-700 h-14">Export do PDF</td>
                  <td className="text-center px-4 py-3">
                    <svg className="w-5 h-5 text-red-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </td>
                  <td className="text-center px-4 py-3 align-middle">
                    <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* CTA Button */}
          <Link href="/rejestracja?plan=premium">
            <button
              className="hover-shine hover:cursor-pointer w-full flex items-center justify-center gap-2 px-6 py-4 text-white hover:text-white transition-all text-base font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              style={{ backgroundColor: '#212224' }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
              </svg>
              Przejdź na Premium
            </button>
          </Link>
          <p className="text-center text-xs text-gray-500 mt-3">14 dni okres testowy za darmo</p>
        </div>
      </div>

      {/* Separator i Newsletter */}
      <div className="border-t border-gray-200 mt-8 pt-6">
        <div className="grid grid-cols-12 gap-8 items-center">
          <div className="col-span-5">
            <h3 className="text-2xl font-playfair italic text-gray-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
              Otrzymuj oferty specjalne
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Darmowe miesiące, zniżki dla nauczycieli i ekskluzywne promocje - tylko dla subskrybentów.
            </p>
          </div>
          <div className="col-span-7">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Imię"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <input
                type="email"
                placeholder="Adres e-mail"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <button
                className="hover-shine hover:cursor-pointer px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors"
                style={{ backgroundColor: '#212224' }}
              >
                Subskrybuj
              </button>
            </div>
            <div className="flex items-start gap-2 mt-3">
              <input type="checkbox" id="pricing-newsletter-privacy" className="mt-0.5 cursor-pointer" />
              <label htmlFor="pricing-newsletter-privacy" className="text-xs text-gray-600 cursor-pointer">
                Akceptuję <a href="#" className="text-blue-600 hover:underline">politykę prywatności</a> i wyrażam zgodę na otrzymywanie informacji handlowych
              </label>
            </div>
          </div>
        </div>
      </div>
    </MegaMenuFrame>
  );
}
