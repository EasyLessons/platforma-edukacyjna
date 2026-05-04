'use client';

import Link from 'next/link';
import { Newspaper, ChevronRight } from 'lucide-react';

import MegaMenuFrame from './MegaMenuFrame';
import type { MegaMenuProps } from './types';
import NewsletterSection from './NewsletterSectionProps';

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
            <Newspaper className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Aktualności EasyLesson
            </h2>
            <p className="text-sm text-gray-500">Najnowsze funkcje i aktualizacje platformy</p>
          </div>
        </div>
        <Link
          href="/news"
          className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium text-sm group"
        >
          Zobacz wszystkie aktualności
          <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Grid z 3 artykułami */}
      <div className="grid grid-cols-3 gap-6">
        {/* Artykuł 1 */}
        <Link
          href="/news/nowe-narzedzia-matematyczne"
          className="parallax-container group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-200"
        >
          <div className="aspect-video relative overflow-hidden">
            <img
              src="/resources/news/Nowosc.jpg"
              alt="Nowe narzędzia matematyczne"
              className="parallax-image w-full h-full object-cover"
            />
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                Nowe funkcje
              </span>
              <span className="text-xs text-gray-500">2 dni temu</span>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">
              Zaawansowane narzędzia matematyczne
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2">
              Dodaliśmy nowy kalkulator naukowy, rysowanie funkcji matematycznych i zaawansowany
              edytor równań. Idealne dla nauczycieli matematyki!
            </p>
          </div>
        </Link>

        {/* Artykuł 2 */}
        <Link
          href="/news/ai-tutor-ulepszenia"
          className="parallax-container group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-200"
        >
          <div className="aspect-video relative overflow-hidden">
            <img
              src="/resources/news/Nauczyciel.jpg"
              alt="AI Tutor - lepsze odpowiedzi"
              className="parallax-image w-full h-full object-cover"
            />
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                AI
              </span>
              <span className="text-xs text-gray-500">5 dni temu</span>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">
              AI Tutor - lepsze odpowiedzi i kontekst
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2">
              Ulepszyliśmy algorytm AI Tutora! Teraz jeszcze lepiej rozumie kontekst pytań i udziela
              bardziej szczegółowych odpowiedzi.
            </p>
          </div>
        </Link>

        {/* Artykuł 3 */}
        <Link
          href="/news/wspolpraca-realtime"
          className="parallax-container group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-200"
        >
          <div className="aspect-video relative overflow-hidden">
            <img
              src="/resources/news/Wspolbieznosc.jpg"
              alt="Współpraca w czasie rzeczywistym"
              className="parallax-image w-full h-full object-cover"
            />
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                Współpraca
              </span>
              <span className="text-xs text-gray-500">1 tydzień temu</span>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">
              Współpraca w czasie rzeczywistym do 50 osób
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2">
              Zwiększyliśmy limit współpracy realtime! Teraz w planie Premium do 50 osób może
              pracować jednocześnie na tablicy.
            </p>
          </div>
        </Link>
      </div>

      {/* Separator i Newsletter */}
      <div className="border-t border-gray-200 mt-8 pt-6" />
      <NewsletterSection
        title="Nie przegap żadnej nowości"
        description="Najświeższe aktualizacje, nowe funkcje i case studies od naszej społeczności edukatorów."
      />
    </MegaMenuFrame>
  );
}
