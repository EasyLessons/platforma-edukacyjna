'use client';

import React from 'react';
import Header from '../layout/Header';
import Footer from '../layout/Footer';

export default function PolitykaPrywatnosciPage() {
  return (
    <div className="min-h-screen bg-[#F6F6F6] text-[#212224] flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#212224]/5 rounded-full blur-3xl pointer-events-none"></div>
      
      <Header />
      
      <main className="flex-grow max-w-4xl mx-auto px-6 py-24 pb-40 w-full z-10">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-center text-[#212224]">
          Polityka Prywatności Easylesson.app
        </h1>
        <p className="text-center text-gray-500 mb-10">Data wejścia w życie: 1 maja 2026 r.</p>
        
        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-gray-100">
          <div className="prose prose-lg max-w-none text-gray-600 prose-headings:text-[#212224] prose-a:text-[#212224] prose-strong:text-[#212224]">
            <p>
              Niniejsza Polityka Prywatności opisuje, w jaki sposób firma <strong>Easylesson Sp. z o.o.</strong>, w tym jej podmioty stowarzyszone i zależne (zbiorowo zwane „Easylesson”, „my”, „nasz” lub „nas”), zbiera, wykorzystuje i ujawnia informacje pochodzące od lub dotyczące zidentyfikowanej lub możliwej do zidentyfikowania osoby. Obejmuje to informacje, które możemy powiązać z konkretną osobą („Dane Osobowe”), a także wybory, jakie masz w odniesieniu do swoich Danych Osobowych.
            </p>

            <h2>1. Zakres obowiązywania Polityki Prywatności</h2>
            <p>
              Niniejsza Polityka Prywatności dotyczy platformy i narzędzi edukacyjnych Easylesson, w tym powiązanych aplikacji mobilnych i desktopowych (zbiorowo: „Usługi”), domeny easylesson.app oraz innych naszych stron internetowych (zbiorowo: „Witryny”), a także innych interakcji (np. obsługa klienta), które możesz mieć z Easylesson. Obejmuje również przetwarzanie wszelkich wiadomości, tekstów, plików, zdjęć, nagrań wideo lub audio oraz innych treści przesyłanych za pośrednictwem naszych Usług.
            </p>
            <p>
              Polityka ta nie dotyczy żadnych aplikacji ani oprogramowania stron trzecich, które integrują się z naszymi Usługami („Usługi Stron Trzecich”), ani żadnych innych produktów, usług czy firm stron trzecich.
            </p>
            <p>
              Ty, organizacja (np. szkoła, pracodawca lub inny podmiot) kontrolująca korzystanie z Usług („Organizacja”) i wszelkie powiązane Treści Klienta, a także wszelkie osoby, którym Organizacja przyznała dostęp do Usług („Użytkownicy” i łącznie z Tobą oraz Organizacją, „Klient”), jesteście również związani Warunkami Świadczenia Usług lub innym odpowiednim dokumentem (razem: „Umowa z Klientem”).
            </p>

            <h2>2. Rodzaje Danych Osobowych, które zbieramy</h2>
            <p>
              Twoje Dane Osobowe są dostarczane przez Ciebie, uzyskiwane od stron trzecich i/lub tworzone przez nas, gdy korzystasz z Usług.
            </p>
            <p>
              <strong>Treści Klienta</strong> to informacje, które uzyskujemy od Ciebie podczas korzystania z Usług Easylesson (mogą one zawierać Dane Osobowe), z wyjątkiem danych uznawanych za Dane Usług.
            </p>
            <p>
              <strong>Dane Usług</strong> obejmują:
            </p>
            <ul>
              <li><strong>Informacje o koncie i Organizacji:</strong> Aby utworzyć konto, podajesz nam adres e-mail, numer telefonu, hasło, domenę i/lub podobne dane. Możemy również otrzymywać Twój e-mail i imię z innych platform, z którymi się integrujemy (np. Google, Facebook).</li>
              <li><strong>Informacje rozliczeniowe:</strong> Klienci kupujący płatne wersje Usług mogą podać nam (lub naszym operatorom płatności) dane rozliczeniowe, takie jak informacje o karcie kredytowej, dane bankowe i/lub adres rozliczeniowy.</li>
              <li><strong>Metadane Usług:</strong> Kiedy Użytkownik korzysta z platformy, generowane są metadane dające kontekst tego użycia (np. logi dotyczące tego, jakie lekcje, kursy czy funkcje przeglądasz).</li>
              <li><strong>Dane o aktywności:</strong> Automatycznie zbieramy informacje w plikach logów, takie jak adres IP, typ i ustawienia przeglądarki, data i godzina korzystania z Usług, preferencje językowe.</li>
              <li><strong>Dane urządzenia:</strong> Zbieramy informacje o urządzeniach uzyskujących dostęp do Easylesson (typ urządzenia, system operacyjny, unikalne identyfikatory urządzenia, dane o awariach).</li>
              <li><strong>Dane o lokalizacji:</strong> Przybliżamy Twoją lokalizację na podstawie adresu IP z Twojej przeglądarki lub urządzenia, zgodnie z udzielonymi przez Ciebie zgodami.</li>
              <li><strong>Dane od stron trzecich:</strong> Możemy otrzymywać dane analityczne i marketingowe od naszych partnerów, pomagające nam ulepszać platformę i kampanie reklamowe.</li>
              <li><strong>Dane z plików cookie:</strong> Używamy plików cookie i podobnych technologii. Więcej informacji znajdziesz w naszej Polityce Cookies.</li>
              <li><strong>Dane z Usług Stron Trzecich:</strong> Jeśli Klient włączy integracje z narzędziami zewnętrznymi, możemy wymieniać z nimi dane w imieniu Klienta.</li>
              <li><strong>Dane kontaktowe i obsługa klienta:</strong> Przetwarzamy dane, które podajesz kontaktując się z naszym wsparciem. Rozmowy mogą być nagrywane w celach szkoleniowych (o czym zawsze poinformujemy).</li>
              <li><strong>Dane dotyczące sztucznej inteligencji (AI):</strong> Jeśli korzystasz z funkcji AI w Easylesson, przetwarzamy dane związane z Twoimi interakcjami z tymi technologiami.</li>
            </ul>

            <h2>3. Jak wykorzystujemy Dane Osobowe</h2>
            <p>
              Treści Klienta są wykorzystywane zgodnie z instrukcjami Klienta (w tym Umową z Klientem), aby świadczyć i ulepszać Usługi oraz zgodnie z wymogami prawa.
            </p>
            <p>
              Dane Usług wykorzystujemy m.in. w następujących celach:
            </p>
            <ul>
              <li><strong>Świadczenie i personalizacja Usług:</strong> Aby umożliwić Ci tworzenie konta, naukę, udostępnianie treści i współpracę.</li>
              <li><strong>Bezpieczeństwo i integralność:</strong> Aby zapobiegać błędom, problemom technicznym i monitorować użycie produktu.</li>
              <li><strong>Zgodność z prawem:</strong> Aby spełniać wymogi prawne i regulacyjne.</li>
              <li><strong>Komunikacja i wsparcie:</strong> Aby odpowiadać na Twoje pytania i prośby o pomoc.</li>
              <li><strong>Rozwój narzędzi i badań:</strong> Aby analizować trendy edukacyjne i ulepszać nasze kursy, funkcje AI oraz interfejs.</li>
              <li><strong>Wysyłanie e-maili i powiadomień:</strong>
                <ul>
                  <li><strong>Transakcyjne:</strong> Wiadomości techniczne, administracyjne i dotyczące bezpieczeństwa.</li>
                  <li><strong>Marketingowe:</strong> Informacje o nowościach i promocjach. Możesz z nich w każdej chwili zrezygnować, klikając link "odsubskrybuj".</li>
                </ul>
              </li>
              <li><strong>Rozliczenia i administracja:</strong> Do wystawiania faktur i zarządzania subskrypcjami.</li>
            </ul>

            <h2>4. Przechowywanie danych</h2>
            <p>
              Easylesson przechowuje Treści Klienta i Dane Osobowe zgodnie z instrukcjami Klienta oraz obowiązującym prawem. Usunięcie konta przez Klienta może skutkować usunięciem danych osobowych i powiązanych Danych Usług.
            </p>
            <p>
              Możemy zachować pewne typy Danych Usług po dezaktywacji konta przez okres niezbędny do realizacji uzasadnionych interesów biznesowych, przeprowadzania audytów, przestrzegania obowiązków prawnych, rozstrzygania sporów i egzekwowania naszych umów.
            </p>

            <h2>5. Jak udostępniamy i ujawniamy Dane Osobowe</h2>
            <p>
              Możemy udostępniać Dane Osobowe w następujący sposób:
            </p>
            <ul>
              <li><strong>Dostawcy:</strong> Angażujemy podmioty trzecie jako usługodawców (np. dostawcy hostingu, chmury obliczeniowej), którzy przetwarzają dane w naszym imieniu.</li>
              <li><strong>Usługi Stron Trzecich:</strong> Jeśli Organizacja lub Użytkownik połączy z nami aplikacje zewnętrzne (np. narzędzia AI, systemy szkolne), możemy udostępniać im dane.</li>
              <li><strong>Partnerzy analityczni i reklamowi:</strong> Korzystamy z usług analitycznych, aby analizować korzystanie z naszej platformy na podstawie plików cookie.</li>
              <li><strong>Podmioty powiązane korporacyjnie:</strong> Możemy udostępniać dane naszym spółkom zależnym dla zachowania ciągłości biznesowej.</li>
              <li><strong>Podczas zmian strukturalnych firmy:</strong> W przypadku fuzji, przejęcia, sprzedaży aktywów lub bankructwa.</li>
              <li><strong>W celu przestrzegania prawa i bezpieczeństwa:</strong> Jeśli wymaga tego nakaz sądowy, prawo lub w celu ochrony praw, własności i bezpieczeństwa platformy Easylesson i jej Użytkowników.</li>
              <li><strong>Inni Użytkownicy/Administratorzy:</strong> Pamiętaj, że treści (w tym imię i nazwisko), które publikujesz we wspólnych przestrzeniach lekcyjnych, mogą być widoczne dla innych uczestników kursu lub nauczycieli/administratorów Twojej Organizacji.</li>
            </ul>

            <h2>6. Bezpieczeństwo</h2>
            <p>
              Poważnie traktujemy bezpieczeństwo Danych Osobowych. Easylesson dokłada wszelkich starań, aby chronić je przed nieautoryzowanym dostępem. Nie możemy jednak zagwarantować, że dane przesyłane przez Internet będą w 100% bezpieczne, dlatego zachęcamy do ostrożności.
            </p>

            <h2>7. Linki do stron trzecich</h2>
            <p>
              Nasze Usługi mogą zawierać linki do stron internetowych obsługiwanych przez strony trzecie, których nie jesteśmy właścicielem. Niniejsza Polityka Prywatności ich nie obejmuje – zalecamy zapoznanie się z ich własnymi politykami prywatności.
            </p>

            <h2>8. Ograniczenia wiekowe</h2>
            <p>
              Easylesson nie zezwala na korzystanie z Usług i Witryn przez osoby poniżej 16. roku życia („Nieletni”) bez wyraźnej zgody rodzica lub opiekuna prawnego. Jeśli dowiesz się, że Nieletni bezprawnie przekazał nam Dane Osobowe, skontaktuj się z nami, a my usuniemy te informacje.
            </p>

            <h2>9. Transfery międzynarodowe</h2>
            <p>
              Jeśli przetwarzasz dane z Europejskiego Obszaru Gospodarczego (EOG), Wielkiej Brytanii lub Szwajcarii, informujemy, że Twoje dane mogą być przesyłane i przetwarzane w krajach takich jak Stany Zjednoczone lub innych krajach poza EOG. Wszelkie transgraniczne transfery danych opierają się na zatwierdzonych mechanizmach, takich jak Standardowe Klauzule Umowne (SCC) przyjęte przez Komisję Europejską.
            </p>

            <h2>10. Twoje prawa (w tym RODO)</h2>
            <p>
              Z zastrzeżeniem praw przyznanych Ci w Twoim kraju, masz następujące prawa:
            </p>
            <ul>
              <li><strong>Dostęp:</strong> Możesz zażądać dostępu do swoich Danych Osobowych.</li>
              <li><strong>Przenoszalność:</strong> Możesz zażądać kopii swoich danych w ustrukturyzowanym formacie.</li>
              <li><strong>Usunięcie (Prawo do bycia zapomnianym):</strong> Możesz poprosić o usunięcie swoich danych.</li>
              <li><strong>Sprostowanie:</strong> Możesz zażądać poprawienia niedokładnych informacji.</li>
              <li><strong>Sprzeciw i ograniczenie przetwarzania:</strong> Możesz sprzeciwić się przetwarzaniu danych do celów marketingu bezpośredniego lub z innych uzasadnionych przyczyn.</li>
              <li><strong>Wycofanie zgody:</strong> W każdej chwili możesz cofnąć zgodę na przetwarzanie danych.</li>
            </ul>
            <p>
              Aby skorzystać z tych praw, skontaktuj się z nami. Masz również prawo wniesienia skargi do lokalnego organu ochrony danych osobowych (w Polsce: Prezes Urzędu Ochrony Danych Osobowych - PUODO).
            </p>

            <h2>11. Prawa specyficzne dla mieszkańców USA (CCPA/CPRA)</h2>
            <p>
              (Jeśli masz użytkowników z USA): Mieszkańcy niektórych stanów (np. Kalifornii) mają dodatkowe prawa, w tym prawo do wiedzy o sprzedawanych danych, prawo do ograniczenia wykorzystywania tzw. Wrażliwych Danych Osobowych oraz prawo do rezygnacji ze „sprzedaży” lub „udostępniania” danych (tzw. opt-out). Easylesson nie sprzedaje Twoich danych osobowych w tradycyjnym sensie, ale korzysta z narzędzi analitycznych stron trzecich. Możesz zarządzać swoimi preferencjami za pomocą ustawień plików cookie na naszej stronie.
            </p>

            <h2>12. Zmiany w niniejszej Polityce Prywatności</h2>
            <p>
              Easylesson może od czasu do czasu aktualizować niniejszą Politykę Prywatności. Zmiany opublikujemy na tej stronie. W przypadku istotnych modyfikacji dołożymy wszelkich starań, aby Cię o tym powiadomić (np. e-mailowo lub poprzez komunikat w aplikacji). Jeśli nie zgadzasz się ze zmianami, powinieneś zaprzestać korzystania z platformy Easylesson i dezaktywować swoje konto.
            </p>

            <h2>13. Kontakt</h2>
            <p>
              Jeśli masz pytania dotyczące niniejszej Polityki Prywatności lub Twoich Danych Osobowych, skontaktuj się z nami:
            </p>
            <div className="bg-gray-50 p-6 rounded-xl mb-6">
              <strong>Easylesson Sp. z o.o.</strong><br />
              Dział Ochrony Danych<br />
              [Ulica, Numer lokalu]<br />
              [Kod pocztowy, Miejscowość]<br />
              Polska<br /><br />
              E-mail: <strong>kontakt@easylesson.pl</strong>
            </div>
            
            <p className="text-sm mt-10 text-gray-400">Ostatnia aktualizacja dokumentu: 1 maja 2026 r.</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
