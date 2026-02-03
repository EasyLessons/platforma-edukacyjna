'use client';

import React, { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: 'Czy muszę się znać na technologii?',
    answer:
      'Nie! EasyLesson jest prosty jak notes, ale potężny jak laboratorium. Jeśli potrafisz korzystać z Facebooka, poradzisz sobie z EasyLesson.',
  },
  {
    question: 'Czy uczeń musi mieć konto?',
    answer:
      'W planie Free - tak, uczeń musi się zarejestrować. W planie Pro - nie, może dołączyć przez link bez zakładania konta!',
  },
  {
    question: 'Co jeśli skończą mi się wiadomości AI?',
    answer:
      'Możesz dokupić pakiet 100 wiadomości za €3. Lub przejść na plan Pro i mieć 500 wiadomości miesięcznie!',
  },
  {
    question: 'Czy mogę anulować w każdej chwili?',
    answer:
      'Tak! Nie ma żadnych długoterminowych zobowiązań. Anulujesz subskrypcję kiedy chcesz, bez dodatkowych opłat.',
  },
  {
    question: 'Jakie przedmioty są wspierane?',
    answer:
      'Wszystkie! Ale najlepiej sprawdza się w matematyce, fizyce, chemii i innych przedmiotach ze wzorami. SmartSearch ma tysiące wzorów matematycznych i fizycznych.',
  },
  {
    question: 'Czy mogę używać EasyLesson na telefonie?',
    answer:
      'Tak! EasyLesson działa w przeglądarce, więc możesz korzystać z telefonu, tabletu lub komputera. Najlepsze doświadczenie jest na tablecie lub komputerze.',
  },
  {
    question: 'Czy dane są bezpieczne?',
    answer:
      'Absolutnie! Używamy szyfrowania SSL, a wszystkie dane są przechowywane bezpiecznie w chmurze. Nigdy nie udostępniamy Twoich danych osobowych.',
  },
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="relative bg-[#f5f3ef] py-20 px-4 overflow-hidden">
      {/* SIATKA KROPEK W TLE */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage: `radial-gradient(circle, #c4bfb5 1.5px, transparent 1.5px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Dekoracje pytajników */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="relative max-w-screen-2xl mx-auto h-full">
          <div className="absolute left-[10%] top-[15%] text-8xl text-blue-500">?</div>
          <div className="absolute right-[15%] top-[20%] text-7xl text-pink-500">?</div>
          <div className="absolute left-[15%] bottom-[25%] text-9xl text-purple-500">?</div>
          <div className="absolute right-[10%] bottom-[30%] text-8xl text-green-500">?</div>
        </div>
      </div>

      {/* GŁÓWNA ZAWARTOŚĆ */}
      <div className="relative max-w-4xl mx-auto z-10">
        {/* TYTUŁ SEKCJI */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Masz pytania?{' '}
            <span className="relative inline-block">
              Mamy odpowiedzi!
              <svg
                className="absolute -bottom-2 left-0 w-full"
                height="12"
                viewBox="0 0 350 12"
                fill="none"
              >
                <path
                  d="M2 8C90 4 180 3 270 6C310 7 340 5 348 7"
                  stroke="#4ade80"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h2>
          <p className="text-lg text-gray-600 mt-6">Kliknij na pytanie żeby zobaczyć odpowiedź</p>
        </div>

        {/* LISTA FAQ */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div key={index} className="relative">
              {/* Karta FAQ */}
              <div className="relative bg-white rounded-xl shadow-lg overflow-hidden">
                {/* Rysowany kontur */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <rect
                    x="3"
                    y="3"
                    width="calc(100% - 6px)"
                    height="calc(100% - 6px)"
                    rx="12"
                    fill="none"
                    stroke={openIndex === index ? '#4ade80' : '#94a3b8'}
                    strokeWidth="3"
                  />
                </svg>

                {/* Pytanie - klikalny header */}
                <button
                  onClick={() => toggleFAQ(index)}
                  className="relative z-10 w-full text-left p-6 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <span className="text-2xl flex-shrink-0">
                      {openIndex === index ? '❓' : '❔'}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900">{faq.question}</h3>
                  </div>

                  {/* Strzałka */}
                  <svg
                    className={`w-6 h-6 text-gray-600 transition-transform duration-300 flex-shrink-0 ${
                      openIndex === index ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Odpowiedź - rozwijana */}
                <div
                  className={`relative z-10 overflow-hidden transition-all duration-300 ${
                    openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 pb-6 pl-16">
                    <p className="text-gray-700 text-lg leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Dodatkowy tekst */}
        <div className="text-center mt-12 bg-white/80 backdrop-blur-sm rounded-2xl p-6 border-2 border-gray-200">
          <p className="text-gray-600">
            Nie znalazłeś odpowiedzi?{' '}
            <a href="/kontakt" className="text-green-600 font-semibold hover:underline">
              Skontaktuj się z nami
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
