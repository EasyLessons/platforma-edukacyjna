import Link from 'next/link';
import Image from 'next/image';
import { Youtube, Instagram, Facebook, Mail, Phone } from 'lucide-react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import NewsletterSection from './mega-menus/NewsletterSectionProps';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '800'],
  display: 'swap',
});

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`text-[#D2D2D2] ${jakartaSans.className}`} style={{ backgroundColor: '#0f0f0f' }}>
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
                href="mailto:kontakt@easylesson.app"
                className="flex items-center gap-2 transition-colors"
                style={{ color: '#A9A9A9' }}
              >
                <Mail className="w-4 h-4" />
                <span className="text-sm">kontakt@easylesson.app</span>
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
                <Link href="/product" className="transition-colors hover:text-white" style={{ color: '#C5C5C5' }}>
                  O produkcie
                </Link>
              </li>
              <li>
                <Link href="/#pakiet-premium" className="transition-colors hover:text-white" style={{ color: '#C5C5C5' }}>
                  Cennik
                </Link>
              </li>
              <li>
                <Link href="/news" className="transition-colors hover:text-white" style={{ color: '#C5C5C5' }}>
                  Aktualności
                </Link>
              </li>
            </ul>
          </div>

          {/* Kolumna 2 - Firma */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: '#FFFFFF' }}>Firma</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/news" className="transition-colors hover:text-white" style={{ color: '#C5C5C5' }}>
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-white" style={{ color: '#C5C5C5' }}>
                  Kariera
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-white" style={{ color: '#C5C5C5' }}>
                  Kontakt
                </Link>
              </li>
            </ul>
          </div>

          {/* Kolumna 3 - Pomoc */}
          <div>
            <h3 className="font-semibold mb-4" style={{ color: '#FFFFFF' }}>Pomoc</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/contact" className="transition-colors hover:text-white" style={{ color: '#C5C5C5' }}>
                  Centrum pomocy
                </Link>
              </li>
              <li>
                <Link href="/docs" className="transition-colors hover:text-white" style={{ color: '#C5C5C5' }}>
                  Podręcznik użytkownika
                </Link>
              </li>
              <li>
                <Link href="/faq" className="transition-colors hover:text-white" style={{ color: '#C5C5C5' }}>
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="transition-colors hover:text-white" style={{ color: '#C5C5C5' }}>
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
                className="transition-colors hover:text-white"
                style={{ color: '#B1B1B1' }}
              >
                Polityka prywatności
              </Link>
              <Link
                href="/cookies-policy"
                className="transition-colors hover:text-white"
                style={{ color: '#B1B1B1' }}
              >
                Polityka cookies
              </Link>
              <Link href="/terms" className="transition-colors hover:text-white" style={{ color: '#B1B1B1' }}>
                Regulamin
              </Link>
              <Link href="/gdpr" className="transition-colors hover:text-white" style={{ color: '#B1B1B1' }}>
                RODO
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Newsletter/CTA Section */}
      <div style={{ backgroundColor: '#0b0b0b', borderTop: '1px solid #2A2A2A' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <NewsletterSection
            variant="dark"
            title="Chcesz być na bieżąco?"
            description="Otrzymuj wiadomości o nowych funkcjach, poradnikach i najlepszych praktykach prowadzenia korepetycji online."
          />
        </div>
      </div>
    </footer>
  );
};

export default Footer;
