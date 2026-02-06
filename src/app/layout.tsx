'use client';

import { Geist, Geist_Mono, Playfair_Display } from 'next/font/google';
import './globals.css';
import Ad from './layout/ad';
import Header from './layout/Header';
import Footer from './layout/Footer';
import AuthHeader from './layout/AuthHeader';
import { AuthProvider, useAuth } from './context/AuthContext';
import { usePathname } from 'next/navigation';
import { WorkspaceProvider } from './context/WorkspaceContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const playfair = Playfair_Display({
  variable: '--font-playfair',
  subsets: ['latin'],
  style: ['normal', 'italic'],
});

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, loading } = useAuth();
  const pathname = usePathname();

  // 🔥 ROZSZERZONA LOGIKA - headery na więcej stronach
  const showHeader =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/rejestracja' ||
    pathname === '/weryfikacja';

  // Footer tylko na homepage dla niezalogowanych
  const showFooter = pathname === '/' && !isLoggedIn;

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

      {/* Footer tylko na homepage dla niezalogowanych */}
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
        <title>EasyLesson - Korepetycje online z AI</title>
        <meta
          name="description"
          content="Platforma do korepetycji z inteligentną tablicą, AI i wszystkim czego potrzebujesz do nauki online"
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased`}>
        <AuthProvider>
          <WorkspaceProvider>
            <LayoutContent>{children}</LayoutContent>
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
