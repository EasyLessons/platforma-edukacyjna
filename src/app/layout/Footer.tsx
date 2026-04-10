import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Youtube, Instagram, Facebook, Mail, Phone } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="text-[#D2D2D2]" style={{ backgroundColor: '#0f0f0f' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Logo i Sociale - po lewej, zajmuje 2 kolumny na desktop */}
          <div className="lg:col-span-2">
            {/* Logo większe */}
            <Link href="/" className="inline-block mb-4">
              <Image
                src="/resources/LogoEasyLessonWhite.webp"
                alt="EasyLesson Logo"
                width={220}
                height={60}
                className="h-14 w-auto"
              />
            </Link>

            {/* Opis */}
            <p className="mb-6 max-w-sm" style={{ color: '#A9A9A9' }}>
              Platforma do korepetycji online z AI, inteligentną tablicą i wszystkim czego
              potrzebujesz do skutecznej nauki.
            </p>

            {/* Sociale */}
            <div className="flex gap-4 mb-6">
              <a
                href="https://youtube.com/@easylesson"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-lg transition-all duration-300 group"
                style={{ backgroundColor: '#2A2A2A' }}
                aria-label="YouTube"
              >
                <Youtube className="w-5 h-5 group-hover:text-white" style={{ color: '#D2D2D2' }} />
              </a>

              <a
                href="https://instagram.com/easylesson"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-lg transition-all duration-300 group"
                style={{ backgroundColor: '#2A2A2A' }}
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5 group-hover:text-white" style={{ color: '#D2D2D2' }} />
              </a>

              <a
                href="https://facebook.com/easylesson"
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-lg transition-all duration-300 group"
                style={{ backgroundColor: '#2A2A2A' }}
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5 group-hover:text-white" style={{ color: '#D2D2D2' }} />
              </a>
            </div>

            {/* Kontakt */}
            <div className="space-y-2">
              <a
                href="mailto:kontakt@easylesson.pl"
                className="flex items-center gap-2 transition-colors"
                style={{ color: '#A9A9A9' }}
              >
                <Mail className="w-4 h-4" />
                <span className="text-sm">kontakt@easylesson.pl</span>
              </a>
              <a
                href="tel:+48123456789"
                className="flex items-center gap-2 transition-colors"
                style={{ color: '#A9A9A9' }}
              >
                <Phone className="w-4 h-4" />
                <span className="text-sm">+48 123 456 789</span>
              </a>
            </div>
          </div>

          {/* Kolumna 1 - Produkt */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: '#FFFFFF' }}>Produkt</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/features" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  Funkcje
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  Cennik
                </Link>
              </li>
              <li>
                <Link href="/integrations" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  Integracje
                </Link>
              </li>
              <li>
                <Link href="/changelog" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  Co nowego
                </Link>
              </li>
              <li>
                <Link href="/roadmap" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  Roadmapa
                </Link>
              </li>
            </ul>
          </div>

          {/* Kolumna 2 - Firma */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: '#FFFFFF' }}>Firma</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/about" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  O nas
                </Link>
              </li>
              <li>
                <Link href="/blog" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/careers" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  Kariera
                </Link>
              </li>
              <li>
                <Link href="/press" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  Dla prasy
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  Kontakt
                </Link>
              </li>
            </ul>
          </div>

          {/* Kolumna 3 - Pomoc i Prawne */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: '#FFFFFF' }}>Pomoc</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/help" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  Centrum pomocy
                </Link>
              </li>
              <li>
                <Link href="/docs" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  Dokumentacja
                </Link>
              </li>
              <li>
                <Link href="/tutorials" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  Tutoriale
                </Link>
              </li>
              <li>
                <Link href="/faq" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/support" className="transition-colors" style={{ color: '#C5C5C5' }}>
                  Wsparcie
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Separator */}
        <div className="mt-12 pt-8" style={{ borderTop: '1px solid #2A2A2A' }}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Copyright */}
            <p className="text-sm" style={{ color: '#8B8B8B' }}>
              © {currentYear} EasyLesson. Wszelkie prawa zastrzeżone.
            </p>

            {/* Linki prawne */}
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link
                href="/privacy-policy"
                className="transition-colors"
                style={{ color: '#B1B1B1' }}
              >
                Polityka prywatności
              </Link>
              <Link
                href="/cookie-policy"
                className="transition-colors"
                style={{ color: '#B1B1B1' }}
              >
                Polityka cookies
              </Link>
              <Link href="/terms" className="transition-colors" style={{ color: '#B1B1B1' }}>
                Regulamin
              </Link>
              <Link href="/gdpr" className="transition-colors" style={{ color: '#B1B1B1' }}>
                RODO
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Newsletter/CTA Section - opcjonalny */}
      <div style={{ backgroundColor: '#0b0b0b', borderTop: '1px solid #2A2A2A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-5">
              <h4 className="text-2xl italic mb-2" style={{ color: '#F3F4F6', fontFamily: 'var(--font-playfair)' }}>
                Chcesz być na bieżąco?
              </h4>
              <p className="text-sm leading-relaxed" style={{ color: '#B6B8BE' }}>
                Otrzymuj wiadomości o nowych funkcjach, poradnikach i najlepszych praktykach prowadzenia korepetycji online.
              </p>
            </div>

            <div className="lg:col-span-7">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Imię"
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm text-[#F9FAFB] placeholder-[#8F939C] focus:outline-none"
                  style={{ backgroundColor: '#1F232B', border: '1px solid #343A45' }}
                />
                <input
                  type="email"
                  placeholder="Adres e-mail"
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm text-[#F9FAFB] placeholder-[#8F939C] focus:outline-none"
                  style={{ backgroundColor: '#1F232B', border: '1px solid #343A45' }}
                />
                <button
                  className="px-6 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer transition-colors"
                  style={{ backgroundColor: '#4bffab', color: '#032515' }}
                >
                  Subskrybuj
                </button>
              </div>

              <div className="flex items-start gap-2 mt-3">
                <input type="checkbox" id="footer-newsletter-privacy" className="mt-0.5 cursor-pointer" />
                <label htmlFor="footer-newsletter-privacy" className="text-xs cursor-pointer" style={{ color: '#AEB2BC' }}>
                  Akceptuję politykę prywatności i wyrażam zgodę na otrzymywanie informacji handlowych.
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
