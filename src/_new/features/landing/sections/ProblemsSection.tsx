'use client';

import React from 'react';
import { Search, Type, Bot, Zap } from 'lucide-react';

export default function ProblemsSection() {
  const problems = [
    {
      problem: 'Zwykłe tablice są ubogie',
      solution: 'SmartSearch z wzorami matematycznymi',
      icon: Search,
      bgColor: 'bg-yellow-100',
      darkBg: 'bg-yellow-200',
      borderColor: 'border-yellow-300',
      textColor: 'text-yellow-900',
      rotation: '-rotate-2',
    },
    {
      problem: 'Trudno wstawiać wzory',
      solution: 'Automatyczna konwersja do LaTeX',
      icon: Type,
      bgColor: 'bg-blue-100',
      darkBg: 'bg-blue-200',
      borderColor: 'border-blue-300',
      textColor: 'text-blue-900',
      rotation: 'rotate-1',
    },
    {
      problem: 'Brak pomocy AI',
      solution: 'Chat AI rozumie zdjęcia',
      icon: Bot,
      bgColor: 'bg-green-100',
      darkBg: 'bg-green-200',
      borderColor: 'border-green-300',
      textColor: 'text-green-900',
      rotation: 'rotate-2',
    },
    {
      problem: 'Opóźnienia ekranu',
      solution: 'Natychmiastowa współpraca',
      icon: Zap,
      bgColor: 'bg-pink-100',
      darkBg: 'bg-pink-200',
      borderColor: 'border-pink-300',
      textColor: 'text-pink-900',
      rotation: '-rotate-1',
    },
  ];

  return (
    <section className="relative bg-[#ffffff] py-16 md:py-24 overflow-hidden">
      {/* Tło - tylko kropki, mniej intensywne */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage: `radial-gradient(circle, #4b2a2aff 2px, transparent 2px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* LEWE DEKORACJE MATEMATYCZNE */}
      <div className="absolute left-0 top-0 w-full h-full pointer-events-none opacity-40">
        {/* Kontener ograniczający - max-w-7xl + wyśrodkowany */}
        <div className="relative max-w-screen-2xl mx-auto h-full">
          {/* Wzór 1: e^(iπ) + 1 = 0 - ŻÓŁTY */}
          <svg
            className="absolute left-8 top-20 rotate-12"
            width="180"
            height="80"
            viewBox="0 0 180 80"
          >
            <text
              x="10"
              y="40"
              fill="#eab308"
              fontSize="28"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
            >
              e
              <tspan fontSize="18" dy="-10">
                iπ
              </tspan>
              <tspan dy="10"> + 1 = 0</tspan>
            </text>
            <path
              d="M 5 50 Q 90 48 175 52"
              stroke="#eab308"
              strokeWidth="2"
              fill="none"
              strokeDasharray="3 2"
            />
          </svg>

          {/* Wzór 2: Całka - NIEBIESKI */}
          <svg
            className="absolute left-4 top-[35%] -rotate-6"
            width="160"
            height="100"
            viewBox="0 0 160 100"
          >
            <text
              x="10"
              y="50"
              fill="#3b82f6"
              fontSize="32"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
            >
              ∫ f(x)dx
            </text>
            <circle
              cx="80"
              cy="50"
              r="45"
              stroke="#3b82f6"
              strokeWidth="2"
              fill="none"
              strokeDasharray="5 3"
            />
          </svg>

          {/* Wzór 3: Pitagoras - ZIELONY */}
          <svg
            className="absolute left-12 top-[60%] rotate-8"
            width="200"
            height="70"
            viewBox="0 0 200 70"
          >
            <text
              x="10"
              y="35"
              fill="#22c55e"
              fontSize="26"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
            >
              a² + b² = c²
            </text>
            <path d="M 5 45 L 195 48" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
          </svg>

          {/* Wzór 4: Sigma - RÓŻOWY */}
          <svg
            className="absolute left-6 bottom-32 -rotate-12"
            width="140"
            height="90"
            viewBox="0 0 140 90"
          >
            <text
              x="15"
              y="50"
              fill="#ec4899"
              fontSize="40"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
            >
              Σ n²
            </text>
            <rect
              x="5"
              y="10"
              width="130"
              height="70"
              stroke="#ec4899"
              strokeWidth="2"
              fill="none"
              rx="8"
              strokeDasharray="8 4"
            />
          </svg>
        </div>
      </div>

      {/* PRAWE DEKORACJE MATEMATYCZNE */}
      <div className="absolute right-0 top-0 w-full h-full pointer-events-none opacity-40">
        {/* Kontener ograniczający - max-w-7xl + wyśrodkowany */}
        <div className="relative max-w-screen-2xl mx-auto h-full">
          {/* Wzór 5: sin/cos - FIOLETOWY */}
          <svg
            className="absolute right-8 top-24 -rotate-8"
            width="170"
            height="90"
            viewBox="0 0 170 90"
          >
            <text
              x="10"
              y="45"
              fill="#a855f7"
              fontSize="28"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
            >
              sin²x + cos²x
            </text>
            <path d="M 10 60 Q 85 55 160 62" stroke="#a855f7" strokeWidth="2" fill="none" />
          </svg>

          {/* Wzór 6: Funkcja kwadratowa - POMARAŃCZOWY */}
          <svg
            className="absolute right-12 top-[38%] rotate-10"
            width="200"
            height="85"
            viewBox="0 0 200 85"
          >
            <text
              x="10"
              y="40"
              fill="#f97316"
              fontSize="26"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
            >
              f(x) = ax² + bx + c
            </text>
            <ellipse
              cx="100"
              cy="42"
              rx="95"
              ry="38"
              stroke="#f97316"
              strokeWidth="2"
              fill="none"
              strokeDasharray="6 3"
            />
          </svg>

          {/* Wzór 7: Pi i nieskończoność - TURKUSOWY */}
          <svg
            className="absolute right-6 top-[62%] -rotate-5"
            width="150"
            height="80"
            viewBox="0 0 150 80"
          >
            <text
              x="15"
              y="45"
              fill="#14b8a6"
              fontSize="36"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
            >
              π ≈ 3.14...
            </text>
            <path
              d="M 5 55 L 145 58"
              stroke="#14b8a6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="4 2"
            />
          </svg>

          {/* Wzór 8: Pierwiastek - CZERWONY */}
          <svg
            className="absolute right-10 bottom-28 rotate-12"
            width="180"
            height="75"
            viewBox="0 0 180 75"
          >
            <text
              x="10"
              y="40"
              fill="#ef4444"
              fontSize="30"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
            >
              √(x² + y²)
            </text>
            <circle cx="90" cy="38" r="35" stroke="#ef4444" strokeWidth="2" fill="none" />
          </svg>
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Nagłówek - wyśrodkowany, mniejszy */}
        <div className="text-center mb-16">
          {/* Tytuł - mniejszy niż w hero */}
          <div className="inline-block relative mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
              Tradycyjne korepetycje online?
              <br />
              <span className="relative inline-block mt-2">
                TO KOSZMAR
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  height="12"
                  viewBox="0 0 300 12"
                  fill="none"
                >
                  <path
                    d="M5 8C60 5 120 10 180 6C240 8 270 5 295 7"
                    stroke="#dc2626"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h2>
          </div>

          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Ale my to naprawiamy! Zobacz co oferujemy.
          </p>
        </div>

        {/* Karteczki samoprzylepne */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto mb-16">
          {problems.map((item, index) => {
            const Icon = item.icon;

            return (
              <div
                key={index}
                className={`group relative ${item.rotation} hover:rotate-0 transition-all duration-300 hover:scale-105`}
              >
                <div
                  className={`relative ${item.bgColor} p-8 rounded-xl border-3 ${item.borderColor} shadow-xl`}
                >
                  {/* Taśma na górze */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-amber-200/70 rounded-sm border border-amber-300/50" />

                  {/* Problem */}
                  <div className="mb-0 text-center">
                    <h3
                      className={`text-xl md:text-2xl font-bold ${item.textColor} leading-tight mb-4`}
                    >
                      {item.problem}
                    </h3>

                    <svg width="50" height="50" viewBox="0 0 50 50" className="mx-auto">
                      <path
                        d="M10 10 L40 40 M40 10 L10 40"
                        stroke="#dc2626"
                        strokeWidth="6"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  {/* Separator */}
                  <div className="mt-6">
                    <svg width="100%" height="20" viewBox="0 0 300 20" preserveAspectRatio="none">
                      <path
                        d="M0 10 Q75 8 150 10 T300 10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray="8 4"
                        fill="none"
                        className="opacity-30"
                      />
                    </svg>
                  </div>

                  {/* Rozwiązanie */}
                  <div
                    className={`${item.darkBg} p-6 rounded-lg border-2 ${item.borderColor} relative`}
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <div
                        className={`w-12 h-12 ${item.darkBg} rounded-full flex items-center justify-center border-2 ${item.borderColor}`}
                      >
                        <Icon className={`w-6 h-6 ${item.textColor}`} strokeWidth={2.5} />
                      </div>

                      <svg width="40" height="40" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="18" fill="#22c55e" opacity="0.2" />
                        <path
                          d="M10 20 L17 27 L30 13"
                          stroke="#22c55e"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    </div>

                    <p
                      className={`text-base md:text-lg font-semibold ${item.textColor} leading-snug`}
                    >
                      {item.solution}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-xl text-gray-700 mb-6 font-medium">Brzmi dobrze? Przekonaj się sam!</p>

          <a href="#hero" className="inline-block relative group">
            <div className="absolute -inset-1 bg-green-400 rounded-xl opacity-50 group-hover:opacity-70 blur transition-opacity" />
            <span className="relative bg-green-400 hover:bg-green-500 text-gray-900 text-lg font-bold px-10 py-4 rounded-xl block transition-all shadow-lg group-hover:shadow-xl">
              Wypróbuj za darmo →
            </span>
          </a>
        </div>
      </div>

      {/* Fala na dole - przejście do białej sekcji */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 100" fill="none" className="w-full">
          <path
            d="M0,50 C240,70 480,70 720,60 C960,50 1200,30 1440,40 L1440,100 L0,100 Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}
