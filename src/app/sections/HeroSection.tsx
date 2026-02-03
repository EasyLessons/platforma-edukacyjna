'use client';

import React from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative bg-[#f5f3ef] overflow-hidden">
      {/* Tło z kropkami jak Miro - bardziej widoczne */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: `radial-gradient(circle, #c4bfb5 1.5px, transparent 1.5px)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Lewa strona - Tekst i CTA */}
          <div className="space-y-8 z-10">
            {/* Mała odznaka */}
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium">
              <span className="animate-pulse">✨</span>
              Nowa generacja korepetycji online
            </div>

            {/* Główny nagłówek */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
              Korepetycje online,
              <br />
              które{' '}
              <span className="text-green-600 relative">
                naprawdę&nbsp;działają
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  height="12"
                  viewBox="0 0 300 12"
                  fill="none"
                >
                  <path
                    d="M2 10C50 5 100 2 150 5C200 8 250 4 298 7"
                    stroke="#4ade80"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            {/* Opis */}
            <p className="text-lg md:text-xl text-gray-600 leading-relaxed">
              EasyLesson to tablica do korepetycji z wbudowanym AI, dostępem do wzorów
              matematycznych i wszystkim, czego potrzebujesz do nauki online. Ucz i ucz się na
              inteligentnej tablicy.
            </p>

            {/* Przyciski CTA */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Główny CTA - Wypróbuj za darmo */}
              <Link href="/register">
                <button className="group relative px-8 py-4 bg-green-400 hover:bg-green-500 text-gray-900 text-lg font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 transform">
                  <span className="flex items-center justify-center gap-2">
                    Wypróbuj za darmo
                    <svg
                      className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </span>
                </button>
              </Link>

              {/* Drugorzędny CTA - Zobacz jak działa */}
              <button className="group px-8 py-4 bg-white hover:bg-gray-50 text-gray-700 text-lg font-semibold rounded-xl transition-all duration-300 border-2 border-gray-200 hover:border-gray-300 flex items-center justify-center gap-2">
                <Play className="w-5 h-5" />
                Zobacz jak działa
              </button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-6 pt-4">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 border-4 border-[#f5f3ef] flex items-center justify-center text-white font-bold"
                  >
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-sm text-gray-600">
                  <span className="font-bold text-gray-900">1,200+</span> korepetytorów
                  <br />
                  już uczy lepiej
                </p>
              </div>
            </div>
          </div>

          {/* Prawa strona - Video placeholder + ilustracje */}
          <div className="relative z-10">
            {/* Główne video placeholder */}
            <div className="relative">
              {/* Dekoracyjne kształty w tle */}
              <div className="absolute -top-8 -left-8 w-32 h-32 bg-green-200 rounded-full blur-3xl opacity-50 animate-pulse" />
              <div
                className="absolute -bottom-8 -right-8 w-40 h-40 bg-blue-200 rounded-full blur-3xl opacity-50 animate-pulse"
                style={{ animationDelay: '1s' }}
              />

              {/* Video container */}
              <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-gray-100 transform hover:scale-105 transition-transform duration-300">
                {/* Placeholder dla YouTube video */}
                <div className="relative aspect-video bg-gradient-to-br from-gray-100 to-gray-200">
                  {/* Thumbnail placeholder */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-4">
                      {/* Play button */}
                      <div className="mx-auto w-20 h-20 bg-green-400 rounded-full flex items-center justify-center shadow-xl hover:bg-green-500 transition-all cursor-pointer group">
                        <Play
                          className="w-10 h-10 text-gray-900 ml-1 group-hover:scale-110 transition-transform"
                          fill="currentColor"
                        />
                      </div>

                      <div>
                        <p className="text-gray-700 font-semibold text-lg">
                          Zobacz EasyLesson w akcji
                        </p>
                        <p className="text-gray-500 text-sm">2:30 min</p>
                      </div>
                    </div>
                  </div>

                  {/* Ilustracja tablicy w tle */}
                  <svg
                    className="absolute inset-0 w-full h-full opacity-10"
                    viewBox="0 0 400 300"
                    fill="none"
                  >
                    {/* Tablica */}
                    <rect
                      x="50"
                      y="50"
                      width="300"
                      height="200"
                      rx="10"
                      fill="#4ade80"
                      opacity="0.3"
                    />

                    {/* Wzory matematyczne */}
                    <text x="100" y="120" fontSize="24" fill="#166534" fontFamily="serif">
                      ∫ f(x)dx
                    </text>
                    <text x="100" y="160" fontSize="20" fill="#166534">
                      a² + b² = c²
                    </text>

                    {/* Rysowane kształty */}
                    <circle cx="280" cy="100" r="20" stroke="#166534" strokeWidth="3" fill="none" />
                    <path
                      d="M 200 180 Q 220 160 240 180"
                      stroke="#166534"
                      strokeWidth="3"
                      fill="none"
                    />
                  </svg>
                </div>

                {/* Fake video controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-full bg-white/30 rounded-full h-1">
                      <div className="w-1/3 bg-green-400 rounded-full h-1" />
                    </div>
                    <span className="text-white text-xs font-medium whitespace-nowrap">2:30</span>
                  </div>
                </div>
              </div>

              {/* Floating badges/features */}
              <div className="absolute -right-4 top-8 bg-white rounded-xl shadow-xl p-4 transform rotate-3 hover:rotate-0 transition-transform">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🤖</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">AI Assistant</p>
                    <p className="text-sm font-semibold text-gray-900">Wbudowany</p>
                  </div>
                </div>
              </div>

              <div className="absolute -left-4 bottom-20 bg-white rounded-xl shadow-xl p-4 transform -rotate-3 hover:rotate-0 transition-transform">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📐</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Wzory</p>
                    <p className="text-sm font-semibold text-gray-900">LaTeX</p>
                  </div>
                </div>
              </div>

              <div className="absolute -right-6 bottom-8 bg-white rounded-xl shadow-xl p-4 transform rotate-2 hover:rotate-0 transition-transform">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🔍</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">SmartSearch</p>
                    <p className="text-sm font-semibold text-gray-900">Wzory</p>
                  </div>
                </div>
              </div>

              <div className="absolute -left-6 top-16 bg-white rounded-xl shadow-xl p-4 transform -rotate-2 hover:rotate-0 transition-transform">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-2xl">👥</span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Współdzielność</p>
                    <p className="text-sm font-semibold text-gray-900">10+ osób</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dodatkowe rysunkowe elementy */}
            <div
              className="absolute -top-12 right-12 animate-bounce"
              style={{ animationDuration: '3s' }}
            >
              <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
                <path
                  d="M30 5 L35 20 L50 20 L38 30 L43 45 L30 37 L17 45 L22 30 L10 20 L25 20 Z"
                  fill="#fbbf24"
                  stroke="#f59e0b"
                  strokeWidth="2"
                />
              </svg>
            </div>

            <div
              className="absolute bottom-4 -left-8 animate-bounce"
              style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}
            >
              <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
                <circle cx="25" cy="25" r="20" fill="#a78bfa" stroke="#8b5cf6" strokeWidth="2" />
                <path
                  d="M25 15 L25 35 M15 25 L35 25"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Fala na dole sekcji */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0,64 C240,100 480,100 720,80 C960,60 1200,20 1440,40 L1440,120 L0,120 Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}
