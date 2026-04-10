'use client';

import React from 'react';
import Header from '../layout/Header';
import Footer from '../layout/Footer';

export default function RodoPage() {
  return (
    <div className="min-h-screen bg-[#F6F6F6] text-[#212224] flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#212224]/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <Header />
      
      <main className="flex-grow max-w-4xl mx-auto px-6 py-24 pb-40 w-full z-10">
        <h1 className="text-4xl md:text-5xl font-bold mb-10 tracking-tight text-center text-[#212224]">
          Ochrona Danych Osobowych (RODO)
        </h1>
        
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <div className="prose prose-lg max-w-none text-gray-600 prose-headings:text-[#212224] prose-a:text-[#212224]">
            <h2>1. Administrator Danych</h2>
            <p>
              Zgodnie z art. 13 ust. 1 i ust. 2 ogólnego rozporządzenia o ochronie danych osobowych z dnia 27 kwietnia 2016 r. (RODO) informujemy, że Administratorem Twoich danych osobowych jest <strong>EasyLesson</strong>.
            </p>

            <h2>2. Cel i podstawa prawna przetwarzania</h2>
            <p>
              Twoje dane osobowe przetwarzane będą w następujących celach:
            </p>
            <ul>
              <li>Realizacja i świadczenie usług drogą elektroniczną, w tym prowadzenie konta na Platformie Edukacyjnej (na podstawie art. 6 ust. 1 lit. b RODO).</li>
              <li>Obsługa zgłoszeń i komunikacja poprzez formularz kontaktowy (na podstawie art. 6 ust. 1 lit. f RODO).</li>
              <li>Wypełnienie obowiązków prawnych ciążących na Administratorze, np. księgowych i podatkowych (na podstawie art. 6 ust. 1 lit. c RODO).</li>
              <li>Marketing bezpośredni naszych własnych produktów i usług (na podstawie art. 6 ust. 1 lit. f RODO lub za uprzednią zgodą - art. 6 ust. 1 lit. a RODO).</li>
            </ul>

            <h2>3. Odbiorcy danych</h2>
            <p>
              Odbiorcami Twoich danych osobowych mogą być podmioty dostarczające i wspierające systemy teleinformatyczne Administratora (np. hosting, wysyłka e-maili, analityka) 
              na podstawie odpowiednich umów powierzenia przetwarzania danych osobowych. Z uwagi na korzystanie z niektórych narzędzi, dane mogą być przetwarzane poza EOG 
              (z zachowaniem odpowiednich zabezpieczeń prawnych).
            </p>

            <h2>4. Okres przechowywania danych</h2>
            <p>
              Twoje dane osobowe będą przechowywane przez okres świadczenia usług na platformie EasyLesson, a po tym czasie przez okres wyznaczony przepisami prawa (np. z tytułu przedawnienia roszczeń, obowiązków księgowych) lub do momentu wycofania zgody/wniesienia skutecznego sprzeciwu.
            </p>

            <h2>5. Twoje prawa</h2>
            <p>
              Posiadasz prawo dostępu do treści swoich danych oraz prawo ich sprostowania, usunięcia, ograniczenia przetwarzania, prawo do przenoszenia danych, prawo wniesienia sprzeciwu, 
              a także prawo do cofnięcia zgody w dowolnym momencie. Ponadto masz prawo wniesienia skargi do organu nadzorczego (Prezesa Urzędu Ochrony Danych Osobowych).
            </p>

            <h2>6. Kontakt w sprawach ochrony danych</h2>
            <p>
              We wszelkich sprawach związanych z danymi osobowymi i ich ochroną możesz skontaktować się z nami pisząc na adres e-mail: <strong>kontakt@easylesson.pl</strong> lub korzystając z naszego <a href="/kontakt">formularza kontaktowego</a>.
            </p>
            
            <p className="text-sm mt-10 text-gray-400">Ostatnia aktualizacja: kwiecień 2026</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
