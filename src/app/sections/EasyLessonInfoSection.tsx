'use client';

import React from 'react';
import Image from 'next/image';

export default function EasyLessonInfoSection() {
  return (
    <section className="relative bg-white overflow-hidden pt-12 pb-0 ">
  {/* Gradient blobs */}
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Żółta plama - lewy górny */}
    <div 
      className="absolute -top-64 -left-64 w-[800px] h-[800px] rounded-full opacity-25 blur-3xl"
      style={{
        background: 'radial-gradient(circle, rgba(253, 224, 71, 0.5) 0%, rgba(253, 224, 71, 0) 70%)'
      }}
    />
    
    {/* Zielonkawa plama - prawy środek */}
    <div 
      className="absolute top-1/4 -right-64 w-[700px] h-[700px] rounded-full opacity-25 blur-3xl"
      style={{
        background: 'radial-gradient(circle, rgba(134, 239, 172, 0.5) 0%, rgba(134, 239, 172, 0) 70%)'
      }}
    />
    
    {/* Pomarańczowa plama - lewy dół */}
    <div 
      className="absolute -bottom-48 left-1/4 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
      style={{
        background: 'radial-gradient(circle, rgba(251, 191, 36, 0.5) 0%, rgba(251, 191, 36, 0) 70%)'
      }}
    />
  </div>
      {/* Kontener szerszy niż max-w-7xl */}
      <div className="max-w-[1600px] mx-auto px-8 sm:px-12 lg:px-16">
        
        {/* Gwiazdka na górze */}
        <div className="flex justify-center mb-12">
          <div className="relative w-12 h-12 opacity-80">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path 
                d="M50 10 L60 40 L90 50 L60 60 L50 90 L40 60 L10 50 L40 40 Z" 
                fill="#f97316" 
              />
              {/* Małe promieniujące linie */}
              <line x1="50" y1="0" x2="50" y2="8" stroke="#f97316" strokeWidth="3" />
              <line x1="50" y1="92" x2="50" y2="100" stroke="#f97316" strokeWidth="3" />
              <line x1="0" y1="50" x2="8" y2="50" stroke="#f97316" strokeWidth="3" />
              <line x1="92" y1="50" x2="100" y2="50" stroke="#f97316" strokeWidth="3" />
              <line x1="15" y1="15" x2="20" y2="20" stroke="#f97316" strokeWidth="3" />
              <line x1="80" y1="80" x2="85" y2="85" stroke="#f97316" strokeWidth="3" />
              <line x1="85" y1="15" x2="80" y2="20" stroke="#f97316" strokeWidth="3" />
              <line x1="20" y1="80" x2="15" y2="85" stroke="#f97316" strokeWidth="3" />
            </svg>
          </div>
        </div>

        {/* Główny nagłówek */}
{/* Główny nagłówek */}
<div className="text-center max-w-5xl mx-auto mb-16">
  <h2 className="text-4xl sm:text-5xl font-light text-gray-900 leading-tight mb-6">
    Zmień standardowe zajęcia
    <br />
    w lekcje pełne{' '}
    <span 
      style={{ 
        fontFamily: 'Prata, serif',
        fontSize: '1.15em',
        fontStyle: 'italic',
        fontWeight: '600'
      }}
    >
      konkretów
    </span>
  </h2>
  
  {/* Podtytuł */}
  <p className="text-base md:text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto font-light">
    Platforma, która pomaga uczyć efektywniej i ułatwia pracę.
    <br />
    Zaoszczędź czas na dojazdy i przejdź na{' '}
    <span 
      className="text-gray-900"
      style={{ 
        fontFamily: 'Prata, serif',
        fontSize: '1.05em',
        fontStyle: 'italic'
      }}
    >
      EasyLesson
    </span>
  </p>
</div>

        {/* Film YouTube - EasyLesson w 3 minuty */}
<div className="max-w-4xl mx-auto mb-8">
  <h3 className="text-center text-2xl font-semibold text-gray-600 mb-6">
    Obejrzyj{' '}
    <span 
      className="text-gray-900"
      style={{ 
        fontFamily: 'Prata, serif',
        fontSize: '1.3em',
        fontStyle: 'italic'
      }}
    >
      3 minuty
    </span>
    {' '}filmu i korzystaj{' '}
    <span 
      className="text-gray-900"
      style={{ 
        fontFamily: 'Prata, serif',
        fontSize: '1.3em',
        fontStyle: 'italic'
      }}
    >
      na zawsze
    </span>
  </h3>
          <div className="bg-gray-100 rounded-2xl overflow-hidden shadow-lg">
            <div className="aspect-video relative">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/r0vrPSZjWMQ?start=0"
                title="EasyLesson w 3 minuty"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="rounded-2xl"
              />
            </div>
          </div>
          <p className="text-center text-sm text-gray-600 mt-4">
            Easylesson to nie tylko aplikacja. Wprowadzamy najnowocześniejszą technologie do polskich szkół!
          </p>
        </div>

      </div>
    </section>
  );
}