'use client';

import React from 'react';
import Link from 'next/link';

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  price: string;
  priceDetail?: string;
  popular?: boolean;
  features: PlanFeature[];
  buttonText: string;
  buttonLink: string;
}

const plans: Plan[] = [
  {
    name: "FREE",
    price: "€0",
    priceDetail: "/ miesiąc",
    features: [
      { text: "3 tablice jednocześnie", included: true },
      { text: "Podstawowa współpraca", included: true },
      { text: "SmartSearch - 20 wyszukań/miesiąc", included: true },
      { text: "Chat AI - 10 wiadomości/miesiąc", included: true },
      { text: "Konwersja LaTeX - 5/miesiąc", included: true },
      { text: "Współdzielenie tablicy", included: true },
      { text: "Biblioteka plików", included: false },
      { text: "Rozszerzenie do przeglądarki", included: false },
      { text: "Priorytetowe wsparcie", included: false },
    ],
    buttonText: "Zacznij za darmo",
    buttonLink: "/rejestracja"
  },
  {
    name: "PRO",
    price: "€12",
    priceDetail: "/ miesiąc",
    popular: true,
    features: [
      { text: "NIEOGRANICZONE tablice", included: true },
      { text: "Zaawansowana współpraca", included: true },
      { text: "SmartSearch - UNLIMITED", included: true },
      { text: "Chat AI - 500 wiadomości/miesiąc", included: true },
      { text: "Konwersja LaTeX - UNLIMITED", included: true },
      { text: "Współdzielenie tablicy", included: true },
      { text: "Biblioteka plików - 10GB", included: true },
      { text: "Rozszerzenie do przeglądarki", included: true },
      { text: "Export do PDF/PNG", included: true },
      { text: "Historia zmian (30 dni)", included: true },
      { text: "Priorytetowe wsparcie", included: true },
    ],
    buttonText: "Wypróbuj PRO - 14 dni za darmo",
    buttonLink: "/rejestracja?plan=pro"
  }
];

// Dane do tabeli porównawczej
const comparisonFeatures = [
  { name: "Liczba tablic", free: "3", pro: "∞" },
  { name: "Współpraca w czasie rzeczywistym", free: "✓", pro: "✓" },
  { name: "SmartSearch wzorów", free: "20/mies.", pro: "∞" },
  { name: "Chat AI", free: "10 msg/mies.", pro: "500 msg/mies." },
  { name: "Konwersja LaTeX", free: "5/mies.", pro: "∞" },
  { name: "Współdzielenie tablicy", free: "✓", pro: "✓" },
  { name: "Biblioteka plików", free: "✗", pro: "10 GB" },
  { name: "Rozszerzenie Chrome/Firefox", free: "✗", pro: "✓" },
  { name: "Export do PDF/PNG", free: "✗", pro: "✓" },
  { name: "Historia zmian", free: "✗", pro: "30 dni" },
  { name: "Współdzielenie z maksymalną liczbą osób", free: "5 osób", pro: "∞" },
  { name: "Własne szablony", free: "✗", pro: "✓" },
  { name: "Nagrywanie sesji", free: "✗", pro: "✓" },
  { name: "Priorytetowe wsparcie", free: "✗", pro: "✓" },
];

