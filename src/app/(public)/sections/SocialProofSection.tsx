'use client';

import React from 'react';
import { Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '800'],
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['700'],
  style: ['italic'],
  display: 'swap',
});

interface Stat {
  number: string;
  label: string;
}

interface Testimonial {
  text: string;
  author: string;
  role: string;
  avatar: string;
}

const stats: Stat[] = [
  { number: '1 200+', label: 'korepetytorów' },
  { number: '5 000+', label: 'lekcji przeprowadzonych' },
  { number: '4.8 / 5', label: 'średnia ocena' },
];

const testimonials: Testimonial[] = [
  {
    text: 'Dzięki EasyLesson mogę prowadzić lekcje matematyki bez problemów. AI pomaga mi w przygotowaniu materiałów!',
    author: 'Anna K.',
    role: 'korepetytorka matematyki',
    avatar: 'https://i.pravatar.cc/150?img=47',
  },
  {
    text: 'SmartSearch to game changer. Nie muszę już googlować wzorów w trakcie lekcji.',
    author: 'Marek W.',
    role: 'student fizyki',
    avatar: 'https://i.pravatar.cc/150?img=11',
  },
  {
    text: 'Najlepsza tablica online jakiej używałam. Intuicyjna, szybka i z wszystkim czego potrzebuję.',
    author: 'Kasia M.',
    role: 'nauczycielka chemii',
    avatar: 'https://i.pravatar.cc/150?img=32',
  },
  {
    text: 'Współpraca w czasie rzeczywistym działa rewelacyjnie. Uczniowie widzą wszystko na żywo!',
    author: 'Tomek R.',
    role: 'korepetytor online',
    avatar: 'https://i.pravatar.cc/150?img=53',
  },
];

export default function SocialProofSection() {
  return (
    <div className={`${jakartaSans.className} w-full bg-white px-4 sm:px-6 lg:px-8 pb-8`}>

      {/* Blok z zaokrąglonymi rogami - pomarańczowe tło */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          borderRadius: '24px',
          background: 'linear-gradient(145deg, #ff8427 0%, #ff9a4d 50%, #ffaa66 100%)',
          padding: '4vh 4vw',
        }}
      >

        {/* Dekoracyjne kółka w tle */}
        <div
          className="absolute top-0 right-0 pointer-events-none"
          style={{
            width: '40vw',
            height: '40vw',
            maxWidth: '500px',
            maxHeight: '500px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 pointer-events-none"
          style={{
            width: '30vw',
            height: '30vw',
            maxWidth: '380px',
            maxHeight: '380px',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.04)',
            transform: 'translate(-30%, 30%)',
          }}
        />

        {/* Nagłówek sekcji */}
        <div className="relative text-center mb-10 sm:mb-14">
          <p
            className="text-white font-semibold tracking-widest uppercase mb-3"
            style={{ fontSize: 'clamp(0.6rem, 1vw, 0.75rem)', opacity: 0.8, letterSpacing: '0.14em' }}
          >
            ZAUFANIE UŻYTKOWNIKÓW
          </p>
          <h2
            className="font-bold text-white leading-tight"
            style={{ fontSize: 'clamp(1.8rem, 4vw, 3.6rem)' }}
          >
            Zaufali{' '}
            <span className={playfair.className} style={{ color: '#fff3e0' }}>
              nam...
            </span>
          </h2>
        </div>

        {/* Statystyki */}
        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 sm:mb-14">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center"
              style={{
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '16px',
                padding: '3vh 2vw',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              <div
                className="font-black text-white"
                style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', lineHeight: 1 }}
              >
                {stat.number}
              </div>
              <div
                className="text-white mt-2 font-medium"
                style={{ fontSize: 'clamp(0.8rem, 1.2vw, 1rem)', opacity: 0.85 }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Opinie */}
        <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              style={{
                background: 'rgba(255,255,255,0.92)',
                borderRadius: '16px',
                padding: '2.5vh 2.5vw',
                boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
              }}
            >
              {/* Cudzysłów */}
              <div
                className="font-black mb-3"
                style={{ fontSize: '3rem', lineHeight: 0.8, color: '#ff8427', opacity: 0.35 }}
              >
                "
              </div>

              <p
                className="text-gray-700 leading-relaxed mb-5"
                style={{ fontSize: 'clamp(0.85rem, 1.2vw, 1rem)' }}
              >
                {testimonial.text}
              </p>

              {/* Autor */}
              <div className="flex items-center gap-3">
                <img
                  src={testimonial.avatar}
                  alt={testimonial.author}
                  className="rounded-full object-cover border-2"
                  style={{
                    width: '42px',
                    height: '42px',
                    borderColor: '#ff8427',
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div className="font-bold text-gray-900" style={{ fontSize: '0.9rem' }}>
                    {testimonial.author}
                  </div>
                  <div className="text-gray-500" style={{ fontSize: '0.78rem' }}>
                    {testimonial.role}
                  </div>
                </div>
                {/* Gwiazdki */}
                <div className="ml-auto flex gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill="#ff8427">
                      <path d="M7 1l1.5 4H13l-3.5 2.5 1.3 4L7 9 3.2 11.5l1.3-4L1 5h4.5z" />
                    </svg>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}