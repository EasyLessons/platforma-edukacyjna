/**
 * Fonty aplikacji - ladowane LOKALNIE przez `next/font/local`.
 *
 * Nie uzywaj `next/font/google`: pobiera fonty z Google Fonts w trakcie `next build`
 * i przy chwilowej niedostepnosci Google build w CI pada losowo.
 *
 * Pliki woff2 (fonty zmienne, os `wght`) pochodza z repozytorium google/fonts (licencja OFL 1.1,
 * teksty licencji obok: OFL-*.txt):
 * - PlusJakartaSans-Variable.woff2 - `ofl/plusjakartasans/PlusJakartaSans[wght].ttf`,
 *   podzbior latin + latin-ext (polskie znaki), wagi 200-800. SWIADOMIE pominiete podzbiory
 *   vietnamese i cyrillic-ext, ktore Google Fonts serwowal dodatkowo (takie znaki, np. w nazwie
 *   uzytkownika, ida fontem zapasowym; podstawowej cyrylicy Google tez nie serwowal). Interfejs
 *   jest tylko PL/EN, a pelny plik bylby ok. 2x wiekszy i preloadowany na landingu.
 * - PlayfairDisplay-Variable.woff2, PlayfairDisplay-Italic-Variable.woff2 -
 *   `ofl/playfairdisplay/PlayfairDisplay[wght].ttf` i `...-Italic[wght].ttf`, wagi 400-900,
 *   sama kompresja WOFF2 bez zmian (font ma Reserved Font Name, wiec bez podzbioru).
 *
 * Loadery `next/font` musza byc wywolane na poziomie modulu i przypisane do `const`.
 */
import localFont from 'next/font/local';

/** Plus Jakarta Sans z pelnym zakresem wag 200-800 (`className`), z preloadem. */
export const plusJakartaSans = localFont({
  src: './PlusJakartaSans-Variable.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
});

/**
 * Plus Jakarta Sans z DYSKRETNYMI wagami 300/400/600/700/800 - dla sekcji, ktore przed
 * przejsciem na fonty lokalne deklarowaly w `next/font/google` dokladnie te wagi.
 *
 * Wagi 500 celowo NIE MA: `font-medium` w tych sekcjach dopasowuje sie do 400 (reguly
 * dopasowania wag CSS), tak jak przed zmiana. Jeden wpis z zakresem `200 800` dalby prawdziwe
 * 500 i pogrubil te teksty. Wszystkie wpisy wskazuja ten sam plik (jedno pobranie) - tak samo
 * serwowal to Google Fonts.
 */
export const plusJakartaSansDiscrete = localFont({
  src: [
    { path: './PlusJakartaSans-Variable.woff2', weight: '300', style: 'normal' },
    { path: './PlusJakartaSans-Variable.woff2', weight: '400', style: 'normal' },
    { path: './PlusJakartaSans-Variable.woff2', weight: '600', style: 'normal' },
    { path: './PlusJakartaSans-Variable.woff2', weight: '700', style: 'normal' },
    { path: './PlusJakartaSans-Variable.woff2', weight: '800', style: 'normal' },
  ],
  display: 'swap',
});

/** Plus Jakarta Sans dla root layoutu: `className` + zmienna `--font-plus-jakarta`, bez preloadu. */
export const plusJakartaSansRoot = localFont({
  src: './PlusJakartaSans-Variable.woff2',
  weight: '200 800',
  style: 'normal',
  display: 'swap',
  variable: '--font-plus-jakarta',
  preload: false,
});

/** Playfair Display (normal + italic) dla root layoutu: zmienna `--font-playfair`, bez preloadu. */
export const playfairDisplayRoot = localFont({
  src: [
    { path: './PlayfairDisplay-Variable.woff2', weight: '400 900', style: 'normal' },
    { path: './PlayfairDisplay-Italic-Variable.woff2', weight: '400 900', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-playfair',
  adjustFontFallback: 'Times New Roman',
  preload: false,
});
