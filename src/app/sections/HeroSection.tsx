'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const backgroundImages = [
  '/resources/hero-bg-1.webp',
  '/resources/hero-bg-1.webp',
  '/resources/hero-bg-1.webp',
  '/resources/hero-bg-1.webp',
];

export default function HeroSection() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentImageIndex((prev) => (prev + 1) % backgroundImages.length);
        setIsTransitioning(false);
      }, 800);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative bg-white overflow-hidden h-[800px] flex items-end">
      {/* Tło z rotującymi się zdjęciami */}
      <div className="absolute inset-0">
        {backgroundImages.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-500 ${
              index === currentImageIndex && !isTransitioning ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Image
              src={img}
              alt={`Background ${index + 1}`}
              fill
              className="object-cover"
              priority={index === 0}
            />
          </div>
        ))}
        {/* Gradient overlay dla lepszej czytelności - czarny przy dolnej granicy */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      </div>

      {/* Główna zawartość - wyrównana do lewego dolnego rogu */}
      <div className="relative z-10 max-w-7xl w-full mx-auto px-8 sm:px-12 lg:px-16 pb-20">
        <div className="max-w-4xl">
          {/* Mały czerwony znacznik z tekstem */}
          <div className="flex items-center gap-2 mb-6">
<div 
  className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] rotate-90" 
  style={{ borderBottomColor: '#b91717' }}
/>          
            <span 
              className="text-white text-xs font-bold tracking-widest uppercase"
              style={{ 
                textShadow: '0 4px 12px rgba(0, 0, 0, 0.2), 0 1px 4px rgba(0, 0, 0, 0.2)'
              }}
            >
              EASYLESSON BOARD - STWORZONY DLA UCZNIÓW, KOREPETYTORÓW I NAUCZYCIELI
            </span>
          </div>

          {/* Główny nagłówek - dwie linie */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light leading-tight
                 bg-gradient-to-tr from-gray-300 via-white to-white 
                 bg-clip-text text-transparent">
    <span className="inline-block px-2 py-1">
      Ucz się efektywniej na 
      <span style={{ 
        fontFamily: 'Prata, serif', 
        fontStyle: 'italic', 
        fontWeight: '600', 
        fontSize: '1.15em'
      }}>{" "}Easylesson</span>,              
    </span>
    <br />
    <span className="inline-block px-2">
      współpracując z innymi
    </span>
  </h1>
          </div>

          {/* Przyciski CTA - jak w headerze */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Biały przycisk - Zaloguj */}
            <Link href="/login">
              <button className="hover-shine hover:cursor-pointer flex items-center gap-1 px-4 py-2 text-gray-700 hover:text-black bg-white hover:bg-white transition-colors text-sm font-medium rounded-md">
                Stwórz tablicę
              </button>
            </Link>

            {/* Czarny przycisk - Zarejestruj */}
            <Link href="/rejestracja">
              <button 
                className="hover-shine hover:cursor-pointer flex items-center gap-1 px-4 py-2 text-gray-100 hover:text-white transition-colors text-sm font-medium rounded-md"
                style={{ backgroundColor: '#212224' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#48494d'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#37393c'}
              >
                Obejrzyj poradnik
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}