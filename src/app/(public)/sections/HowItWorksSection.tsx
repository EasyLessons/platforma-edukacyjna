'use client';

import React from 'react';

interface Step {
  number: number;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    number: 1,
    title: 'Utwórz tablicę',
    description: 'Rejestracja zajmuje 30 sekund',
  },
  {
    number: 2,
    title: 'Zaproś ucznia',
    description: 'Wyślij link - uczeń dołącza bez rejestracji',
  },
  {
    number: 3,
    title: 'Uczcie się razem',
    description: 'Tablica + AI + wzory = sukces',
  },
];

export default function HowItWorksSection() {
  return (
    <section className="relative bg-[#f5f3ef] overflow-hidden py-20 px-4">
      {/* SIATKA KROPEK W TLE - JAK W HERO */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: `radial-gradient(circle, #c4bfb5 1.5px, transparent 1.5px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* GŁÓWNA ZAWARTOŚĆ */}
      <div className="relative max-w-5xl mx-auto z-10">
        {/* TYTUŁ SEKCJI */}
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Zacznij uczyć w{' '}
            <span className="relative inline-block">
              3 krokach
              {/* Ręcznie rysowana kreska pod tekstem */}
              <svg
                className="absolute -bottom-2 left-0 w-full"
                height="12"
                viewBox="0 0 200 12"
                fill="none"
              >
                <path
                  d="M2 8C50 4 100 3 150 6C170 7 190 5 198 7"
                  stroke="#4ade80"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mt-6">
            To naprawdę takie proste! Nie musisz być programistą 😊
          </p>
        </div>

        {/* KROKI */}
        <div className="space-y-16 md:space-y-20">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Strzałka łącząca do następnego kroku (WYŻEJ) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute left-1/2 -translate-x-1/2 -bottom-20 z-0">
                  <svg width="60" height="80" viewBox="0 0 60 80" fill="none">
                    <path
                      d="M30 5 Q 35 40, 30 75"
                      stroke="#94a3b8"
                      strokeWidth="3"
                      strokeDasharray="8 4"
                      strokeLinecap="round"
                    />
                    {/* Grot strzałki */}
                    <path
                      d="M 20 65 L 30 75 L 40 65"
                      stroke="#94a3b8"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </div>
              )}

              {/* KARTA KROKU */}
              <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300">
                <div className="grid md:grid-cols-[180px_1fr] gap-0">
                  {/* LEWA STRONA - DUŻY NUMER (szkicowy styl) */}
                  <div className="bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-8 md:p-10 relative">
                    {/* Ręcznie rysowane koło pod numerem */}
                    <svg
                      className="absolute inset-0 w-full h-full opacity-20"
                      viewBox="0 0 180 180"
                    >
                      <circle
                        cx="90"
                        cy="90"
                        r="60"
                        stroke="#4ade80"
                        strokeWidth="4"
                        fill="none"
                        strokeDasharray="2 4"
                      />
                    </svg>

                    {/* Wielki numer */}
                    <div className="text-8xl md:text-9xl font-black text-green-600 relative z-10">
                      {step.number}
                    </div>
                  </div>

                  {/* PRAWA STRONA - OPIS */}
                  <div className="p-8 md:p-10 flex flex-col justify-center">
                    <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 relative inline-block w-fit">
                      {step.title}
                      {/* Ręcznie rysowana linia pod tytułem - TYLKO POD TEKSTEM */}
                      <svg
                        className="absolute -bottom-2 left-0 w-full"
                        height="8"
                        viewBox="0 0 300 8"
                        preserveAspectRatio="none"
                        fill="none"
                      >
                        <path
                          d="M2 4 Q 75 2, 150 4 T 298 4"
                          stroke={
                            step.number === 1
                              ? '#4ade80'
                              : step.number === 2
                                ? '#60a5fa'
                                : '#f472b6'
                          }
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </h3>
                    <p className="text-xl text-gray-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </div>

              {/* Ręcznie rysowane checkmarki/dekoracje obok kart */}
              {step.number === 1 && (
                <div className="hidden lg:block absolute -left-16 top-1/2 -translate-y-1/2">
                  <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
                    <path
                      d="M10 25 L20 35 L40 15"
                      stroke="#4ade80"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}

              {step.number === 2 && (
                <div className="hidden lg:block absolute -right-16 top-1/2 -translate-y-1/2">
                  <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
                    <circle cx="25" cy="25" r="15" stroke="#60a5fa" strokeWidth="3" fill="none" />
                    <path
                      d="M15 25 L35 25 M25 15 L25 35"
                      stroke="#60a5fa"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              )}

              {step.number === 3 && (
                <div className="hidden lg:block absolute -left-16 top-1/2 -translate-y-1/2">
                  <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
                    <path
                      d="M25 10 L30 20 L42 22 L33 30 L35 42 L25 36 L15 42 L17 30 L8 22 L20 20 Z"
                      stroke="#f472b6"
                      strokeWidth="2.5"
                      fill="none"
                    />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* DODATKOWY TEKST NA DOLE */}
        <div className="text-center mt-20 bg-white/80 backdrop-blur-sm rounded-2xl p-8 border-2 border-gray-200 shadow-md">
          <p className="text-2xl font-bold text-gray-900 mb-2">I to wszystko! 🎉</p>
          <p className="text-lg text-gray-600">
            Żadnych skomplikowanych ustawień. Żadnego długiego szkolenia.
          </p>
          <div className="mt-4">
            {/* Ręcznie rysowana linia */}
            <svg className="mx-auto" width="100" height="8" viewBox="0 0 100 8">
              <path
                d="M5 4 Q 50 2, 95 4"
                stroke="#4ade80"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Fala na dole sekcji - jak w Hero */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0,40 C240,60 480,60 720,50 C960,40 1200,30 1440,35 L1440,80 L0,80 Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}
