'use client';

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Ad from "./layout/ad";
import Header from "./layout/Header";
import Footer from "./layout/Footer";
import AuthHeader from "./layout/AuthHeader";
import { usePathname } from "next/navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  
  // Ścieżki gdzie ukrywamy publiczny Header i pokazujemy AuthHeader
  const authPaths = ['/dashboard', '/profile', '/settings', '/'];
  
  const isAuthPage = authPaths.some(path => pathname?.startsWith(path));
  
  return (
    <html lang="pl">
      <head>
        <title>EasyLesson - Korepetycje online z AI</title>
        <meta name="description" content="Platforma do korepetycji z inteligentną tablicą, AI i wszystkim czego potrzebujesz do nauki online" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* DWA RÓŻNE HEADERY - w zależności czy zalogowany */}
        {isAuthPage ? (
          // Header dla ZALOGOWANYCH (Dashboard, Tablica, Profil)
          <>
          <Ad />
          <AuthHeader />
          </>
        ) : (
          // Header dla NIEZALOGOWANYCH (Strona główna, Ceny, Login)
          <>
          
            <Ad />
            <Header />
          </>
        )}
        
        {/* Główna zawartość strony */}
        {/* Dodaj padding-top gdy jest AuthHeader (64px wysokości) */}
        <main className={isAuthPage ? "" : "min-h-screen"} style={isAuthPage ? { paddingTop: '0px' } : {}}>
          {children}
        </main>
        
        {/* Footer - tylko dla niezalogowanych */}
        {!isAuthPage && <Footer />}
      </body>
    </html>
  );
}