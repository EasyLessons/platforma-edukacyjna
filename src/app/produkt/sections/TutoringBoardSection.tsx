import Image from 'next/image';

export default function TutoringBoardSection() {
  return (
    <section className="py-20 px-6 max-w-7xl mx-auto border-t border-gray-100" id="tutoring-board">
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Tutoring Board</h2>
        <p className="text-gray-600 text-lg">Najbardziej multimedialna, płynna i wieloosobowa tablica, która zamienia korepetycje i spotkania na żywo w angażującą przygodę naukową.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="bg-gray-50 p-8 rounded-2xl hover:bg-gray-200 transition-colors duration-300 cursor-pointer">
          <div className="mb-6 rounded-xl overflow-hidden shadow-sm">
            <Image 
              src="/produkt/TablicaInteraktywna.webp" 
              alt="Tablica interaktywna - podgląd" 
              width={500} 
              height={300} 
              className="w-full object-cover aspect-video"
            />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Tablica interaktywna</h3>
          <p className="text-gray-600 leading-relaxed">Rozbudowana przestrzeń do nauki. Twórz schematy, zarysowuj obrazy i pisz piórem zupełnie tak, jak robisz to na żywo przy szkolnej tablicy.</p>
        </div>

        <div className="bg-gray-50 p-8 rounded-2xl hover:bg-gray-200 transition-colors duration-300 cursor-pointer">
          <div className="mb-6 rounded-xl overflow-hidden shadow-sm">
            <Image 
              src="/produkt/Narzedzia.webp" 
              alt="Narzędzia przedmiotowe - podgląd" 
              width={500} 
              height={300} 
              className="w-full object-cover aspect-video"
            />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Narzędzia przedmiotowe</h3>
          <p className="text-gray-600 leading-relaxed">Zintegrowany panel z kalkulatorem wielofunkcyjnym, możliwością budowy interaktywnych wykresów w czasie rzeczywistym i o wiele więcej funkcji.</p>
        </div>

        <div className="bg-gray-50 p-8 rounded-2xl hover:bg-gray-200 transition-colors duration-300 cursor-pointer">
          <div className="mb-6 rounded-xl overflow-hidden shadow-sm">
            <Image 
              src="/produkt/SmartSearch.webp" 
              alt="SmartSearch - podgląd" 
              width={500} 
              height={300} 
              className="w-full object-cover aspect-video"
            />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">SmartSearch</h3>
          <p className="text-gray-600 leading-relaxed">Błyskawiczna wyszukiwarka zadań, wzorów, podpowiedzi i gotowych arkuszy maturalnych – wszystko pod ręką bez opuszczania karty zajęć.</p>
        </div>

        <div className="bg-gray-50 p-8 rounded-2xl hover:bg-gray-200 transition-colors duration-300 cursor-pointer">
          <div className="mb-6 rounded-xl overflow-hidden shadow-sm">
            <Image 
              src="/produkt/VoicheChat.webp" 
              alt="VoiceChat - podgląd" 
              width={500} 
              height={300} 
              className="w-full object-cover aspect-video"
            />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">VoiceChat</h3>
          <p className="text-gray-600 leading-relaxed">Bezpośrednia, wbudowana do platformy krystalicznie czysta komunikacja głosowa. Koniec z osobnymi programami i aplikacjami dla uczniów.</p>
        </div>

        <div className="bg-gray-50 p-8 rounded-2xl hover:bg-gray-200 transition-colors duration-300 cursor-pointer">
          <div className="mb-6 rounded-xl overflow-hidden shadow-sm">
            <Image 
              src="/produkt/MathTutor.webp" 
              alt="AI Tutor - podgląd" 
              width={500} 
              height={300} 
              className="w-full object-cover aspect-video"
            />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">AI Tutor</h3>
          <p className="text-gray-600 leading-relaxed">Inteligentny asystent u Twojego boku, gotowy przetłumaczyć skomplikowane zjawiska, wymyślić nowe zadanie egzaminacyjne na podstawie zdjęcia lub poprowadzić test wiedzy.</p>
        </div>

        <div className="bg-gray-50 p-8 rounded-2xl hover:bg-gray-200 transition-colors duration-300 cursor-pointer">
          <div className="mb-6 rounded-xl overflow-hidden shadow-sm">
            <Image 
              src="/produkt/Wspolbieznosc.webp" 
              alt="Współbieżność (Live) - podgląd" 
              width={500} 
              height={300} 
              className="w-full object-cover aspect-video"
            />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Współbieżność (Live)</h3>
          <p className="text-gray-600 leading-relaxed">Każda wyrysowana krzywa, rzucony obrazek i przeniesiona karteczka synchronizują się z osobami pracującymi na tablicy w czasie bliskim do milisekund.</p>
        </div>
      </div>
    </section>
  );
}