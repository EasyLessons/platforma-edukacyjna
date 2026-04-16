import Link from 'next/link';

export default function WorkspacesPage() {
  return (
    <>
      <h1>Workspaces i Wspolpraca</h1>

      <p>Workspaces to wspolne przestrzenie do pracy zespolowej.</p>

      <h2>Tworzenie workspace</h2>
      <ol>
        <li>Kliknij "Nowy Workspace".</li>
        <li>Podaj nazwe i opcjonalny opis.</li>
        <li>Kliknij "Utworz".</li>
      </ol>

      <h2>Zapraszanie osob</h2>
      <ol>
        <li>Wejdz do ustawien workspace.</li>
        <li>Wybierz "Zapros czlonkow".</li>
        <li>Podaj adresy email i wyslij zaproszenia.</li>
      </ol>

      <h2>Role</h2>
      <ul>
        <li>Wlasciciel - pelna kontrola</li>
        <li>Edytor - moze tworzyc i edytowac</li>
        <li>Viewer - moze przegladac</li>
      </ul>

      <p>
        <Link href="/podrecznik-uzytkownika">Wroc do strony glownej dokumentacji</Link>
      </p>
    </>
  );
}
