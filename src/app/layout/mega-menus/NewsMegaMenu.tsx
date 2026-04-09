'use client';

import Link from 'next/link';

import MegaMenuFrame from './MegaMenuFrame';
import type { MegaMenuProps } from './types';

export default function NewsMegaMenu({
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
      {/* Header z przyciskiem */}
      <div className="flex items-center justify-between mb-6 pt-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
              <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Aktualności EasyLesson</h2>
            <p className="text-sm text-gray-500">Najnowsze funkcje i aktualizacje platformy</p>
          </div>
        </div>
        <Link
          href="/aktualnosci"
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium text-sm group"
        >
          Zobacz wszystkie aktualności
          <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>

      {/* Grid z 3 artykułami */}
      <div className="grid grid-cols-3 gap-6">
        {/* Artykuł 1 */}
        <Link
          href="/aktualnosci/nowe-narzedzia-matematyczne"
          className="parallax-container group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-200"
         
        >
          <div className="aspect-video relative overflow-hidden">
            <img
              src="/resources/Aktualnosci/Nowosc.jpg"
              alt="Nowe narzędzia matematyczne"
              className="parallax-image w-full h-full object-cover"
            />
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">Nowe funkcje</span>
              <span className="text-xs text-gray-500">2 dni temu</span>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">
              Zaawansowane narzędzia matematyczne
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2">
              Dodaliśmy nowy kalkulator naukowy, rysowanie funkcji matematycznych i zaawansowany edytor równań. Idealne dla nauczycieli matematyki!
            </p>
          </div>
        </Link>

        {/* Artykuł 2 */}
        <Link
          href="/aktualnosci/ai-tutor-ulepszenia"
          className="parallax-container group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-200"
         
        >
          <div className="aspect-video relative overflow-hidden">
            <img
              src="/resources/Aktualnosci/Nauczyciel.jpg"
              alt="AI Tutor - lepsze odpowiedzi"
              className="parallax-image w-full h-full object-cover"
            />
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded">AI</span>
              <span className="text-xs text-gray-500">5 dni temu</span>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">
              AI Tutor - lepsze odpowiedzi i kontekst
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2">
              Ulepszyliśmy algorytm AI Tutora! Teraz jeszcze lepiej rozumie kontekst pytań i udziela bardziej szczegółowych odpowiedzi.
            </p>
          </div>
        </Link>

        {/* Artykuł 3 */}
        <Link
          href="/aktualnosci/wspolpraca-realtime"
          className="parallax-container group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-200"
         
        >
          <div className="aspect-video relative overflow-hidden">
            <img
              src="/resources/Aktualnosci/Wspolbieznosc.jpg"
              alt="Współpraca w czasie rzeczywistym"
              className="parallax-image w-full h-full object-cover"
            />
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">Współpraca</span>
              <span className="text-xs text-gray-500">1 tydzień temu</span>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">
              Współpraca w czasie rzeczywistym do 50 osób
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2">
              Zwiększyliśmy limit współpracy realtime! Teraz w planie Premium do 50 osób może pracować jednocześnie na tablicy.
            </p>
          </div>
        </Link>
      </div>

      {/* Separator i Newsletter */}
      <div className="border-t border-gray-200 mt-8 pt-6">
        <div className="grid grid-cols-12 gap-8 items-center">
          <div className="col-span-5">
            <h3 className="text-2xl font-playfair italic text-gray-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
              Nie przegap żadnej nowości
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Najświeższe aktualizacje, nowe funkcje i case studies od naszej społeczności edukatorów.
            </p>
          </div>
          <div className="col-span-7">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Imię"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <input
                type="email"
                placeholder="Adres e-mail"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <button
                className="hover-shine hover:cursor-pointer px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors"
                style={{ backgroundColor: '#212224' }}
              >
                Subskrybuj
              </button>
            </div>
            <div className="flex items-start gap-2 mt-3">
              <input type="checkbox" id="news-newsletter-privacy" className="mt-0.5 cursor-pointer" />
              <label htmlFor="news-newsletter-privacy" className="text-xs text-gray-600 cursor-pointer">
                Akceptuję <a href="#" className="text-blue-600 hover:underline">politykę prywatności</a> i wyrażam zgodę na otrzymywanie informacji handlowych
              </label>
            </div>
          </div>
        </div>
      </div>
    </MegaMenuFrame>
  );
}
