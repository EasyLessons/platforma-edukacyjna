'use client';

import React from 'react';
import Header from '../layout/Header';
import Footer from '../layout/Footer';

export default function RulesPage() {
  return (
    <div className="min-h-screen bg-[#F6F6F6] text-[#212224] flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#212224]/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <Header />
      
      <main className="flex-grow max-w-4xl mx-auto px-6 py-24 pb-40 w-full z-10">
        <h1 className="text-4xl md:text-5xl font-bold mb-10 tracking-tight text-center text-[#212224]">
          Regulamin korzystania z EasyLesson
        </h1>
        
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <div className="prose prose-lg max-w-none text-gray-600 prose-headings:text-[#212224] prose-a:text-[#212224]">
            <h2>§1. Postanowienia ogólne</h2>
            <p>
              1. Niniejszy Regulamin określa ogólne warunki, zasady oraz sposób korzystania z Platformy Edukacyjnej <strong>EasyLesson.pl</strong>, 
              jak również rodzaj i zakres usług świadczonych drogą elektroniczną.
              2. Platforma stanowi interaktywne narzędzie do prowadzania korepetycji online, wyposażone w zintegrowaną tablicę interaktywną, inteligentnego asystenta (AI Tutor), funkcję SmartSearch oraz VoiceChat.
            </p>

            <h2>§2. Definicje</h2>
            <p>
              Użyte w Regulaminie pojęcia oznaczają:
            </p>
            <ul>
              <li><strong>Usługodawca:</strong> Podmiot udostępniający usługi dla platformy EasyLesson.</li>
              <li><strong>Użytkownik:</strong> Osoba fizyczna korzystająca z usług platformy w charakterze ucznia, nauczyciela lub firmy edukacyjnej.</li>
              <li><strong>Konto:</strong> Zarezerwowane dla Użytkownika środowisko platformy, zabezpieczone loginem i unikalnym hasłem.</li>
              <li><strong>Usługi:</strong> Opcje oferowane w modelu podstawowym lub Premium określone w cenniku.</li>
            </ul>

            <h2>§3. Korzystanie z platformy i Rejestracja</h2>
            <p>
              1. Rejestracja na platformie oznacza pełną akceptację niniejszego Regulaminu. <br />
              2. Użytkownik zapewnia, że dane podawane podczas rejestracji (zwłaszcza adres e-mail) są aktualne i poprawne.<br />
              3. Wykorzystywanie platformy do celów niezgodnych z prawem (np. upubliczniania plików chronionych prawami autorskimi, treści obraźliwych) jest bezwzględnie zakazane i skutkuje natychmiastowym zablokowaniem Konta.
            </p>

            <h2>§4. Pakiety i opłaty (Premium)</h2>
            <p>
              Część funkcjonalności platformy jest odpłatna w formie stałej miesięcznej lub rocznej subskrypcji. 
              Dokładne informacje na temat opłat oraz procedur anulacji można znaleźć na specjalnej podstronie <strong><a href="/#pakiet-premium">Cennik</a></strong>.
            </p>

            <h2>§5. Asystent AI i VoiceChat</h2>
            <p>
              Aplikacja <strong>EasyLesson</strong> korzysta z usług generatywnej sztucznej inteligencji. 
              Należy pamiętać, że chociaż AI jest projektowane tak, aby być maksymalnie pomocnym, odpowiedzi nie stanowią profesjonalnej porady certyfikowanego eksperta i ostateczna odpowiedzialność 
              za wykorzystanie tych odpowiedzi spoczywa na Użytkowniku.
            </p>

            <h2>§6. Zmiany w regulaminie</h2>
            <p>
              Zastrzegamy sobie prawo do zmiany niniejszego regulaminu. O takich zmianach Użytkownicy zostaną powiadomieni mailowo lub odpowiednim komunikatem z poziomu panelu Dashboard w terminie na 14 dni przed ich wejściem w życie.
            </p>

            <p className="text-sm mt-10 text-gray-400">Ostatnia aktualizacja: kwiecień 2026</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
