import Link from 'next/link';
import Image from 'next/image';

export default function FaqPage() {
  return (
    <>
      <h1>Najczestsze Pytania (FAQ)</h1>

      <h2>Ogolne pytania</h2>
      <h3>Ile kosztuje EasyLesson?</h3>
      <p>Platforma ma wersje darmowa oraz opcje rozszerzone.</p>

      <h3>Czy dziala na telefonie?</h3>
      <p>Tak, aplikacja jest responsywna i dziala mobilnie.</p>

      <h3>Czy dane sa bezpieczne?</h3>
      <p>Tak, dane sa szyfrowane podczas transmisji i przechowywania.</p>

      <h2>Problemy i rozwiazania</h2>
      <h3>Nie moge sie zalogowac</h3>
      <ol>
        <li>Sprawdz poprawny email i haslo.</li>
        <li>Sprawdz czy Caps Lock jest wylaczony.</li>
        <li>Uzyj opcji resetu hasla.</li>
      </ol>

      <h3>Tablica sie nie laduje</h3>
      <ol>
        <li>Odswiez strone.</li>
        <li>Sprawdz polaczenie internetowe.</li>
        <li>Sproboj w innej przegladarce.</li>
      </ol>

      <h2>Przyklad wstawienia obrazka</h2>
      <p>Ponizej masz gotowy przyklad, jak dodac obraz do strony dokumentacji:</p>
      <Image
        src="/resources/BoardHero.webp"
        alt="Przykladowy widok tablicy EasyLesson"
        width={960}
        height={540}
        className="rounded-lg border border-gray-200"
      />
      <p>
        Obrazki wrzucaj do folderu <strong>public</strong>, a potem uzywaj sciezki zaczynajacej
        sie od <strong>/</strong>, np. <strong>/resources/BoardHero.webp</strong>.
      </p>

      <p>
        <Link href="/podrecznik-uzytkownika">Powrot do dokumentacji</Link>
      </p>
    </>
  );
}
