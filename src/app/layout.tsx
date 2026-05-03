import { Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { AuthProvider } from './context/AuthContext';
import { QueryProvider } from '@/_new/lib/query-provider';
import Script from 'next/script';

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
  preload: false,
});

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  style: ['normal', 'italic'],
  preload: false,
});

export const metadata = {
  title: 'EasyLesson - Korepetycje online z AI',
  description: 'Platforma do korepetycji z inteligentną tablicą, AI i wszystkim czego potrzebujesz do nauki online',
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
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
