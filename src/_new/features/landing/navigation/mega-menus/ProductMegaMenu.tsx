'use client';

import Link from 'next/link';
import { LayoutDashboard, LayoutList, Settings, Search, Mic, ThumbsUp, Users } from 'lucide-react';

import MegaMenuFrame from './MegaMenuFrame';
import type { MegaMenuProps } from './types';
import NewsletterSection from './NewsletterSectionProps';

export default function ProductMegaMenu({
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
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-base">Workspace'y</span>
                <span className="text-xs text-gray-500 mt-0.5">
                  Zarządzaj projektami i zespołem
                </span>
              </div>
            </Link>
            <Link
              href="/product#dashboard"
              className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
            >
              <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                <LayoutList className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-base">Tablice Workspace'u</span>
                <span className="text-xs text-gray-500 mt-0.5">
                  Lista wszystkich tablic w projekcie
                </span>
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
              href="/whiteboard#board"
              className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
            >
              <div className="w-6 h-6 bg-purple-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                <LayoutList className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-base">Tablica</span>
                <span className="text-xs text-gray-500 mt-0.5">
                  Interaktywna przestrzeń do nauki
                </span>
              </div>
            </Link>
            <Link
              href="/whiteboard#tools"
              className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
            >
              <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-base">Narzędzia</span>
                <span className="text-xs text-gray-500 mt-0.5">Kalkulator, wykres i więcej</span>
              </div>
            </Link>
            <Link
              href="/whiteboard#smart-search"
              className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
            >
              <div className="w-6 h-6 bg-cyan-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                <Search className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-base">SmartSearch</span>
                <span className="text-xs text-gray-500 mt-0.5">Wyszukiwarka arkuszy i zadań</span>
              </div>
            </Link>
            <Link
              href="/whiteboard#voice-chat"
              className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
            >
              <div className="w-6 h-6 bg-pink-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                <Mic className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-base">VoiceChat</span>
                <span className="text-xs text-gray-500 mt-0.5">Komunikacja głosowa z AI</span>
              </div>
            </Link>
            <Link
              href="/whiteboard#ai-tutor"
              className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
            >
              <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                <ThumbsUp className="w-4 h-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-base">AI Tutor</span>
                <span className="text-xs text-gray-500 mt-0.5">Inteligentny asystent nauki</span>
              </div>
            </Link>
            <Link
              href="/whiteboard#collaboration"
              className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
            >
              <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                <Users className="w-4 h-4 text-white" />
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
      <div className="border-t border-gray-200 mt-8 pt-6" />
      <NewsletterSection
        title="Dołącz do naszej społeczności"
        description="Otrzymuj wiadomości o nowych funkcjach, poradnikach i najlepszych praktykach w edukacji online."
      />
    </MegaMenuFrame>
  );
}
