import './globals.css';
import { AuthProvider } from '@/_new/lib/auth';
import { QueryProvider } from '@/_new/lib/query-provider';
import Script from 'next/script';
import {
  plusJakartaSansRoot as plusJakarta,
  playfairDisplayRoot as playfair,
} from '@new/shared/fonts';

export const metadata = {
  title: 'EasyLesson - Korepetycje online z AI',
  description:
    'Platforma do korepetycji z inteligentną tablicą, AI i wszystkim czego potrzebujesz do nauki online',
  verification: {
    google: 'VuL3zWFM6w8FMOI-gIv-jY28fSecnsh4jeVB6QkOd3Y',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body
        className={`${plusJakarta.className} ${plusJakarta.variable} ${playfair.variable} antialiased`}
      >
        <div id="google_translate_element" style={{ display: 'none' }}></div>
        <Script
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />
        <Script id="google-translate-init" strategy="afterInteractive">
          {`
            function googleTranslateElementInit() {
              new window.google.translate.TranslateElement({
                pageLanguage: 'pl',
                autoDisplay: false
              }, 'google_translate_element');
            }
          `}
        </Script>

        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
