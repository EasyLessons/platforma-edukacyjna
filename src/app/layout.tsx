'use client';

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Ad from "./layout/ad";
import Header from "./layout/Header";
import Footer from "./layout/Footer";
import AuthHeader from "./layout/AuthHeader";
// 🔥 DODAJ TE IMPORTY!
import { AuthProvider, useAuth } from './context/AuthContext';
import { usePathname } from 'next/navigation';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 🔥 NOWY WEWNĘTRZNY KOMPONENT - używa useAuth()
function LayoutContent({ children }: { children: React.ReactNode }) {
  // 🔥 Pobierz PRAWDZIWY stan logowania z Context
  const { isLoggedIn, loading } = useAuth();
  const pathname = usePathname();
  const isHomepage = pathname === '/';
  
  // Pokaż loader podczas sprawdzania
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Ładowanie...</div>
      </div>
    );
  }
  
  return (
    <>
      
      {isHomepage && (
        <>
          <Ad />
          {isLoggedIn ? <AuthHeader /> : <Header />}
        </>
      )}
      
      <main className={isLoggedIn ? "" : "min-h-screen"}>
        {children}
      </main>
      
      {/* Footer tylko na homepage dla niezalogowanych */}
      {isHomepage && !isLoggedIn && <Footer />}
    </>
  );
}

// 🔥 GŁÓWNY LAYOUT - opakowuje w AuthProvider
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <head>
        <title>EasyLesson - Korepetycje online z AI</title>
        <meta name="description" content="Platforma do korepetycji z inteligentną tablicą, AI i wszystkim czego potrzebujesz do nauki online" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* 🔥 Opakowujemy WSZYSTKO w AuthProvider */}
        <AuthProvider>
          <LayoutContent>{children}</LayoutContent>
        </AuthProvider>
      </body>
    </html>
  );
}