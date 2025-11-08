'use client';

import { Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';

export default function WelcomeSection() {
  const { user } = useAuth();
  const [motivationalText, setMotivationalText] = useState('');

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Dzień dobry';
    if (hour < 18) return 'Witaj';
    return 'Dobry wieczór';
  };

  const getDayName = () => {
    const days = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
    return days[new Date().getDay()];
  };

  const getMotivationalText = () => {
    const hour = new Date().getHours();

    const morningHooks = [
      'Z kawą w dłoni i świeżym umysłem — czas podbić nowe tematy!',
      'Poranek idealny, żeby pokazać światu, kto rządzi tablicą!',
      'Kiedy inni jeszcze się budzą, Ty już tworzysz rozwiązania — szacun!',
      'Nowy dzień, nowa wiedza — dziś wszystko kliknie!',
      'Idealna pora, żeby umysł złapał rytm nauki jak metronom.'
    ];

    const dayHooks = [
      'Środek dnia? Perfekcyjny moment, żeby rozkręcić sesję!',
      'Czas działa na Twoją korzyść — tablica już czeka!',
      'Energii nie brakuje, więc ruszamy po nowe rekordy nauki!',
      'Mała przerwa od świata, duży krok w kierunku wiedzy!',
      'Kiedy nauka staje się zabawą — to znaczy, że jesteś na dobrej platformie!'
    ];

    const eveningHooks = [
      'Wieczór to moment ciszy i skupienia — idealny czas na korepetycje!',
      'Dzień prawie skończony, ale mózg wciąż głodny nowych pomysłów?',
      'Kto wieczorem się uczy, ten rano błyszczy!',
      'Zamiast serialu — dziś uczysz się jak prawdziwy mistrz!',
      'Spokojnie, dziś pójdzie gładko — tablica już gotowa!',
      'Dobre pomysły przychodzą po zmroku — czas na kreatywną sesję!',
      'Cisza, spokój i Ty — najlepszy zestaw do nauki.',
      'Dziś wieczór bez stresu — tylko czysta przyjemność z nauki!'
    ];

    let hooks;
    if (hour < 12) hooks = morningHooks;
    else if (hour < 18) hooks = dayHooks;
    else hooks = eveningHooks;

    const randomIndex = Math.floor(Math.random() * hooks.length);
    return hooks[randomIndex];
  };

  // 🔥 Losuj tekst po załadowaniu
  useEffect(() => {
    setMotivationalText(getMotivationalText());
  }, []);

  // 🔄 Odświeżanie po Ctrl+R lub F5
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+R lub F5
      if ((e.ctrlKey && e.key === 'r') || e.key === 'F5') {
        e.preventDefault(); // zatrzymuje przeładowanie strony
        setMotivationalText(getMotivationalText()); // losuje nowy tekst
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="w-full relative overflow-hidden bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 rounded-3xl px-8 py-12 mb-8 border border-gray-100 shadow-sm">
      
      {/* Dekoracyjne kółka w tle */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-green-200/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-200/20 rounded-full blur-3xl"></div>
      
      <div className="relative z-10">
        {/* Małe powitanie */}
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={20} className="text-green-600" />
          <span className="text-sm font-medium text-gray-600">
            {getGreeting()}, {user?.username || 'Użytkowniku'} • {getDayName()}
          </span>
        </div>

        {/* GŁÓWNY NAPIS */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
          <span className="bg-gradient-to-r from-black to-gray-700 bg-clip-text text-transparent">
            {motivationalText}
          </span>
        </h1>


        {/* Podpis - losowy tekst */}
        {/* <p className="text-gray-600 max-w-2xl italic transition-all duration-300 ease-in-out">
          {motivationalText}
        </p> */}
      </div>
    </div>
  );
}
