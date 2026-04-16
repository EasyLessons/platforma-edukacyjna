import Link from 'next/link';

export default function RejestracjaPage() {
  return (
    <>
      <h1>Rejestracja i Logowanie</h1>

      <p>Instrukcja krok po kroku jak zalozyc konto na platformie EasyLesson.</p>

      <h2>Rejestracja</h2>
      <h3>Krok 1: Przejdz do strony rejestracji</h3>
      <p>Kliknij przycisk "Zarejestruj sie" na stronie glownej.</p>

      <h3>Krok 2: Wypelnij formularz</h3>
      <ul>
        <li>Imie i nazwisko</li>
        <li>Email</li>
        <li>Haslo (min. 8 znakow)</li>
        <li>Potwierdzenie hasla</li>
      </ul>

      <h3>Krok 3: Potwierdz email</h3>
      <p>Kliknij link aktywacyjny wyslany na podany adres email.</p>

      <h2>Logowanie</h2>
      <ol>
        <li>Wejdz na strone logowania.</li>
        <li>Podaj email i haslo.</li>
        <li>Kliknij "Zaloguj sie".</li>
      </ol>

      <p>
        Nastepne: <Link href="/podrecznik-uzytkownika/tablica">Tablica interaktywna</Link>
      </p>
    </>
  );
}
