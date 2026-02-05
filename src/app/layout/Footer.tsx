import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Youtube, Instagram, Facebook, Mail, Phone } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Logo i Sociale - po lewej, zajmuje 2 kolumny na desktop */}
          <div className="lg:col-span-2">
            {/* Logo większe */}
            <Link href="/" className="inline-block mb-4">
              <Image
                src="/resources/LogoEasyLesson.webp"
                alt="EasyLesson Logo"
                width={220}
                height={60}
                className="h-14 w-auto"
              />
            </Link>

            {/* Opis */}
            <p className="text-gray-400 mb-6 max-w-sm">
              Platforma do korepetycji online z AI, inteligentną tablicą i wszystkim czego
              potrzebujesz do skutecznej nauki.
            </p>

            {/* Sociale */}
            <div className="flex gap-4 mb-6">
              <a
                href="https://youtube.com/@easylesson"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800 p-3 rounded-lg hover:bg-red-600 transition-all duration-300 group"
                aria-label="YouTube"
              >
                <Youtube className="w-5 h-5 text-gray-300 group-hover:text-white" />
              </a>

              <a
                href="https://instagram.com/easylesson"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800 p-3 rounded-lg hover:bg-pink-600 transition-all duration-300 group"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5 text-gray-300 group-hover:text-white" />
              </a>

              <a
                href="https://facebook.com/easylesson"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800 p-3 rounded-lg hover:bg-blue-600 transition-all duration-300 group"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5 text-gray-300 group-hover:text-white" />
              </a>
            </div>

            {/* Kontakt */}
            <div className="space-y-2">
              <a
                href="mailto:kontakt@easylesson.pl"
                className="flex items-center gap-2 text-gray-400 hover:text-green-500 transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span className="text-sm">kontakt@easylesson.pl</span>
              </a>
              <a
                href="tel:+48123456789"
                className="flex items-center gap-2 text-gray-400 hover:text-green-500 transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span className="text-sm">+48 123 456 789</span>
              </a>
            </div>
          </div>

          {/* Kolumna 1 - Produkt */}
          <div>
            <h3 className="text-white font-semibold mb-4">Produkt</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/features" className="hover:text-green-500 transition-colors">
                  Funkcje
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-green-500 transition-colors">
                  Cennik
                </Link>
              </li>
              <li>
                <Link href="/integrations" className="hover:text-green-500 transition-colors">
                  Integracje
                </Link>
              </li>
              <li>
                <Link href="/changelog" className="hover:text-green-500 transition-colors">
                  Co nowego
                </Link>
              </li>
              <li>
                <Link href="/roadmap" className="hover:text-green-500 transition-colors">
                  Roadmapa
                </Link>
              </li>
            </ul>
          </div>

          {/* Kolumna 2 - Firma */}
          <div>
            <h3 className="text-white font-semibold mb-4">Firma</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/about" className="hover:text-green-500 transition-colors">
                  O nas
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-green-500 transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/careers" className="hover:text-green-500 transition-colors">
                  Kariera
                </Link>
              </li>
              <li>
                <Link href="/press" className="hover:text-green-500 transition-colors">
                  Dla prasy
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-green-500 transition-colors">
                  Kontakt
                </Link>
              </li>
            </ul>
          </div>

          {/* Kolumna 3 - Pomoc i Prawne */}
          <div>
            <h3 className="text-white font-semibold mb-4">Pomoc</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/help" className="hover:text-green-500 transition-colors">
                  Centrum pomocy
                </Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-green-500 transition-colors">
                  Dokumentacja
                </Link>
              </li>
              <li>
                <Link href="/tutorials" className="hover:text-green-500 transition-colors">
                  Tutoriale
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-green-500 transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-green-500 transition-colors">
                  Wsparcie
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Copyright */}
            <p className="text-gray-500 text-sm">
              © {currentYear} EasyLesson. Wszelkie prawa zastrzeżone.
            </p>

            {/* Linki prawne */}
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link
                href="/privacy-policy"
                className="text-gray-400 hover:text-green-500 transition-colors"
              >
                Polityka prywatności
              </Link>
              <Link
                href="/cookie-policy"
                className="text-gray-400 hover:text-green-500 transition-colors"
              >
                Polityka cookies
              </Link>
              <Link href="/terms" className="text-gray-400 hover:text-green-500 transition-colors">
                Regulamin
              </Link>
              <Link href="/gdpr" className="text-gray-400 hover:text-green-500 transition-colors">
                RODO
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Newsletter/CTA Section - opcjonalny */}
      <div className="bg-gray-950 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h4 className="text-white font-semibold mb-1">Chcesz być na bieżąco?</h4>
              <p className="text-gray-400 text-sm">
                Otrzymuj porady o nauczaniu online prosto na maila
              </p>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <input
                type="email"
                placeholder="Twój email"
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 w-full md:w-64"
              />
              <Button variant="primary">Zapisz się</Button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
