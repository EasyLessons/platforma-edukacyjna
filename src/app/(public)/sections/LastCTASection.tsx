'use client';

import React from 'react';
import Link from 'next/link';

export default function LastCTASection() {
  return (
    <section className="relative bg-gradient-to-br from-green-400 via-green-500 to-green-600 py-20 px-4 overflow-hidden">
      {/* Dekoracyjne kropki */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle, #ffffff 2px, transparent 2px)`,
          backgroundSize: '30px 30px',
        }}
      />

      {/* Dekoracyjne elementy matematyczne */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="relative max-w-screen-2xl mx-auto h-full">
          {/* Wzory po bokach */}
          <svg
            className="absolute left-[5%] top-[20%] rotate-12"
            width="100"
            height="60"
            viewBox="0 0 100 60"
          >
            <text x="10" y="35" fill="white" fontSize="24" fontFamily="system-ui" fontWeight="600">
              √(x+y)
            </text>
          </svg>

          <svg
            className="absolute right-[8%] top-[25%] -rotate-12"
            width="120"
            height="70"
            viewBox="0 0 120 70"
          >
            <text x="10" y="40" fill="white" fontSize="28" fontFamily="system-ui" fontWeight="600">
              ∫ f(x)dx
            </text>
          </svg>

          <svg
            className="absolute left-[10%] bottom-[25%] -rotate-6"
            width="90"
            height="60"
            viewBox="0 0 90 60"
          >
            <text x="10" y="35" fill="white" fontSize="22" fontFamily="system-ui" fontWeight="600">
              a² + b²
            </text>
          </svg>

          <svg
            className="absolute right-[12%] bottom-[30%] rotate-8"
            width="110"
            height="65"
            viewBox="0 0 110 65"
          >
            <text x="10" y="38" fill="white" fontSize="26" fontFamily="system-ui" fontWeight="600">
              π × r²
            </text>
          </svg>

          {/* Gwiazdki */}
          <div className="absolute left-[20%] top-[15%]">
            <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
              <path
                d="M25 5 L28 18 L40 18 L30 25 L33 38 L25 31 L17 38 L20 25 L10 18 L22 18 Z"
                fill="white"
                opacity="0.3"
              />
            </svg>
          </div>

          <div className="absolute right-[18%] bottom-[20%]">
            <svg width="45" height="45" viewBox="0 0 45 45" fill="none">
              <path
                d="M22.5 5 L25 16 L36 16 L27 22 L29.5 33 L22.5 27 L15.5 33 L18 22 L9 16 L20 16 Z"
                fill="white"
                opacity="0.3"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* GŁÓWNA ZAWARTOŚĆ */}
      <div className="relative max-w-4xl mx-auto text-center z-10">
        {/* Główny tytuł */}
        <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
          Gotowy na lepsze korepetycje?
        </h2>

        {/* Podtytuł */}
        <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
          Dołącz do <span className="font-bold text-white">1,200+ korepetytorów</span> którzy już
          uczą lepiej
        </p>

        {/* Główny przycisk CTA */}
        <div className="mb-6">
          <Link href="/register">
            <button className="group relative bg-white hover:bg-gray-50 text-green-600 font-black text-xl md:text-2xl px-12 py-6 rounded-2xl shadow-2xl transition-all duration-300 transform hover:scale-105">
              {/* Rysowany kontur */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <rect
                  x="4"
                  y="4"
                  width="calc(100% - 8px)"
                  height="calc(100% - 8px)"
                  rx="16"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="4"
                />
              </svg>

              <span className="relative z-10 flex items-center justify-center gap-3">
                Wypróbuj za darmo - bez karty
                <svg
                  className="w-6 h-6 group-hover:translate-x-2 transition-transform"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </span>
            </button>
          </Link>
        </div>

        {/* Mały tekst pod przyciskiem */}
        <p className="text-white/80 text-sm md:text-base">⚡ Założenie konta zajmuje 30 sekund</p>

        {/* Dodatkowe benefity */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="flex flex-col items-center gap-2">
            <div className="text-4xl">✅</div>
            <p className="text-white font-semibold">Bez karty kredytowej</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="text-4xl">🚀</div>
            <p className="text-white font-semibold">Gotowe w 30 sekund</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="text-4xl">🎉</div>
            <p className="text-white font-semibold">Anuluj kiedy chcesz</p>
          </div>
        </div>

        {/* Social proof mini */}
        <div className="mt-12 flex items-center justify-center gap-3">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full bg-white border-3 border-green-500 flex items-center justify-center text-green-600 font-bold"
              >
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <p className="text-white font-semibold">i 1,200+ innych już z nami!</p>
        </div>
      </div>

      {/* Falka na dole (opcjonalnie) */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0,30 C240,45 480,45 720,35 C960,25 1200,20 1440,25 L1440,60 L0,60 Z"
            fill="white"
            fillOpacity="0.1"
          />
        </svg>
      </div>
    </section>
  );
}
