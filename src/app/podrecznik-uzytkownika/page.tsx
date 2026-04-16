import Link from 'next/link';

export default function DokumentacjaPage() {
  return (
    <>
      <h1>Dokumentacja EasyLesson</h1>

      <p>
        Witaj w dokumentacji platformy edukacyjnej EasyLesson. Tutaj znajdziesz najwazniejsze
        instrukcje korzystania z platformy.
      </p>

      <h2>O platformie</h2>
      <p>EasyLesson umozliwia:</p>
      <ul>
        <li>tworzenie i zarzadzanie zadaniami,</li>
        <li>prace w zespolach i workspace,</li>
        <li>korzystanie z interaktywnej tablicy,</li>
        <li>sledzenie postepow oraz powiadomienia.</li>
      </ul>

      <h2>Od czego zaczac?</h2>
      <ul>
        <li>
          <Link href="/podrecznik-uzytkownika/rejestracja">
            Rejestracja i logowanie
          </Link>
        </li>
        <li>
          <Link href="/podrecznik-uzytkownika/tablica">
            Instrukcja tablicy
          </Link>
        </li>
        <li>
          <Link href="/podrecznik-uzytkownika/faq">Najczestsze pytania (FAQ)</Link>
        </li>
      </ul>
    </>
  );
}