export default function PricingSection() {
  return (
    <section
    id="pricing" 
    className="relative bg-[#f5f3ef] overflow-hidden py-20 px-4">
      
      {/* SIATKA KROPEK W TLE */}
      <div 
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: `radial-gradient(circle, #c4bfb5 1.5px, transparent 1.5px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* DEKORACJE MATEMATYCZNE I ELEMENTY TABLICY */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="relative max-w-screen-2xl mx-auto h-full">
          
          {/* WZÓR 1 - Górny lewy róg */}
          <div className="absolute left-4 top-12 rotate-12">
            <svg width="140" height="80" viewBox="0 0 140 80">
              <text x="10" y="40" fill="#3b82f6" fontSize="28" fontFamily="system-ui" fontWeight="600">
                x² + y² = r²
              </text>
              <circle cx="70" cy="40" r="35" stroke="#3b82f6" strokeWidth="2" fill="none" opacity="0.3"/>
            </svg>
          </div>

          {/* WZÓR 2 - Górny prawy róg */}
          <div className="absolute right-6 top-16 -rotate-8">
            <svg width="120" height="70" viewBox="0 0 120 70">
              <text x="10" y="35" fill="#ec4899" fontSize="24" fontFamily="system-ui" fontWeight="600">
                ∫ f(x)dx
              </text>
              <path d="M 5 45 Q 60 40, 115 48" stroke="#ec4899" strokeWidth="2" fill="none"/>
            </svg>
          </div>

          {/* WZÓR 3 - POPRAWIONY PITAGORAS */}
          <div className="absolute left-2 top-[35%] rotate-6">
            <svg width="130" height="70" viewBox="0 0 130 70">
              <text x="10" y="40" fill="#f59e0b" fontSize="26" fontFamily="system-ui" fontWeight="600">
                a² + b² = c²
              </text>
            </svg>
          </div>

          {/* WZÓR 4 - Środek prawy */}
          <div className="absolute right-4 top-[42%] -rotate-10">
            <svg width="130" height="70" viewBox="0 0 130 70">
              <text x="10" y="40" fill="#8b5cf6" fontSize="28" fontFamily="system-ui" fontWeight="600">
                sin²x + cos²x
              </text>
            </svg>
          </div>

          {/* WZÓR 5 - Dolny lewy */}
          <div className="absolute left-6 bottom-24 -rotate-6">
            <svg width="110" height="65" viewBox="0 0 110 65">
              <text x="10" y="35" fill="#14b8a6" fontSize="24" fontFamily="system-ui" fontWeight="600">
                π ≈ 3.14159
              </text>
            </svg>
          </div>

          {/* WZÓR 6 - Dolny prawy */}
          <div className="absolute right-5 bottom-20 rotate-8">
            <svg width="100" height="60" viewBox="0 0 100 60">
              <text x="10" y="35" fill="#10b981" fontSize="22" fontFamily="system-ui" fontWeight="600">
                E = mc²
              </text>
              <rect x="5" y="10" width="90" height="45" stroke="#10b981" strokeWidth="2" fill="none" rx="5" opacity="0.3"/>
            </svg>
          </div>

          {/* WZÓR 7 - Nowy - lewy środek górny */}
          <div className="absolute left-8 top-[22%] -rotate-5">
            <svg width="100" height="60" viewBox="0 0 100 60">
              <text x="10" y="35" fill="#ef4444" fontSize="24" fontFamily="system-ui" fontWeight="600">
                √(x + y)
              </text>
            </svg>
          </div>

          {/* WZÓR 8 - Nowy - prawy górny */}
          <div className="absolute right-8 top-[28%] rotate-12">
            <svg width="120" height="65" viewBox="0 0 120 65">
              <text x="10" y="38" fill="#6366f1" fontSize="26" fontFamily="system-ui" fontWeight="600">
                f(x) = ax + b
              </text>
            </svg>
          </div>

          {/* WZÓR 9 - Nowy - lewy dolny */}
          <div className="absolute left-4 bottom-[45%] rotate-8">
            <svg width="110" height="60" viewBox="0 0 110 60">
              <text x="10" y="35" fill="#a855f7" fontSize="22" fontFamily="system-ui" fontWeight="600">
                log₂(8) = 3
              </text>
            </svg>
          </div>

          {/* WZÓR 10 - Nowy - prawy środek */}
          <div className="absolute right-6 top-[58%] -rotate-7">
            <svg width="100" height="60" viewBox="0 0 100 60">
              <text x="10" y="35" fill="#f97316" fontSize="24" fontFamily="system-ui" fontWeight="600">
                Σ n = 1+2+3
              </text>
            </svg>
          </div>

          {/* WZÓR 11 - Nowy - lewy górny 2 */}
          <div className="absolute left-12 top-[12%] rotate-10">
            <svg width="90" height="55" viewBox="0 0 90 55">
              <text x="10" y="32" fill="#06b6d4" fontSize="20" fontFamily="system-ui" fontWeight="600">
                tan α = sin/cos
              </text>
            </svg>
          </div>

          {/* WZÓR 12 - Nowy - prawy dolny */}
          <div className="absolute right-10 bottom-[38%] rotate-6">
            <svg width="100" height="60" viewBox="0 0 100 60">
              <text x="10" y="35" fill="#84cc16" fontSize="22" fontFamily="system-ui" fontWeight="600">
                lim x→∞ = ?
              </text>
            </svg>
          </div>

          {/* STRZAŁKA RYSOWANA 1 */}
          <div className="absolute left-[8%] top-[32%]">
            <svg width="80" height="60" viewBox="0 0 80 60">
              <path d="M 10 50 Q 40 10, 70 30" stroke="#ef4444" strokeWidth="3" fill="none" strokeLinecap="round"/>
              <path d="M 60 25 L 70 30 L 65 38" stroke="#ef4444" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* STRZAŁKA RYSOWANA 2 */}
          <div className="absolute right-[10%] top-[52%]">
            <svg width="70" height="50" viewBox="0 0 70 50">
              <path d="M 60 10 Q 40 30, 10 40" stroke="#6366f1" strokeWidth="3" fill="none" strokeLinecap="round"/>
              <path d="M 18 35 L 10 40 L 12 48" stroke="#6366f1" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* STRZAŁKA RYSOWANA 3 - Nowa */}
          <div className="absolute left-[6%] bottom-[35%]">
            <svg width="75" height="55" viewBox="0 0 75 55">
              <path d="M 10 10 Q 35 40, 65 45" stroke="#8b5cf6" strokeWidth="3" fill="none" strokeLinecap="round"/>
              <path d="M 55 42 L 65 45 L 62 52" stroke="#8b5cf6" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* POINTER 1 - Anna (górny lewy - DALEJ) */}
          <div className="absolute left-[8%] top-[20%] animate-bounce" style={{ animationDuration: '3s' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3 L10 20 L12 12 L20 10 Z" fill="#3b82f6" stroke="#1e40af" strokeWidth="1.5"/>
            </svg>
            <div className="mt-1 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
              Anna
            </div>
          </div>

          {/* POINTER 2 - Marek (środek prawy - DALEJ) */}
          <div className="absolute right-[6%] top-[38%] animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3 L10 20 L12 12 L20 10 Z" fill="#ec4899" stroke="#be185d" strokeWidth="1.5"/>
            </svg>
            <div className="mt-1 bg-pink-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
              Marek
            </div>
          </div>

          {/* POINTER 3 - Zosia (dolny środek lewy - DALEJ) */}
          <div className="absolute left-[10%] bottom-[28%] animate-bounce" style={{ animationDuration: '2.8s', animationDelay: '1s' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3 L10 20 L12 12 L20 10 Z" fill="#10b981" stroke="#047857" strokeWidth="1.5"/>
            </svg>
            <div className="mt-1 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
              Zosia
            </div>
          </div>

          {/* POINTER 4 - Kuba (prawy górny - DALEJ) */}
          <div className="absolute right-[8%] top-[24%] animate-bounce" style={{ animationDuration: '3.2s', animationDelay: '0.3s' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3 L10 20 L12 12 L20 10 Z" fill="#f59e0b" stroke="#d97706" strokeWidth="1.5"/>
            </svg>
            <div className="mt-1 bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
              Kuba
            </div>
          </div>

          {/* POINTER 5 - Ola (nowy - lewy dolny) */}
          <div className="absolute left-[6%] bottom-[42%] animate-bounce" style={{ animationDuration: '2.6s', animationDelay: '0.7s' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3 L10 20 L12 12 L20 10 Z" fill="#8b5cf6" stroke="#6b21a8" strokeWidth="1.5"/>
            </svg>
            <div className="mt-1 bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
              Ola
            </div>
          </div>

          {/* POINTER 6 - Tomek (nowy - prawy dolny) */}
          <div className="absolute right-[7%] bottom-[32%] animate-bounce" style={{ animationDuration: '3.1s', animationDelay: '0.4s' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3 L10 20 L12 12 L20 10 Z" fill="#14b8a6" stroke="#0f766e" strokeWidth="1.5"/>
            </svg>
            <div className="mt-1 bg-teal-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
              Tomek
            </div>
          </div>

          {/* POINTER 7 - Ania (nowy - lewy górny środek) */}
          <div className="absolute left-[5%] top-[28%] animate-bounce" style={{ animationDuration: '2.9s', animationDelay: '0.2s' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3 L10 20 L12 12 L20 10 Z" fill="#ef4444" stroke="#b91c1c" strokeWidth="1.5"/>
            </svg>
            <div className="mt-1 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
              Ania
            </div>
          </div>

          {/* POINTER 8 - Bartek (nowy - prawy środek górny) */}
          <div className="absolute right-[9%] top-[48%] animate-bounce" style={{ animationDuration: '2.7s', animationDelay: '0.8s' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 3 L10 20 L12 12 L20 10 Z" fill="#6366f1" stroke="#4338ca" strokeWidth="1.5"/>
            </svg>
            <div className="mt-1 bg-indigo-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg whitespace-nowrap">
              Bartek
            </div>
          </div>

          {/* DOODLE - Podkreślenie */}
          <div className="absolute left-[12%] bottom-[48%]">
            <svg width="100" height="20" viewBox="0 0 100 20">
              <path d="M 5 10 Q 50 5, 95 12" stroke="#8b5cf6" strokeWidth="3" fill="none" strokeLinecap="round"/>
            </svg>
          </div>

          {/* DOODLE - Okrąg */}
          <div className="absolute right-[11%] bottom-[45%]">
            <svg width="60" height="60" viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="25" stroke="#14b8a6" strokeWidth="3" fill="none" opacity="0.6"/>
            </svg>
          </div>

          {/* DOODLE - Kwadrat (nowy) */}
          <div className="absolute left-[7%] top-[40%]">
            <svg width="50" height="50" viewBox="0 0 50 50">
              <rect x="10" y="10" width="30" height="30" stroke="#f59e0b" strokeWidth="2.5" fill="none" opacity="0.5"/>
            </svg>
          </div>

          {/* DOODLE - Trójkąt (nowy) */}
          <div className="absolute right-[12%] top-[62%]">
            <svg width="55" height="55" viewBox="0 0 55 55">
              <path d="M 27.5 10 L 45 45 L 10 45 Z" stroke="#ec4899" strokeWidth="2.5" fill="none" opacity="0.5"/>
            </svg>
          </div>
        </div>
      </div>

      {/* GŁÓWNA ZAWARTOŚĆ */}
      <div className="relative max-w-6xl mx-auto z-10">
        
        {/* TYTUŁ SEKCJI */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Wybierz{' '}
            <span className="relative inline-block">
              plan dla siebie
              <svg 
                className="absolute -bottom-2 left-0 w-full" 
                height="12" 
                viewBox="0 0 300 12" 
                fill="none"
              >
                <path 
                  d="M2 8C75 4 150 3 225 6C260 7 290 5 298 7" 
                  stroke="#4ade80" 
                  strokeWidth="3" 
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h2>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mt-6">
            Zacznij za darmo, przejdź na PRO gdy jesteś gotowy
          </p>
        </div>

        {/* KARTY CENNIKOWE */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {plans.map((plan, index) => (
            <div key={plan.name} className="relative">
              
              {/* Badge "NAJPOPULARNIEJSZY" */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                  <div className="bg-green-400 text-gray-900 px-6 py-2 rounded-full font-bold text-sm shadow-lg border-3 border-gray-900">
                    ⭐ NAJPOPULARNIEJSZY
                  </div>
                </div>
              )}

              {/* KARTA Z RYSOWANYM KONTUREM */}
              <div className="relative bg-white p-8 rounded-lg shadow-xl">
                
                {/* Ręcznie rysowany kontur */}
                <svg 
                  className="absolute inset-0 w-full h-full pointer-events-none" 
                  style={{ filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.1))' }}
                >
                  <rect 
                    x="3" 
                    y="3" 
                    width="calc(100% - 6px)" 
                    height="calc(100% - 6px)" 
                    rx="12"
                    fill="none"
                    stroke={plan.popular ? "#4ade80" : "#6b7280"}
                    strokeWidth={plan.popular ? "5" : "3"}
                  />
                  {/* Dodatkowe linie dla efektu "szkicu" */}
                  {plan.popular && (
                    <rect 
                      x="6" 
                      y="6" 
                      width="calc(100% - 12px)" 
                      height="calc(100% - 12px)" 
                      rx="10"
                      fill="none"
                      stroke="#4ade80"
                      strokeWidth="2"
                      opacity="0.3"
                    />
                  )}
                </svg>

                {/* Zawartość karty */}
                <div className="relative z-10">
                  
                  {/* Nazwa planu */}
                  <h3 className="text-3xl font-black text-gray-900 mb-4">
                    {plan.name}
                  </h3>

                  {/* Cena */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black text-gray-900">
                        {plan.price}
                      </span>
                      <span className="text-xl text-gray-600">
                        {plan.priceDetail}
                      </span>
                    </div>
                    {plan.name === "PRO" && (
                      <p className="text-sm text-gray-500 mt-2">
                        lub €10/mies. płatne rocznie
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        {/* Ręcznie rysowana checkmark/X */}
                        {feature.included ? (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                            <path 
                              d="M5 13 L9 17 L19 7" 
                              stroke="#4ade80" 
                              strokeWidth="3" 
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                            <path 
                              d="M6 6 L18 18 M18 6 L6 18" 
                              stroke="#ef4444" 
                              strokeWidth="3" 
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                        <span className={`text-base ${feature.included ? 'text-gray-700' : 'text-gray-400'}`}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Button */}
                  <Link href={plan.buttonLink}>
                    <button 
                      className={`relative w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-300 transform hover:scale-105 ${
                        plan.popular 
                          ? 'bg-green-400 hover:bg-green-500 text-gray-900 shadow-lg' 
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                      }`}
                    >
                      {/* Ręcznie rysowany kontur buttona */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        <rect 
                          x="3" 
                          y="3" 
                          width="calc(100% - 6px)" 
                          height="calc(100% - 6px)" 
                          rx="12"
                          fill="none"
                          stroke={plan.popular ? "#166534" : "#374151"}
                          strokeWidth="3"
                        />
                      </svg>
                      <span className="relative z-10">{plan.buttonText}</span>
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Link do wersji dla szkół */}
        <div className="text-center mb-16">
          <p className="text-gray-600">
            Potrzebujesz wersji dla szkoły?{' '}
            <a href="/kontakt" className="text-green-600 font-semibold hover:underline">
              Skontaktuj się z nami
            </a>
          </p>
        </div>

        {/* TABELA PORÓWNAWCZA */}
        <div className="mt-20">
          <h3 className="text-3xl font-bold text-gray-900 text-center mb-10">
            Szczegółowe porównanie
          </h3>

          {/* Tabela w rysunkowym stylu */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden relative">
            
            {/* Ręcznie rysowany kontur tabeli */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
              <rect 
                x="3" 
                y="3" 
                width="calc(100% - 6px)" 
                height="calc(100% - 6px)" 
                rx="16"
                fill="none"
                stroke="#6b7280"
                strokeWidth="4"
              />
            </svg>

            <div className="overflow-x-auto relative z-10">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left p-4 font-bold text-gray-900">Funkcja</th>
                    <th className="text-center p-4 font-bold text-gray-900">FREE</th>
                    <th className="text-center p-4 font-bold text-green-600 bg-green-50">PRO</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonFeatures.map((feature, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-700">{feature.name}</td>
                      <td className="p-4 text-center text-gray-600">{feature.free}</td>
                      <td className="p-4 text-center text-gray-900 font-semibold bg-green-50/50">{feature.pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CTA na końcu */}
        <div className="text-center mt-16">
          <p className="text-2xl font-bold text-gray-900 mb-4">
            Gotowy żeby zacząć? 🚀
          </p>
          <Link href="/register">
            <button className="relative bg-green-400 hover:bg-green-500 text-gray-900 font-bold text-xl px-12 py-5 rounded-xl shadow-xl transition-all duration-300 transform hover:scale-105">
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <rect 
                  x="3" 
                  y="3" 
                  width="calc(100% - 6px)" 
                  height="calc(100% - 6px)" 
                  rx="12"
                  fill="none"
                  stroke="#166534"
                  strokeWidth="4"
                />
              </svg>
              <span className="relative z-10">Wypróbuj EasyLesson za darmo</span>
            </button>
          </Link>
        </div>

      </div>

      {/* Fala na dole sekcji */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path 
            d="M0,40 C240,60 480,60 720,50 C960,40 1200,30 1440,35 L1440,80 L0,80 Z" 
            fill="white"
          />
        </svg>
      </div>
    </section>
  );
}