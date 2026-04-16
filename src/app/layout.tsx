'use client';

import { Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import Ad from './layout/ad';
import Header from './layout/Header';
import Footer from './layout/Footer';
import AuthHeader from './layout/AuthHeader';
import { AuthProvider, useAuth } from './context/AuthContext';
import { QueryProvider } from '@/_new/lib/query-provider';
import { usePathname } from 'next/navigation';
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

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  const pathname = usePathname();

  // 🔥 ROZSZERZONA LOGIKA - headery na więcej stronach
  const showHeader =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/rejestracja' ||
    pathname === '/weryfikacja' ||
    pathname === '/produkt' ||
    pathname?.startsWith('/aktualnosci') ||
    pathname?.startsWith('/podrecznik-uzytkownika') ||
    pathname?.startsWith('/dokumentacja');

  // Footer na homepage niezależnie od stanu logowania
  const showFooter =
    pathname === '/' ||
    pathname === '/produkt' ||
    pathname?.startsWith('/aktualnosci') ||
    pathname?.startsWith('/podrecznik-uzytkownika') ||
    pathname?.startsWith('/dokumentacja');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Ładowanie...</div>
      </div>
    );
  }

  return (
    <>
      {/* 🔥 Headery pokazują się na: /, /login, /rejestracja, /weryfikacja */}
      {showHeader && (
        <>
          <Ad />
          {isLoggedIn ? <AuthHeader /> : <Header />}
        </>
      )}

      <main className={isLoggedIn ? '' : 'min-h-screen'}>{children}</main>

      {/* Footer tylko na homepage */}
      {showFooter && <Footer />}
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <head>
        <meta
          name="google-site-verification"
          content="VuL3zWFM6w8FMOI-gIv-jY28fSecnsh4jeVB6QkOd3Y"
        />
        <title>EasyLesson - Korepetycje online z AI</title>
        <meta
          name="description"
          content="Platforma do korepetycji z inteligentną tablicą, AI i wszystkim czego potrzebujesz do nauki online"
        />
      </head>
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
            <LayoutContent>{children}</LayoutContent>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
