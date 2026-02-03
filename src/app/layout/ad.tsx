'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, Sparkles } from 'lucide-react';

const Ad = () => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Sprawdź czy użytkownik już zamknął baner (localStorage)
    const adClosed = localStorage.getItem('nowyRokSaleClosed');
    if (adClosed === 'true') {
      setIsVisible(false);
    }

    const calculateTimeLeft = () => {
      const targetDate = new Date('2026-01-01T00:00:00');
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        // Jak minie termin, ukryj baner
        setIsVisible(false);
      }
    };

    // Uruchom licznik
    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('nowyRokSaleClosed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="relative bg-gradient-to-r from-green-600 via-green-500 to-emerald-600 text-white overflow-hidden">
      {/* Animowane tło */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNCA0LTEuNzkgNC00em0wLTEwYzAtMi4yMS0xLjc5LTQtNC00cy00IDEuNzktNCA0IDEuNzkgNCA0IDQgNC0xLjc5IDQtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Lewa strona - Tekst główny */}
          <div className="flex items-center gap-3 flex-1">
            <div className="hidden sm:block">
              <Sparkles className="w-6 h-6 text-yellow-300 animate-pulse" />
            </div>

            <div className="text-center md:text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-yellow-300 text-green-900 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                  NowyRokSale 🎉
                </span>
                <span className="hidden sm:inline text-sm font-semibold">Limitowana oferta!</span>
              </div>
              <p className="text-sm md:text-base font-medium">
                Wejdź na{' '}
                <span className="font-bold underline decoration-yellow-300">wyższy poziom</span>{' '}
                prowadzenia korepetycji za jedyne{' '}
                <span className="text-yellow-300 font-bold text-lg">40 zł</span> miesięcznie!
              </p>
            </div>
          </div>

          {/* Środek - Countdown Timer */}
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-xs md:text-sm font-medium hidden sm:block">
              Oferta kończy się za:
            </span>

            <div className="flex gap-2">
              <TimeBox value={timeLeft.days} label="dni" />
              <TimeBox value={timeLeft.hours} label="godz" />
              <TimeBox value={timeLeft.minutes} label="min" />
              <TimeBox value={timeLeft.seconds} label="sek" />
            </div>
          </div>

          {/* Prawa strona - CTA + Close */}
          <div className="flex items-center gap-3">
            <Link href="/pricing">
              <button className="bg-white text-green-700 font-bold px-6 py-2 rounded-lg hover:bg-yellow-300 hover:text-green-900 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 whitespace-nowrap">
                Sprawdź ofertę →
              </button>
            </Link>

            {/* Przycisk zamknij */}
            <button
              onClick={handleClose}
              className="p-1 hover:bg-white/20 rounded-full transition-all duration-200"
              aria-label="Zamknij baner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Animowany pasek na dole */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-300 animate-pulse"></div>
    </div>
  );
};

// Komponent pojedynczego boxa z licznikiem
const TimeBox = ({ value, label }: { value: number; label: string }) => {
  return (
    <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2 md:px-3 py-1 min-w-[50px] md:min-w-[60px] text-center">
      <div className="text-lg md:text-2xl font-bold leading-none">
        {value.toString().padStart(2, '0')}
      </div>
      <div className="text-[10px] md:text-xs opacity-90 uppercase">{label}</div>
    </div>
  );
};

export default Ad;
