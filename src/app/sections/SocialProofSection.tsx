'use client';

import React from 'react';

interface Stat {
  number: string;
  label: string;
  icon: string;
}

interface Testimonial {
  text: string;
  author: string;
  role: string;
  color: string;
}

const stats: Stat[] = [
  {
    number: '1,200+',
    label: 'korepetytorów',
    icon: '👨‍🏫',
  },
  {
    number: '5,000+',
    label: 'lekcji przeprowadzonych',
    icon: '📚',
  },
  {
    number: '4.8/5',
    label: 'średnia ocena',
    icon: '⭐',
  },
];

const testimonials: Testimonial[] = [
  {
    text: 'Dzięki EasyLesson mogę prowadzić lekcje matematyki bez problemów. AI pomaga mi w przygotowaniu materiałów!',
    author: 'Anna',
    role: 'korepetytorka matematyki',
    color: '#3b82f6',
  },
  {
    text: 'SmartSearch to game changer. Nie muszę już googlować wzorów w trakcie lekcji.',
    author: 'Marek',
    role: 'student fizyki',
    color: '#ec4899',
  },
  {
    text: 'Najlepsza tablica online jakiej używałem. Intuicyjna, szybka i z wszystkim czego potrzebuję.',
    author: 'Kasia',
    role: 'nauczycielka chemii',
    color: '#8b5cf6',
  },
  {
    text: 'Współpraca w czasie rzeczywistym działa rewelacyjnie. Uczniowie widzą wszystko na żywo!',
    author: 'Tomek',
    role: 'korepetytor online',
    color: '#14b8a6',
  },
];

export default function SocialProofSection() {
  return (
    <section className="relative bg-white py-20 px-4">
      {/* GŁÓWNA ZAWARTOŚĆ */}
      <div className="relative max-w-6xl mx-auto z-10">
        {/* TYTUŁ SEKCJI */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Zaufali{' '}
            <span className="relative inline-block">
              nam...
              <svg
                className="absolute -bottom-2 left-0 w-full"
                height="12"
                viewBox="0 0 150 12"
                fill="none"
              >
                <path
                  d="M2 8C40 4 80 3 120 6C135 7 145 5 148 7"
                  stroke="#4ade80"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h2>
        </div>

        {/* STATYSTYKI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {stats.map((stat, index) => (
            <div key={index} className="text-center relative">
              {/* Rysowana ramka */}
              <div className="relative bg-[#f5f3ef] rounded-2xl p-8 shadow-lg">
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <rect
                    x="3"
                    y="3"
                    width="calc(100% - 6px)"
                    height="calc(100% - 6px)"
                    rx="16"
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth="3"
                  />
                </svg>

                <div className="relative z-10">
                  <div className="text-5xl mb-3">{stat.icon}</div>
                  <div className="text-4xl md:text-5xl font-black text-gray-900 mb-2">
                    {stat.number}
                  </div>
                  <div className="text-lg text-gray-600">{stat.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* OPINIE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testimonials.map((testimonial, index) => (
            <div key={index} className="relative">
              {/* Karta opinii */}
              <div className="relative bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-100 hover:shadow-xl transition-all duration-300">
                {/* Rysowany kontur */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <rect
                    x="3"
                    y="3"
                    width="calc(100% - 6px)"
                    height="calc(100% - 6px)"
                    rx="16"
                    fill="none"
                    stroke={testimonial.color}
                    strokeWidth="3"
                  />
                </svg>

                <div className="relative z-10">
                  {/* Cytat */}
                  <div className="mb-4">
                    <svg width="40" height="30" viewBox="0 0 40 30" fill="none">
                      <path
                        d="M0 15C0 6.716 6.716 0 15 0h2v15H2v10h13v5H0V15zm23 0C23 6.716 29.716 0 38 0h2v15H25v10h13v5H23V15z"
                        fill={testimonial.color}
                        opacity="0.2"
                      />
                    </svg>
                  </div>

                  <p className="text-gray-700 text-lg leading-relaxed mb-6 italic">
                    "{testimonial.text}"
                  </p>

                  {/* Autor */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl"
                      style={{ backgroundColor: testimonial.color }}
                    >
                      {testimonial.author[0]}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">{testimonial.author}</div>
                      <div className="text-sm text-gray-600">{testimonial.role}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rysowane gwiazdki obok */}
              {index === 0 && (
                <div className="hidden lg:block absolute -right-8 top-4">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <path
                      d="M20 5 L23 15 L33 15 L25 21 L28 31 L20 25 L12 31 L15 21 L7 15 L17 15 Z"
                      fill="#fbbf24"
                      stroke="#f59e0b"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
