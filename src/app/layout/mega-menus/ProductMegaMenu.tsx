'use client';

import Link from 'next/link';

import MegaMenuFrame from './MegaMenuFrame';
import type { MegaMenuProps } from './types';

export default function ProductMegaMenu({ 
  isOpen, 
  onMouseEnter, 
  onMouseLeave,
  onClose 
}: MegaMenuProps) {

  return (
    <MegaMenuFrame
      isOpen={isOpen}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClose={onClose}
    >
            <div className="grid grid-cols-12 gap-8 pt-8">
              {/* Kolumna 1 - Dashboard */}
              <div className="col-span-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Dashboard
                </h3>
                <div className="space-y-1">
                  <Link 
                    href="/dashboard" 
                    className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                  >
                    <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-base">Workspace'y</span>
                      <span className="text-xs text-gray-500 mt-0.5">Zarządzaj projektami i zespołem</span>
                    </div>
                  </Link>
                  <Link 
                    href="/tablica" 
                    className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                  >
                    <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-base">Tablice Workspace'u</span>
                      <span className="text-xs text-gray-500 mt-0.5">Lista wszystkich tablic w projekcie</span>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Kolumna 2 - Tutoring Board */}
              <div className="col-span-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Tablica
                </h3>
                <div className="space-y-1">
                  <Link 
                    href="/tablica#board" 
                    className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                  >
                    <div className="w-6 h-6 bg-purple-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-base">Tablica</span>
                      <span className="text-xs text-gray-500 mt-0.5">Interaktywna przestrzeń do nauki</span>
                    </div>
                  </Link>
                  <Link 
                    href="/tablica#tools" 
                    className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                  >
                    <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-base">Narzędzia</span>
                      <span className="text-xs text-gray-500 mt-0.5">Kalkulator, wykres i więcej</span>
                    </div>
                  </Link>
                  <Link 
                    href="/tablica#smart-search" 
                    className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                  >
                    <div className="w-6 h-6 bg-cyan-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-base">SmartSearch</span>
                      <span className="text-xs text-gray-500 mt-0.5">Wyszukiwarka arkuszy i zadań</span>
                    </div>
                  </Link>
                  <Link 
                    href="/tablica#voice-chat" 
                    className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                  >
                    <div className="w-6 h-6 bg-pink-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-base">VoiceChat</span>
                      <span className="text-xs text-gray-500 mt-0.5">Komunikacja głosowa z AI</span>
                    </div>
                  </Link>
                  <Link 
                    href="/tablica#ai-tutor" 
                    className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                  >
                    <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-base">AI Tutor</span>
                      <span className="text-xs text-gray-500 mt-0.5">Inteligentny asystent nauki</span>
                    </div>
                  </Link>
                  <Link 
                    href="/tablica#collaboration" 
                    className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                  >
                    <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-base">Współbieżność</span>
                      <span className="text-xs text-gray-500 mt-0.5">Praca w czasie rzeczywistym</span>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Kolumna 3 - Poradnik */}
              <div className="col-span-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Zapoznaj się z EasyLesson
                </h3>
                <div className="bg-gray-100 rounded-lg overflow-hidden shadow-md">
                  <div className="aspect-video flex items-center justify-center border border-dashed border-gray-300 bg-gray-50 rounded-lg">
                    <div className="text-center px-4">
                      <p className="text-sm font-semibold text-gray-600">Wideo w przygotowaniu</p>
                      
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Separator i Newsletter */}
            <div className="border-t border-gray-200 mt-8 pt-6">
              <div className="grid grid-cols-12 gap-8 items-center">
                <div className="col-span-5">
                  <h3 className="text-2xl font-playfair italic text-gray-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
                    Dołącz do naszej społeczności
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    Otrzymuj wiadomości o nowych funkcjach, poradnikach i najlepszych praktykach w edukacji online.
                  </p>
                </div>
                <div className="col-span-7">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder="Imię"
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="email"
                      placeholder="Adres e-mail"
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button 
                      className="hover-shine hover:cursor-pointer px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors"
                      style={{ backgroundColor: '#212224' }}
                    >
                      Subskrybuj
                    </button>
                  </div>
                  <div className="flex items-start gap-2 mt-3">
                    <input type="checkbox" id="newsletter-privacy" className="mt-0.5 cursor-pointer" />
                    <label htmlFor="newsletter-privacy" className="text-xs text-gray-600 cursor-pointer">
                      Akceptuję <a href="#" className="text-blue-600 hover:underline">politykę prywatności</a> i wyrażam zgodę na otrzymywanie informacji handlowych
                    </label>
                  </div>
                </div>
              </div>
            </div>
    </MegaMenuFrame>
  );
}
