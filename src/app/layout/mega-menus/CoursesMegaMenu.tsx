'use client';

import Link from 'next/link';

import MegaMenuFrame from './MegaMenuFrame';
import type { MegaMenuProps } from './types';

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
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Matematyka</h3>
          <div className="space-y-2">
            {/* Matematyka Podstawowa */}
            <Link
              href="/kursy/matematyka/podstawowa"
              className="hover-shine flex items-start gap-3 px-4 py-3 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-lg transition-all group"
            >
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                </svg>
              </div>
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base">Matematyka Podstawowa</span>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
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
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-base">Matematyka Rozszerzona</span>
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-xs text-gray-500 mt-1">17 działów | Ponad 500 filmów</span>
              </div>
            </Link>
          </div>

          {/* Wyróżniony bloczek z informacją */}
          <div className="mt-6 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">100% Gwarancja satysfakcji</h4>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Tworzone przez korepetytorów z wieloletnim doświadczeniem. Profesjonalne filmy w łatwej i ładnej formie video.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Kolumna 2 - Program Kursów + Gwarancja */}
        <div className="col-span-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Zapoznaj się z programem kursów</h3>

          {/* Film YouTube */}
          <div className="bg-gray-100 rounded-xl overflow-hidden shadow-md mb-4">
            <div className="aspect-video flex items-center justify-center border border-dashed border-gray-300 bg-gray-50 rounded-xl">
              <p className="text-sm font-semibold text-gray-600">Film w przygotowaniu</p>
            </div>
          </div>
        </div>
      </div>

      {/* Separator i Newsletter */}
      <div className="border-t border-gray-200 mt-8 pt-6">
        <div className="grid grid-cols-12 gap-8 items-center">
          <div className="col-span-5">
            <h3 className="text-2xl font-playfair italic text-gray-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
              Bądź na bieżąco z nowościami
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Dowiedz się jako pierwszy o nowych kursach, materiałach i funkcjach platformy.
            </p>
          </div>
          <div className="col-span-7">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Imię"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <input
                type="email"
                placeholder="Adres e-mail"
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                className="hover-shine hover:cursor-pointer px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors"
                style={{ backgroundColor: '#212224' }}
              >
                Subskrybuj
              </button>
            </div>
            <div className="flex items-start gap-2 mt-3">
              <input type="checkbox" id="courses-newsletter-privacy" className="mt-0.5 cursor-pointer" />
              <label htmlFor="courses-newsletter-privacy" className="text-xs text-gray-600 cursor-pointer">
                Akceptuję <a href="#" className="text-blue-600 hover:underline">politykę prywatności</a> i wyrażam zgodę na otrzymywanie informacji handlowych
              </label>
            </div>
          </div>
        </div>
      </div>
    </MegaMenuFrame>
  );
}
