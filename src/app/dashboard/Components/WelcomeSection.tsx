'use client';

import { Sparkles } from 'lucide-react';

export default function WelcomeSection() {
  // Pobierz godzinę dla odpowiedniego powitania
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Dzień dobry';
    if (hour < 18) return 'Witaj';
    return 'Dobry wieczór';
  };

  // Pobierz dzień tygodnia
  const getDayName = () => {
    const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    return days[new Date().getDay()];
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 rounded-3xl p-12 mb-8 border border-gray-100 shadow-sm">
      
      {/* Dekoracyjne kółka w tle */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-green-200/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-200/20 rounded-full blur-3xl"></div>
      
      <div className="relative z-10">
        {/* Małe powitanie */}
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={20} className="text-green-600" />
          <span className="text-sm font-medium text-gray-600">
            {getGreeting()}, Nazwa Uzytkownika • {getDayName()}
          </span>
        </div>

        {/* GŁÓWNY NAPIS - duży i wyraźny w jednej linii */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
          Czego się dziś{' '}
            <span className=" mt-2 bg-gradient-to-r from-green-500/80 to-blue-500/80 bg-clip-text text-transparent">            
                pouczmy?
          </span>
        </h1>

        {/* Podpis */}
        <p className=" text-gray-600 max-w-2xl">
          Wybierz szablon lub rozpocznij nową sesję ze swoimi uczniami
        </p>
      </div>
    </div>
  );
}