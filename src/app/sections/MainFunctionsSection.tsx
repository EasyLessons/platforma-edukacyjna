import React from 'react';

interface FeatureCard {
  title: string;
  description: string;
  imageAlt: string;
}

const features: FeatureCard[] = [
  {
    title: 'Inteligentna tablica',
    description:
      'Rysuj, pisz, wstawiaj obrazy - wszystko w jednym miejscu. Idealna do wyjaśniania skomplikowanych zagadnień.',
    imageAlt: 'Screenshot tablicy w akcji',
  },
  {
    title: 'SmartSearch wzorów',
    description:
      'Szybki dostęp do wzorów matematycznych i fizycznych. Znajdź to czego potrzebujesz w sekundę.',
    imageAlt: 'Screenshot wyszukiwarki wzorów',
  },
  {
    title: 'AI Assistant',
    description:
      'Chat który przyjmuje zdjęcia i pomaga z zadaniami w czasie rzeczywistym. Jak dodatkowy korepetytor zawsze pod ręką.',
    imageAlt: 'Screenshot chatu z AI',
  },
  {
    title: 'LaTeX na wyciągnięcie ręki',
    description: 'Automatyczna konwersja równań do LaTeX. Piękne wzory matematyczne bez wysiłku.',
    imageAlt: 'Screenshot konwersji LaTeX',
  },
  {
    title: 'Współdzielenie w czasie rzeczywistym',
    description:
      'Uczeń i korepetytor widzą to samo jednocześnie. Zero opóźnień, maksymalna efektywność.',
    imageAlt: 'Screenshot współpracy w czasie rzeczywistym',
  },
  {
    title: 'Biblioteka plików',
    description:
      'Dostęp do swoich materiałów w każdej chwili. Wszystkie notatki i zadania w jednym miejscu. (Pro)',
    imageAlt: 'Screenshot biblioteki plików',
  },
];

export default function MainFunctionsSection() {
  return (
    <section className="relative py-20 px-4 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 overflow-hidden">
      {/* SIATKA KROPEK W TLE - PATTERN */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle, #7597c6ff 2px, transparent 2px)`,
          backgroundSize: '30px 30px',
        }}
      />

      {/* DEKORACJE MATEMATYCZNE W TLE */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <div className="relative max-w-screen-2xl mx-auto h-full">
          {/* Wzór po lewej */}
          <svg
            className="absolute left-8 top-20 rotate-12"
            width="120"
            height="60"
            viewBox="0 0 120 60"
          >
            <text
              x="10"
              y="35"
              fill="#3b82f6"
              fontSize="20"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
            >
              f(x) = y
            </text>
          </svg>

          {/* Wzór po prawej */}
          <svg
            className="absolute right-8 top-32 -rotate-12"
            width="140"
            height="70"
            viewBox="0 0 140 70"
          >
            <text
              x="10"
              y="40"
              fill="#a855f7"
              fontSize="22"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
            >
              ∫ dx = x + C
            </text>
          </svg>

          {/* Wzór na dole po lewej */}
          <svg
            className="absolute left-12 bottom-40 -rotate-6"
            width="100"
            height="60"
            viewBox="0 0 100 60"
          >
            <text
              x="10"
              y="35"
              fill="#ec4899"
              fontSize="24"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
            >
              x² + y²
            </text>
          </svg>

          {/* Wzór na dole po prawej */}
          <svg
            className="absolute right-16 bottom-32 rotate-8"
            width="130"
            height="65"
            viewBox="0 0 130 65"
          >
            <text
              x="10"
              y="38"
              fill="#14b8a6"
              fontSize="20"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontWeight="600"
            >
              sin θ + cos θ
            </text>
          </svg>
        </div>
      </div>

      {/* GŁÓWNA ZAWARTOŚĆ */}
      <div className="relative max-w-7xl mx-auto z-10">
        {/* TYTUŁ SEKCJI */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Wszystko czego potrzebujesz w jednym miejscu
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Profesjonalne narzędzia do nauki online, które działają tak jak powinny
          </p>

          {/* Ozdobna linia pod tytułem */}
          <svg className="mx-auto mt-6" width="200" height="8" viewBox="0 0 200 8">
            <path
              d="M 10 4 Q 100 1, 190 4"
              stroke="#3b82f6"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* SIATKA Z KARTAMI FUNKCJI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 border-2 border-gray-100"
            >
              {/* PLACEHOLDER NA SCREENSHOT */}
              <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border-b-4 border-gray-300">
                <div className="text-center">
                  <div className="w-20 h-20 mx-auto mb-3 rounded-lg bg-white/50 flex items-center justify-center shadow-sm">
                    <svg
                      className="w-10 h-10 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm text-gray-500 font-medium">Screenshot wkrótce</span>
                </div>

                {/* Numer karty w rogu */}
                <div className="absolute top-3 right-3 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-md">
                  {index + 1}
                </div>
              </div>

              {/* TREŚĆ KARTY */}
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                  {feature.title}
                  {/* Gwiazdka dla funkcji Pro */}
                  {feature.title.includes('Biblioteka') && (
                    <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-1 rounded-full font-semibold">
                      PRO
                    </span>
                  )}
                </h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>

              {/* Ozdobna linia na dole karty */}
              <div className="px-6 pb-4">
                <svg width="100%" height="3" viewBox="0 0 100 3">
                  <path
                    d="M 0 1.5 Q 25 0.5, 50 1.5 T 100 1.5"
                    stroke={
                      index % 6 === 0
                        ? '#3b82f6'
                        : index % 6 === 1
                          ? '#8b5cf6'
                          : index % 6 === 2
                            ? '#ec4899'
                            : index % 6 === 3
                              ? '#f59e0b'
                              : index % 6 === 4
                                ? '#14b8a6'
                                : '#10b981'
                    }
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* DODATKOWY TEKST NA DOLE */}
        <div className="text-center mt-16">
          <p className="text-gray-500 text-lg">
            I to wszystko w <span className="font-bold text-blue-600">jednej aplikacji</span> 🎉
          </p>
        </div>
      </div>
    </section>
  );
}
