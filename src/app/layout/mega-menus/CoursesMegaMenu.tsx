'use client';

import Link from 'next/link';
import { GraduationCap, ChevronRight, BadgeCheck } from 'lucide-react';

import MegaMenuFrame from './MegaMenuFrame';
import type { MegaMenuProps } from './types';
import NewsletterSection from './NewsletterSectionProps';

export default function CoursesMegaMenu({
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
        {/* Kolumna 1 - Matematyka */}
        <div className="col-span-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Matematyka
          </h3>
          <div className="space-y-2">
            {/* Matematyka Podstawowa */}
            <Link
              href="/kursy/matematyka/podstawowa"
              className="hover-shine flex items-start gap-3 px-4 py-3 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-lg transition-all group"
            >
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base">Matematyka Podstawowa</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </div>
                <span className="text-xs text-gray-500 mt-1">17 działów | Ponad 300 filmów</span>
              </div>
            </Link>

            {/* Matematyka Rozszerzona */}
            <Link
              href="/kursy/matematyka/rozszerzona"
              className="hover-shine flex items-start gap-3 px-4 py-3 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-lg transition-all group"
            >
              <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <BadgeCheck className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base">Matematyka Rozszerzona</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </div>
                <span className="text-xs text-gray-500 mt-1">17 działów | Ponad 500 filmów</span>
              </div>
            </Link>
          </div>

          {/* Wyróżniony bloczek z informacją */}
          <div className="mt-6 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <BadgeCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">100% Gwarancja satysfakcji</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Tworzone przez korepetytorów z wieloletnim doświadczeniem. Profesjonalne filmy w
                  łatwej i ładnej formie video.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Kolumna 2 - Program Kursów + Gwarancja */}
        <div className="col-span-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Zapoznaj się z programem kursów
          </h3>

          {/* Film YouTube */}
          <div className="bg-gray-100 rounded-xl overflow-hidden shadow-md mb-4">
            <div className="aspect-video flex items-center justify-center border border-dashed border-gray-300 bg-gray-50 rounded-xl">
              <p className="text-sm font-semibold text-gray-600">Film w przygotowaniu</p>
            </div>
          </div>
        </div>
      </div>

      {/* Separator i Newsletter */}
      <div className="border-t border-gray-200 mt-8 pt-6" />
      <NewsletterSection
        title="Bądź na bieżąco z nowościami"
        description="Dowiedz się jako pierwszy o nowych kursach, materiałach i funkcjach platformy."
      />
    </MegaMenuFrame>
  );
}
