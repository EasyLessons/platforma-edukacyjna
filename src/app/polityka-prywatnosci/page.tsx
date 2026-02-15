import Link from 'next/link';

export default function PolitykaPrywatnosciPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white shadow-sm rounded-lg p-8 md:p-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 inline-block"
          >
            ← Powrót do strony głównej
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Polityka Prywatności</h1>
          <p className="text-gray-600">Ostatnia aktualizacja: 15 lutego 2026</p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-gray-700">
          {/* Sekcja 1 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Wprowadzenie</h2>
            <p className="text-gray-600 italic">Treść w przygotowaniu...</p>
          </section>

          {/* Sekcja 2 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Administrator danych osobowych
            </h2>
            <p className="text-gray-600 italic">Treść w przygotowaniu...</p>
          </section>

          {/* Sekcja 3 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. Jakie dane osobowe gromadzimy
            </h2>
            <p className="text-gray-600 italic">Treść w przygotowaniu...</p>
          </section>

          {/* Sekcja 4 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. Cel i podstawa prawna przetwarzania danych
            </h2>
            <p className="text-gray-600 italic">Treść w przygotowaniu...</p>
          </section>

          {/* Sekcja 5 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              5. Okres przechowywania danych
            </h2>
            <p className="text-gray-600 italic">Treść w przygotowaniu...</p>
          </section>

          {/* Sekcja 6 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              6. Udostępnianie danych osobowych
            </h2>
            <p className="text-gray-600 italic">Treść w przygotowaniu...</p>
          </section>

          {/* Sekcja 7 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              7. Bezpieczeństwo danych osobowych
            </h2>
            <p className="text-gray-600 italic">Treść w przygotowaniu...</p>
          </section>

          {/* Sekcja 8 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              8. Twoje prawa związane z danymi osobowymi
            </h2>
            <p className="text-gray-600 italic">Treść w przygotowaniu...</p>
          </section>

          {/* Sekcja 9 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              9. Pliki cookies i technologie śledzące
            </h2>
            <p className="text-gray-600 italic">Treść w przygotowaniu...</p>
          </section>

          {/* Sekcja 10 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              10. Zmiany w Polityce Prywatności
            </h2>
            <p className="text-gray-600 italic">Treść w przygotowaniu...</p>
          </section>

          {/* Sekcja 11 */}
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Kontakt</h2>
            <p className="text-gray-600 italic">Treść w przygotowaniu...</p>
          </section>
        </div>
      </div>
    </div>
  );
}
