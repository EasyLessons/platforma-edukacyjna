'use client';

import React from 'react';
import Image from 'next/image';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { useDragScroll } from '@/_new/shared/hooks/use-drag-scroll';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  display: 'swap',
});

const testimonials = [
  {
    text: "EasyLesson całkowicie zmieniło sposób, w jaki uczę się matematyki. Tablica jest intuicyjna i wszystko działa naprawdę płynnie!",
    highlight: "Tablica jest intuicyjna",
    name: "Zosia",
    role: "Uczennica",
    avatar: 'https://i.pravatar.cc/150?img=47',
  },
  {
    text: "Najlepsza platforma do prowadzenia korepetycji online. AI Tutor naprawdę pomaga w przygotowaniu materiałów.",
    highlight: "AI Tutor naprawdę pomaga",
    name: "Michał",
    role: "Korepetytor",
    avatar: 'https://i.pravatar.cc/150?img=11',
  },
  {
    text: "Voice Chat i współbieżność to game changer. Mogę pracować z kilkoma uczniami jednocześnie bez problemu.",
    highlight: "game changer",
    name: "Anna",
    role: "Nauczycielka",
    avatar: 'https://i.pravatar.cc/150?img=32',
  },
  {
    text: "SmartSearch wzorów matematycznych oszczędza mi mnóstwo czasu. Nie muszę szukać wzorów godzinami.",
    highlight: "oszczędza mi mnóstwo czasu",
    name: "Kuba",
    role: "Uczeń",
    avatar: 'https://i.pravatar.cc/150?img=53',
  },
  {
    text: "Prostota i funkcjonalność w jednym. Polecam każdemu korepetytorowi, który chce pracować efektywnie.",
    highlight: "Prostota i funkcjonalność w jednym",
    name: "Magda",
    role: "Korepetytorka",
    avatar: 'https://i.pravatar.cc/150?img=25',
  },
  {
    text: "Moi uczniowie są zachwyceni interaktywną tablicą. Lekcje stały się dużo ciekawsze!",
    highlight: "Lekcje stały się dużo ciekawsze",
    name: "Tomasz",
    role: "Nauczyciel",
    avatar: 'https://i.pravatar.cc/150?img=60',
  },
];

function highlightedText(text: string, highlight: string) {
  const parts = text.split(highlight);
  if (parts.length < 2) return <>{text}</>;
  return (
    <>
      {parts[0]}
      <strong className="text-gray-900 font-700">{highlight}</strong>
      {parts[1]}
    </>
  );
}

const duplicatedTestimonials = [...testimonials, ...testimonials];

export default function TestimonialsSection() {
  const { scrollRef } = useDragScroll({ autoScrollSpeed: 0.25 });

  return (
    <div className={`${jakartaSans.className} w-full bg-white px-4 sm:px-6 lg:px-8 pb-8`}>

      <section
        className="relative w-full overflow-hidden py-12 sm:py-16"
        style={{
          borderRadius: '24px',
          background: 'linear-gradient(145deg, #1fb870 0%, #2bcc82 50%, #3dd99a 100%)',
        }}
      >

        {/* Dekoracyjne kółka */}
        <div
          className="absolute top-0 right-0 pointer-events-none"
          style={{
            width: '35vw',
            height: '35vw',
            maxWidth: '420px',
            maxHeight: '420px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 pointer-events-none"
          style={{
            width: '25vw',
            height: '25vw',
            maxWidth: '320px',
            maxHeight: '320px',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.05)',
            transform: 'translate(-30%, 30%)',
          }}
        />

        {/* Nagłówek */}
        <div className="relative text-center mb-10 sm:mb-12 px-6">
          <p
            className="text-black font-semibold tracking-widest uppercase mb-3"
            style={{ fontSize: 'clamp(0.6rem, 1vw, 0.72rem)', opacity: 0.75, letterSpacing: '0.14em' }}
          >
            CO MÓWIĄ UŻYTKOWNICY
          </p>
          <h2
            className="font-bold text-black"
            style={{ fontSize: 'clamp(1.6rem, 3.5vw, 3rem)', lineHeight: 1.15 }}
          >
            Opinie, które mówią same za siebie
          </h2>
        </div>

        {/* Karuzela */}
        <div className="relative overflow-hidden select-none">

          <div
            className="absolute left-0 top-0 bottom-0 w-24 sm:w-36 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to right, #1fb870, transparent)' }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-24 sm:w-36 z-10 pointer-events-none"
            style={{ background: 'linear-gradient(to left, #3dd99a, transparent)' }}
          />

          <div
            ref={scrollRef}
            className="flex gap-6"
            style={{ willChange: 'transform', transform: 'translateZ(0)' }}
          >
            {duplicatedTestimonials.map((testimonial, index) => (
              <div
                key={index}
                className="flex-shrink-0"
                style={{
                  width: '380px',
                  background: 'rgba(255,255,255,0.92)',
                  borderRadius: '16px',
                  padding: '24px 28px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
                }}
              >
                <div
                  className="font-black mb-2"
                  style={{ fontSize: '2.8rem', lineHeight: 0.8, color: '#2bcc82', opacity: 0.3 }}
                >
                  "
                </div>

                <p
                  className="text-gray-600 leading-relaxed mb-5"
                  style={{ fontSize: '0.95rem' }}
                >
                  {highlightedText(testimonial.text, testimonial.highlight)}
                </p>

                <div className="flex items-center gap-3">
                  <img
                    src={testimonial.avatar}
                    alt={testimonial.name}
                    className="rounded-full object-cover border-2 flex-shrink-0"
                    style={{ width: '40px', height: '40px', borderColor: '#2bcc82' }}
                  />
                  <div>
                    <p className="font-bold text-gray-900" style={{ fontSize: '0.88rem' }}>
                      {testimonial.name}
                    </p>
                    <p className="text-gray-500" style={{ fontSize: '0.75rem' }}>
                      {testimonial.role}
                    </p>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} width="13" height="13" viewBox="0 0 14 14" fill="#2bcc82">
                        <path d="M7 1l1.5 4H13l-3.5 2.5 1.3 4L7 9 3.2 11.5l1.3-4L1 5h4.5z" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>
    </div>
  );
}