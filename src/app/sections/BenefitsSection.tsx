'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Plus_Jakarta_Sans } from 'next/font/google';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
});

const benefits = [
  {
    category: 'INTERAKTYWNA PRZESTRZEŃ',
    title: 'Tablica',
    description: 'Współpraca w czasie rzeczywistym',
    duration: '1:30 min',
    image: '/resources/HeroSection.webp',
  },
  {
    category: 'NARZĘDZIA MATEMATYCZNE',
    title: 'Narzędzia',
    description: 'Kalkulator, wykresy i więcej',
    duration: '2:15 min',
    image: '/resources/Aktualnosci/Nauczyciel.jpg',
  },
  {
    category: 'INTELIGENTNE WYSZUKIWANIE',
    title: 'SmartSearch',
    description: 'Wzory matematyczne na żądanie',
    duration: '1:45 min',
    image: '/resources/Aktualnosci/Nowosc.jpg',
  },
  {
    category: 'KOMUNIKACJA GŁOSOWA',
    title: 'VoiceChat',
    description: 'Rozmowa z AI w czasie rzeczywistym',
    duration: '2:00 min',
    image: '/resources/Aktualnosci/Wspolbieznosc.jpg',
  },
  {
    category: 'INTELIGENTNY ASYSTENT',
    title: 'AI Tutor',
    description: 'Asystent który uczy i podpowiada',
    duration: '2:30 min',
    image: '/resources/Aktualnosci/Nauczyciel.jpg',
  },
  {
    category: 'PRACA ZESPOŁOWA',
    title: 'Współbieżność',
    description: 'Wielu użytkowników naraz',
    duration: '1:50 min',
    image: '/resources/Aktualnosci/Nowosc.jpg',
  },
  {
    category: 'ZARZĄDZANIE',
    title: 'Dashboard',
    description: 'Pulpit wszystkich twoich tablic',
    duration: '2:10 min',
    image: '/resources/Aktualnosci/Wspolbieznosc.jpg',
  },
  {
    category: 'ORGANIZACJA PRACY',
    title: 'Workspace\'y',
    description: 'Projekty w jednym miejscu',
    duration: '1:55 min',
    image: '/resources/BoardHero.webp',
  },
];

const CARD_WIDTH = 300;
const GAP = 16;
const SCROLL_AMOUNT = CARD_WIDTH + GAP;

export default function BenefitsSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => setCurrentIndex(prev => Math.max(prev - 1, 0));
  const handleNext = () => setCurrentIndex(prev => Math.min(prev + 1, benefits.length - 1));

  return (
    <div className={`${jakartaSans.className} w-full bg-white px-4 sm:px-6 lg:px-8 py-8`}>

      <div
        className="relative w-full overflow-hidden"
        style={{ borderRadius: '24px', background: '#f8f8f8', padding: '4vh 0 4vh 0' }}
      >

        {/* Nagłówek wycentrowany + strzałki po prawej */}
        <div className="relative flex items-center justify-center mb-8 px-8 sm:px-10">
          <h2
            className="font-bold text-gray-900 text-center leading-tight"
            style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3.2rem)', lineHeight: 1.1 }}
          >
            Dlaczego warto wybrać{' '}
            <span style={{ color: '#1e97fd' }}>EasyLesson</span>?
          </h2>

          <div className="absolute right-8 sm:right-10 flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="flex items-center justify-center"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '2px solid #e0e0e0',
                background: 'white',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: currentIndex === 0 ? 0.3 : 1,
                transition: 'border-color 0.15s, opacity 0.15s',
              }}
              onMouseEnter={e => { if (currentIndex > 0) e.currentTarget.style.borderColor = '#aaa'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="#555">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              disabled={currentIndex >= benefits.length - 1}
              className="flex items-center justify-center"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '2px solid #e0e0e0',
                background: 'white',
                cursor: currentIndex >= benefits.length - 1 ? 'not-allowed' : 'pointer',
                opacity: currentIndex >= benefits.length - 1 ? 0.3 : 1,
                transition: 'border-color 0.15s, opacity 0.15s',
              }}
              onMouseEnter={e => { if (currentIndex < benefits.length - 1) e.currentTarget.style.borderColor = '#aaa'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="#555">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Karuzela */}
        <div className="overflow-hidden">
          <div
            className="flex"
            style={{
              gap: `${GAP}px`,
              paddingLeft: '32px',
              transform: `translateX(-${currentIndex * SCROLL_AMOUNT}px)`,
              transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="relative flex-shrink-0 overflow-hidden"
                style={{
                  width: `${CARD_WIDTH}px`,
                  height: '420px',
                  borderRadius: '18px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                }}
              >
                {/* Zdjęcie */}
                <Image
                  src={benefit.image}
                  alt={benefit.title}
                  fill
                  className="object-cover"
                />

                {/* Gradient overlay - tylko od dołu */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.20) 50%, transparent 75%)',
                  }}
                />

                {/* Treść */}
                <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
                  <p
                    className="font-bold uppercase mb-2"
                    style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em' }}
                  >
                    {benefit.category}
                  </p>
                  <h4
                    className="font-bold text-white mb-3"
                    style={{ fontSize: '1.25rem', lineHeight: 1.2 }}
                  >
                    {benefit.description}
                  </h4>
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 group"
                    style={{
                      fontSize: '0.8rem',
                      color: 'rgba(255,255,255,0.75)',
                      textDecoration: 'none',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.75)'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    </div>
  );
}