import Link from 'next/link';

export default function TablicaPage() {
  return (
    <>
      <h1>Tablica Interaktywna</h1>

      <p>Tablica to centralne miejsce pracy. Tu znajdziesz podstawy obslugi.</p>

      <h2>Narzedzia</h2>
      <ul>
        <li>Pioro, linijka, prostokat, elipsa</li>
        <li>Guma i narzedzia pomocnicze</li>
        <li>Pobieranie wyniku pracy</li>
      </ul>

      <h2>Jak rysowac</h2>
      <ol>
        <li>Wybierz narzedzie.</li>
        <li>Przeciagnij kursorem po tablicy.</li>
        <li>Zmien kolor i grubosc pedzla wedlug potrzeb.</li>
      </ol>

      <h2>Wspolpraca</h2>
      <p>Mozesz zaprosic innych uzytkownikow i rysowac wspolnie w czasie rzeczywistym.</p>

      <p>
        Nastepne:{' '}
        <Link href="/podrecznik-uzytkownika/workspaces">Workspaces i wspolpraca</Link>
      </p>
    </>
  );
}
