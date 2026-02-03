'use client';

import React from 'react';

interface Audience {
  emoji: string;
  title: string;
  points: string[];
}

const audiences: Audience[] = [
  {
    emoji: '👨‍🏫',
    title: 'Korepetytorów',
    points: [
      'Prowadź lekcje matematyki, fizyki, chemii',
      'Wszystkie narzędzia w jednym miejscu',
      'Zarabiaj więcej dzięki lepszej jakości',
    ],
  },
  {
    emoji: '🎓',
    title: 'Uczniów i studentów',
    points: ['Ucz się szybciej z AI', 'Dostęp do wzorów i materiałów', 'Współpracuj z innymi'],
  },
  {
    emoji: '🏫',
    title: 'Szkół online',
    points: [
      'Organizuj lekcje grupowe',
      'Zarządzaj wieloma uczniami',
      'Wszystko w jednej platformie',
    ],
  },
];

export default function ForWhoSection() {
  return (
    <section className="relative bg-white py-12 px-4">
      {/* GŁÓWNA ZAWARTOŚĆ */}
      <div className="relative max-w-6xl mx-auto">
        {/* TYTUŁ SEKCJI */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 relative inline-block">
            Idealne dla...
            {/* Ręcznie rysowana kreska pod tekstem */}
            <svg
              className="absolute -bottom-2 left-0 w-full"
              height="10"
              viewBox="0 0 200 10"
              fill="none"
            >
              <path
                d="M2 6C50 3 100 4 150 5C170 6 190 4 198 6"
                stroke="#4ade80"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </h2>
        </div>

        {/* 3 BOXIKI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {audiences.map((audience, index) => (
            <div
              key={index}
              className="bg-gray-50 rounded-xl p-6 border-2 border-gray-200 hover:border-green-400 hover:shadow-md transition-all duration-300"
            >
              {/* Emoji */}
              <div className="text-5xl mb-3 text-center">{audience.emoji}</div>

              {/* Tytuł */}
              <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">{audience.title}</h3>

              {/* Lista punktów */}
              <ul className="space-y-2">
                {audience.points.map((point, i) => (
                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                    <span className="text-green-500 font-bold mt-0.5">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
