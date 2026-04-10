'use client';

import React from 'react';
import Link from 'next/link';

export default function AktualnosciPage() {
  const articles = [
    {
      id: 1,
      link: "/aktualnosci",
      img: "/resources/Aktualnosci/Nowosc.jpg",
      imgAlt: "Nowe narzędzia matematyczne",
      tagColor: "bg-blue-100 text-blue-700",
      tag: "Nowe funkcje",
      date: "2 dni temu",
      title: "Zaawansowane narzędzia matematyczne",
      desc: "Dodaliśmy nowy kalkulator naukowy, rysowanie funkcji matematycznych i zaawansowany edytor równań. Idealne dla nauczycieli matematyki!",
      delay: "0ms"
    },
    {
      id: 2,
      link: "/aktualnosci",
      img: "/resources/Aktualnosci/Nauczyciel.jpg",
      imgAlt: "AI Tutor - lepsze odpowiedzi",
      tagColor: "bg-purple-100 text-purple-700",
      tag: "AI",
      date: "5 dni temu",
      title: "AI Tutor - lepsze odpowiedzi i kontekst",
      desc: "Ulepszyliśmy algorytm AI Tutora! Teraz jeszcze lepiej rozumie kontekst pytań i udziela bardziej szczegółowych odpowiedzi.",
      delay: "50ms"
    },
    {
      id: 3,
      link: "/aktualnosci",
      img: "/resources/Aktualnosci/Wspolbieznosc.jpg",
      imgAlt: "Współpraca w czasie rzeczywistym",
      tagColor: "bg-green-100 text-green-700",
      tag: "Współpraca",
      date: "1 tydzień temu",
      title: "Współpraca w czasie rzeczywistym do 50 osób",
      desc: "Zwiększyliśmy limit współpracy realtime! Teraz w planie Premium do 50 osób może pracować jednocześnie na tablicy.",
      delay: "100ms"
    },
    {
      id: 4,
      link: "/aktualnosci",
      img: "/resources/Aktualnosci/Nowosc.jpg",
      imgAlt: "Zaktualizowany SmartSearch",
      tagColor: "bg-orange-100 text-orange-700",
      tag: "Technologia",
      date: "2 tygodnie temu",
      title: "Znajduj zadania w kilka sekund",
      desc: "Nasz przebudowany silnik wyszukiwania SmartSearch przyspiesza odnajdywanie zadań maturalnych aż o 80%. Oszczędność czasu jakiej nie było.",
      delay: "150ms"
    },
    {
      id: 5,
      link: "/aktualnosci",
      img: "/resources/Aktualnosci/Nauczyciel.jpg",
      imgAlt: "Nowe Arkusze",
      tagColor: "bg-pink-100 text-pink-700",
      tag: "Baza Wiedzy",
      date: "1 miesiąc temu",
      title: "Zaktualizowana baza zadań CKE",
      desc: "Dodaliśmy ponad 2000 nowych zadań ułożonych według tegorocznego standardu egzaminacyjnego, kompletne z rozwiązaniami.",
      delay: "200ms"
    },
    {
      id: 6,
      link: "/aktualnosci",
      img: "/resources/Aktualnosci/Wspolbieznosc.jpg",
      imgAlt: "Zapisy do nauczycieli",
      tagColor: "bg-indigo-100 text-indigo-700",
      tag: "Organizacja",
      date: "2 miesiące temu",
      title: "Ulepszony harmonogram",
      desc: "Intuicyjny kalendarz pozwala łatwiej synchronizować lekcje między Tobą a uczniami bez opuszczania platformy.",
      delay: "250ms"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 pt-28 pb-16">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="mb-12 text-center md:text-left">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">Aktualności EasyLesson</h1>
          <p className="text-xl text-gray-600 max-w-2xl">
            Najnowiej wprowadzone funkcje platformy i najświeższe opublikowane dla Was materiały i ulepszenia
          </p>
        </div>

        {/* Grid z artykułami (wzięty ze stylu dropdownu megamenu Aktualności) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {articles.map((item) => (
            <Link
              key={item.id}
              href={item.link}
              className="parallax-container group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-200 animate-fadeInUp flex flex-col"
              style={{ animationDelay: item.delay }}
            >
              <div className="aspect-video relative overflow-hidden">
                <img
                  src={item.img}
                  alt={item.imgAlt}
                  className="parallax-image w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-1 ${item.tagColor} text-xs font-semibold rounded`}>
                    {item.tag}
                  </span>
                  <span className="text-xs text-gray-500">{item.date}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-indigo-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
