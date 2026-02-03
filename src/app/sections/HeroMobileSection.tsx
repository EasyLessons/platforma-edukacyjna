'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, MessageSquare, BookOpen, Users } from 'lucide-react';

export default function HeroMobileSection() {
  return (
    <section className="relative bg-[#f5f3ef] overflow-hidden lg:hidden">
      {/* Tło z kropkami jak Miro - bardziej widoczne */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: `radial-gradient(circle, #c4bfb5 1.5px, transparent 1.5px)`,
          backgroundSize: '20px 20px',
        }}
      />

      <div className="relative max-w-2xl mx-auto px-4 py-12 text-center">
        {/* Odznaka */}
        <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
          <span className="animate-pulse">⚡</span>
          Ucz się wszędzie, gdzie jesteś
        </div>

        {/* Główny nagłówek - mobile friendly */}
        <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-4">
          Korepetycje online
          <br />
          <span className="text-green-600">w Twojej kieszeni</span>
        </h1>

        {/* Opis - focus na mobile benefits */}
        <p className="text-lg text-gray-600 leading-relaxed mb-8">
          Nauka z AI, czat z korepetytorem i dostęp do wzorów matematycznych. Wszystko na
          wyciągnięcie ręki - bez skomplikowanych programów.
        </p>

        {/* CTA */}
        <Link href="/register">
          <button className="w-full sm:w-auto px-8 py-4 bg-green-400 hover:bg-green-500 text-gray-900 text-lg font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl mb-8">
            Zacznij za darmo →
          </button>
        </Link>

        {/* Mobile-focused features - karty */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          {/* Feature 1 */}
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Zap className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Błyskawiczny start</h3>
            <p className="text-xs text-gray-600">Dołącz do lekcji jednym kliknięciem</p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm mb-1">AI Chat</h3>
            <p className="text-xs text-gray-600">Zadawaj pytania, otrzymuj odpowiedzi</p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm mb-1">SmartSearch</h3>
            <p className="text-xs text-gray-600">Szybki dostęp do wzorów</p>
          </div>

          {/* Feature 4 */}
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm mb-1">Live Session</h3>
            <p className="text-xs text-gray-600">Współpraca w czasie rzeczywistym</p>
          </div>
        </div>

        {/* Social proof - mobile optimized */}
        <div className="flex flex-col items-center gap-3 pt-4">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 border-3 border-[#f5f3ef] flex items-center justify-center text-white font-bold text-sm"
              >
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600">
            <span className="font-bold text-gray-900">1,200+</span> korepetytorów ufa EasyLesson
          </p>
        </div>

        {/* Mobile app badge placeholders */}
        <div className="mt-8 pt-8 border-t border-gray-300">
          <p className="text-xs text-gray-500 mb-4">Wkrótce również jako aplikacja mobilna</p>
          <div className="flex justify-center gap-3">
            <div className="bg-gray-900 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2">
              <span>📱</span> App Store
            </div>
            <div className="bg-gray-900 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2">
              <span>🤖</span> Google Play
            </div>
          </div>
        </div>

        {/* Dekoracyjne elementy */}
        <div className="absolute top-10 right-4 animate-bounce" style={{ animationDuration: '3s' }}>
          <div className="w-8 h-8 bg-yellow-400 rounded-full opacity-60" />
        </div>
        <div
          className="absolute bottom-20 left-4 animate-bounce"
          style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}
        >
          <div className="w-6 h-6 bg-blue-400 rounded-full opacity-60" />
        </div>
      </div>

      {/* Fala na dole */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M0,40 C240,60 480,60 720,50 C960,40 1200,20 1440,30 L1440,80 L0,80 Z"
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}
