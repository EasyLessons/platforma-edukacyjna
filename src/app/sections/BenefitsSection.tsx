'use client';

import React, { useState } from 'react';
import Image from 'next/image';

export default function BenefitsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const benefits = [
    {
      category: 'INTERAKTYWNA PRZESTRZEŃ',
      title: 'Tablica',
      description: 'Intuicyjna przestrzeń do współpracy w czasie rzeczywistym',
      duration: '1:30 min',
      image: '/resources/HeroSection.webp'
    },
    {
      category: 'NARZĘDZIA MATEMATYCZNE',
      title: 'Narzędzia',
      description: 'Kalkulator, wykres funkcji i więcej zaawansowanych narzędzi',
      duration: '2:15 min',
      image: '/resources/Aktualnosci/Nauczyciel.jpg'
    },
    {
      category: 'INTELIGENTNE WYSZUKIWANIE',
      title: 'SmartSearch',
      description: 'Wyszukiwarka wzorów matematycznych i zadań',
      duration: '1:45 min',
      image: '/resources/Aktualnosci/Nowosc.jpg'
    },
    {
      category: 'KOMUNIKACJA GŁOSOWA',
      title: 'VoiceChat',
      description: 'Komunikacja głosowa z AI w czasie rzeczywistym',
      duration: '2:00 min',
      image: '/resources/Aktualnosci/Wspolbieznosc.jpg'
    },
    {
      category: 'INTELIGENTNY ASYSTENT',
      title: 'AI Tutor',
      description: 'Twój osobisty asystent nauki, który wyjaśnia i podpowiada',
      duration: '2:30 min',
      image: '/resources/Aktualnosci/Nauczyciel.jpg'
    },
    {
      category: 'PRACA ZESPOŁOWA',
      title: 'Współbieżność',
      description: 'Praca w czasie rzeczywistym z wieloma osobami jednocześnie',
      duration: '1:50 min',
      image: '/resources/Aktualnosci/Nowosc.jpg'
    },
    {
      category: 'ZARZĄDZANIE PROJEKTAMI',
      title: 'Dashboard',
      description: 'Przejrzysty pulpit do zarządzania wszystkimi tablicami',
      duration: '2:10 min',
      image: '/resources/Aktualnosci/Wspolbieznosc.jpg'
    },
    {
      category: 'ORGANIZACJA PRACY',
      title: 'Workspace\'y',
      description: 'Organizuj projekty w dedykowanych przestrzeniach roboczych',
      duration: '1:55 min',
      image: '/resources/BoardHero.webp'
    }
  ];

  const CARD_WIDTH = 310;
  const GAP = 16;
  const SCROLL_AMOUNT = CARD_WIDTH + GAP;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < benefits.length - 1 ? prev + 1 : prev));
  };

  return (
    <section className="relative bg-white py-24 overflow-hidden">
      {/* Biały blok zakrywający z lewej */}
      <div className="absolute left-0 top-0 bottom-0 w-[calc((100vw-1280px)/2)] bg-white z-20 pointer-events-none" />

      {/* Kontener */}
      <div className="relative">
        {/* Nagłówek i strzałki */}
        <div className="max-w-7xl mx-auto px-8 mb-12 flex items-center justify-between">
          <h3 className="text-2xl sm:text-3xl font-light text-gray-900">
            Dlaczego warto wybrać produkty{' '}
            <span 
              style={{ 
                fontFamily: 'Prata, serif',
                fontSize: '1.1em',
                fontStyle: 'italic'
              }}
            >
              EasyLesson
            </span>
            ?
          </h3>

          {/* Strzałki nawigacji */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="hover-shine w-10 h-10 rounded-full border-2 border-gray-300 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:cursor-pointer"
            >
              <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= benefits.length - 1}
              className="hover-shine w-10 h-10 rounded-full border-2 border-gray-300 hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:cursor-pointer"
            >
              <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollujące kafelki */}
        <div className="relative">
          <div 
            className="flex transition-transform duration-500 ease-out"
            style={{
              gap: `${GAP}px`,
              paddingLeft: `calc((100vw - 1280px) / 2 + ${GAP}px)`,
              transform: `translateX(-${currentIndex * SCROLL_AMOUNT}px)`
            }}
          >
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="relative flex-shrink-0 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all"
                style={{ width: `${CARD_WIDTH}px`, height: '500px' }}
              >
                {/* Zdjęcie na całą wysokość */}
                <Image
                  src={benefit.image}
                  alt={benefit.title}
                  fill
                  className="object-cover"
                />
                
                {/* Gradient overlay - mocniejszy na dole */}
                {/* Gradient overlay - obniżony do 1/3 wysokości obrazka */}
<div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-gray-900 via-gray-900/70 to-transparent" />

                {/* Treść kafelka - ABSOLUTNIE na dole */}
                <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
                  {/* Kategoria */}
                  <p className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                    {benefit.category}
                  </p>

                  {/* Tytuł */}
                  <h4 className="text-lg font-bold text-white mb-3 leading-snug">
                    {benefit.description}
                  </h4>

                  {/* Link do filmu */}
                  <a
                    href="#"
                    className="hover-shine inline-flex items-center gap-2 text-sm text-gray-200 hover:text-white transition-colors hover:cursor-pointer group"
                  >
                    <svg 
    className="w-5 h-5 transition-transform group-hover:scale-110" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
  </svg>
                    Obejrzyj ({benefit.duration})
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}