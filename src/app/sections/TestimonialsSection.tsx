'use client';

import React, { useEffect, useRef } from 'react';
import Image from 'next/image';

const testimonials = [
  {
    text: "EasyLesson całkowicie zmieniło sposób, w jaki uczę się matematyki. Tablica jest intuicyjna i wszystko działa naprawdę płynnie!",
    name: "Zosia",
    role: "Uczennica"
  },
  {
    text: "Najlepsza platforma do prowadzenia korepetycji online. AI Tutor naprawdę pomaga w przygotowaniu materiałów.",
    name: "Michał",
    role: "Korepetytor"
  },
  {
    text: "Voice Chat i współbieżność to game changer. Mogę pracować z kilkoma uczniami jednocześnie bez problemu.",
    name: "Anna",
    role: "Nauczycielka"
  },
  {
    text: "SmartSearch wzorów matematycznych oszczędza mi mnóstwo czasu. Nie muszę szukać wzorów godzinami.",
    name: "Kuba",
    role: "Uczeń"
  },
  {
    text: "Prostota i funkcjonalność w jednym. Polecam każdemu korepetytorowi, który chce pracować efektywnie.",
    name: "Magda",
    role: "Korepetytorka"
  },
  {
    text: "Moi uczniowie są zachwyceni interaktywną tablicą. Lekcje stały się dużo ciekawsze!",
    name: "Tomasz",
    role: "Nauczyciel"
  },
];

export default function TestimonialsSection() {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let animationFrameId: number;
    let scrollPosition = 0;
    const scrollSpeed = 0.25;

    const animate = () => {
      if (scrollContainer) {
        scrollPosition += scrollSpeed;
        
        const maxScroll = scrollContainer.scrollWidth / 2;
        if (scrollPosition >= maxScroll) {
          scrollPosition = 0;
        }
        
        scrollContainer.style.transform = `translateX(-${scrollPosition}px) translateZ(0)`;
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  const duplicatedTestimonials = [...testimonials, ...testimonials];

  return (
    <section className="relative bg-black overflow-visible py-16">
      {/* Separator na górze */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />

      {/* Kontener z max-w-7xl */}
      <div className="relative max-w-7xl mx-auto overflow-hidden px-8">
        {/* Gradienty boczne */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black via-black/80 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black via-black/80 to-transparent z-10 pointer-events-none" />

        {/* Animowana karuzela */}
        <div className="relative">
          <div 
            ref={scrollRef}
            className="flex gap-12"
            style={{
              transform: 'translateZ(0)',
              willChange: 'transform',
            }}
          >
            {duplicatedTestimonials.map((testimonial, index) => (
              <div
                key={index}
                className="flex-shrink-0 w-[450px]"
                style={{
                  transform: 'translateZ(0)',
                }}
              >
                {/* Opinia */}
                <p 
                  className="text-white text-base md:text-lg font-light leading-relaxed mb-4"
                  style={{
                    WebkitFontSmoothing: 'subpixel-antialiased',
                    textRendering: 'optimizeLegibility',
                  }}
                >
                  "{testimonial.text}"
                </p>
                
                {/* Podpis */}
                <div className="flex items-center gap-3">
                  {/* Avatar placeholder */}
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {testimonial.name.charAt(0)}
                    </span>
                  </div>
                  
                  {/* Dane osoby */}
                  <div>
                    <p className="text-white font-semibold text-sm">{testimonial.name}</p>
                    <p className="text-gray-400 text-xs">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sygnet na dole */}
      <div className="absolute top-0 -mt-4 left-1/2 -translate-x-1/2 opacity-70">
        <div className="relative w-8 h-8">
          <Image
            src="/resources/sygnet.webp"
            alt="EasyLesson Logo"
            fill
            className="object-contain"
          />
        </div>
      </div>
    </section>
  );
}