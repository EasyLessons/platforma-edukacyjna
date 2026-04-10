'use client';

import React from 'react';
import Header from '../layout/Header';
import Footer from '../layout/Footer';

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-[#F6F6F6] text-[#212224] flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#212224]/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <Header />
      
      <main className="flex-grow max-w-4xl mx-auto px-6 py-24 pb-40 w-full z-10">
        <h1 className="text-4xl md:text-5xl font-bold mb-10 tracking-tight text-center text-[#212224]">
          Polityka Cookies
        </h1>
        
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <div className="prose prose-lg max-w-none text-gray-600 prose-headings:text-[#212224] prose-a:text-[#212224]">
            <h2>1. Wstęp</h2>
            <p>
              Niniejsza Polityka dotyczy plików „cookies” (ciasteczek) i odnosi się do strony internetowej <strong>easylesson.pl</strong>. 
              Dokładamy wszelkich starań, by chronić prywatność naszych użytkowników oraz w pełni transparentnie informować o technologiach wykorzystywanych na naszych stronach.
            </p>

            <h2>2. Czym są pliki cookies?</h2>
            <p>
              Pliki cookies to małe pliki tekstowe zapisywane na urządzeniu końcowym użytkownika (np. komputerze, smartfonie) podczas przeglądania naszej platformy. 
              Służą one do rozpoznawania urządzenia przy ponownych odwiedzinach, zapamiętywania preferencji oraz zbierania statystyk pozwalających na optymalizację serwisu.
            </p>

            <h2>3. Do czego używamy plików cookies?</h2>
            <ul>
              <li><strong>Niezbędne (Techniczne):</strong> Konieczne do prawidłowego działania strony (np. utrzymanie sesji po zalogowaniu, nawigacja we wnętrzu aplikacji). Bez nich platforma może nie funkcjonować poprawnie.</li>
              <li><strong>Funkcjonalne:</strong> Zapamiętują wybory użytkownika, np. dotyczące języka czy układu platformy.</li>
              <li><strong>Analityczne:</strong> Służą do zliczania wizyt i źródeł ruchu, dzięki czemu możemy mierzyć i poprawiać wydajność naszej witryny.</li>
              <li><strong>Marketingowe:</strong> Mogą być ustawiane przez naszych partnerów w celach reklamowych (np. dopasowania wyświetlanych ofert).</li>
            </ul>

            <h2>4. Zarządzanie plikami cookies</h2>
            <p>
              Każdy użytkownik platformy ma prawo wyboru, w jakim zakresie chce udostępniać informacje o sobie. 
              Ustawienia dotyczące plików cookies można zmienić w poziomach przeglądarki internetowej. 
              Ograniczenie lub zablokowanie plików cookies może jednak wpłynąć na dostępność niektórych funkcji naszej platformy.
            </p>

            <h2>5. Kontakt</h2>
            <p>
              W przypadku dodatkowych pytań dotyczących naszej Polityki Cookies, skontaktuj się z nami poprzez formularz na stronie <a href="/kontakt">Kontakt</a> lub na adres e-mail: <strong>kontakt@easylesson.pl</strong>.
            </p>
            
            <p className="text-sm mt-10 text-gray-400">Ostatnia aktualizacja: kwiecień 2026</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
