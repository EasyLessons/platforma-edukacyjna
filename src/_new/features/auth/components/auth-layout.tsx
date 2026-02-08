/**
 * AUTH LAYOUT
 *
 * Layout dla podstron autoryzacji. Wszystkie dzielą wspólny.
 * Można rozbudowywać design bez ingerencji w formularze.
 * Formularze są wydzielonym komponentem aplikacji. Można je reużywać w innych miejscach.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ReactNode } from 'react';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  showBackButton?: boolean;
  backButtonHref?: string;
}

export function AuthLayout({
  title,
  subtitle,
  children,
  showBackButton = false,
  backButtonHref = '/login',
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-200 via-green-300 to-emerald-400 p-5">
      {/* Back Button */}
      {showBackButton && (
        <Link
          href={backButtonHref}
          className="absolute top-8 left-8 text-white hover:text-white/80 transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Powrót do logowania</span>
        </Link>
      )}

      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-white text-2xl font-semibold">{title}</h2>
        {subtitle && <p className="text-white/80 mt-2">{subtitle}</p>}
      </div>

      {/* Content (form) */}
      {children}
    </div>
  );
}
