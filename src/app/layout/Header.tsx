'use client';

import React, { useState, useEffect } from 'react';
import { Menu, X, ChevronDown, ChevronRight, Globe } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { useAuth } from '../context/AuthContext';

import ProductMegaMenu from './mega-menus/ProductMegaMenu';
import CoursesMegaMenu from './mega-menus/CoursesMegaMenu';
import PricingMegaMenu from './mega-menus/PricingMegaMenu';
import NewsMegaMenu from './mega-menus/NewsMegaMenu';

import { Button } from '@/_new/shared/ui/button';

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] });

export default function Header() {
  const router = useRouter();
  const { isLoggedIn, logout, user } = useAuth();
  const [heroVisible, setHeroVisible] = useState(true);
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isHeroSectionActive = pathname === '/' && heroVisible;

  useEffect(() => {
    const hero = document.getElementById('hero');
    if (!hero) return;

    const observer = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), {
      threshold: 0,
    });

    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    const domain = window.location.hostname;

    if (lang === 'pl') {
      document.cookie = `googtrans=/pl/pl; path=/; domain=${domain};`;
      document.cookie = `googtrans=/pl/pl; path=/; domain=.${domain};`;
      document.cookie = `googtrans=/pl/pl; path=/;`;
    } else {
      const cookieValue = `/pl/${lang}`;
      document.cookie = `googtrans=${cookieValue}; path=/; domain=${domain};`;
      document.cookie = `googtrans=${cookieValue}; path=/; domain=.${domain};`;
      document.cookie = `googtrans=${cookieValue}; path=/;`;
    }
    window.location.reload();
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  useEffect(() => {
    const cookies = document.cookie.split(';');
    const googtrans = cookies.find((c) => c.trim().startsWith('googtrans='));
    if (googtrans) {
      const lang = googtrans.split('/').pop() || 'pl';
      const select = document.getElementById('lang-select') as HTMLSelectElement;
      if (select) select.value = lang === 'pl' ? 'pl' : lang;
    }
  }, []);

  const [showProductMenu, setShowProductMenu] = useState(false);
  const [showCoursesMenu, setShowCoursesMenu] = useState(false);
  const [showPricingMenu, setShowPricingMenu] = useState(false);
  const [showNewsMenu, setShowNewsMenu] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const headerBgClass = isHeroSectionActive
    ? 'bg-black/60 backdrop-blur-md border-none text-white shadow-none'
    : 'bg-white border-gray-200 shadow-md text-gray-900 border-b';

  const getMenuButtonClass = (isActive: boolean) => {
    const base =
      'hover-shine hover:cursor-pointer flex items-center justify-center gap-1 transition-colors text-sm font-medium h-full px-4 rounded-none';
    if (isHeroSectionActive) {
      return `${base} ${isActive ? 'text-black bg-white' : 'text-white hover:text-black hover:bg-white'}`;
    }
    return `${base} ${isActive ? 'text-black bg-gray-100' : 'text-gray-600 hover:text-black hover:bg-gray-100'}`;
  };

  return (
    <>
      <header
        className={`fixed top-0 z-50 w-full transition-all duration-300 lg:hidden ${plusJakarta.className}`}
        style={{
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
          boxShadow: mobileMenuOpen ? '0 14px 32px rgba(0,0,0,0.30)' : 'none',
        }}
      >
        <div className="px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href={isLoggedIn ? '/dashboard' : '/'} className="flex items-center">
              <Image
                src="/resources/LogoEasyLesson.webp"
                alt="EasyLesson Logo"
                width={150}
                height={36}
                className="h-9 w-auto"
                priority
              />
            </Link>

            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard')}>
                  Panel
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => router.push('/login')}>
                  Zaloguj się
                </Button>
              )}

              <Button
                variant="secondary"
                size="icon"
                aria-label="Otwórz menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((prev) => !prev)}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </Button>
            </div>
          </div>

          <div
            className="overflow-hidden transition-all duration-300 ease-out"
            style={{
              maxHeight: mobileMenuOpen ? '320px' : '0px',
              opacity: mobileMenuOpen ? 1 : 0,
              backgroundColor: '#FFFFFF',
              borderTop: '1px solid #F1F3F5',
            }}
          >
            <nav className="flex flex-col gap-1 pb-4 pt-1">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-semibold text-black"
              >
                Produkt
              </Link>
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-semibold text-black"
              >
                Kursy Video
              </Link>
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-semibold text-black"
              >
                Cennik
              </Link>
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-semibold text-black"
              >
                Aktualności
              </Link>
              {isLoggedIn ? (
                <Button variant="dark" size="sm" onClick={handleLogout}>
                  Wyloguj się
                </Button>
              ) : (
                <Button variant="dark" size="sm" onClick={() => router.push('/register')}>
                  Zarejestruj się
                </Button>
              )}
            </nav>
          </div>
        </div>
      </header>

      <header
        className={`fixed w-full top-0 z-50 transition-all duration-300 hidden lg:block ${headerBgClass} ${plusJakarta.className}`}
      >
        <div className="max-w-[99%] mx-auto px-6">
          <div className="flex justify-between items-center h-16">
            {/* Logo po lewej */}
            <div className="flex items-center gap-8">
              <Link href={isLoggedIn ? '/dashboard' : '/'} className="flex items-center">
                <Image
                  src={
                    isHeroSectionActive
                      ? '/resources/LogoEasyLessonWhite.webp'
                      : '/resources/LogoEasyLesson.webp'
                  }
                  alt="EasyLesson Logo"
                  width={160}
                  height={40}
                  className="h-10 w-auto transition-all duration-300"
                  priority
                />
              </Link>

              {/* Menu główne */}
              <nav className="flex items-center gap-2">
                {/* Produkt z dropdown */}
                <div
                  className="relative flex items-stretch h-16"
                  onMouseEnter={() => setShowProductMenu(true)}
                  onMouseLeave={() => setShowProductMenu(false)}
                >
                  <Link href="/product" className={getMenuButtonClass(showProductMenu)}>
                    Produkt
                    <ChevronDown className="w-4 h-4" />
                  </Link>
                </div>

                {/* Kursy z dropdown */}
                <div
                  className="relative flex items-stretch h-16"
                  onMouseEnter={() => setShowCoursesMenu(true)}
                  onMouseLeave={() => setShowCoursesMenu(false)}
                >
                  <button className={getMenuButtonClass(showCoursesMenu)}>
                    Kursy video
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Aktualności */}
                <div
                  className="relative flex items-stretch h-16"
                  onMouseEnter={() => setShowNewsMenu(true)}
                  onMouseLeave={() => setShowNewsMenu(false)}
                >
                  <button className={getMenuButtonClass(showNewsMenu)}>
                    Aktualności
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Cennik */}
                <div
                  className="relative flex items-stretch h-16"
                  onMouseEnter={() => setShowPricingMenu(true)}
                  onMouseLeave={() => setShowPricingMenu(false)}
                >
                  <button className={getMenuButtonClass(showPricingMenu)}>
                    Cennik
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </nav>
            </div>

            {/* Prawa strona */}
            <div className="flex items-center gap-2">
              {/* Kontakt z działem sprzedaży */}
              <Link
                href="/contact"
                className={`px-4 py-2 hover:cursor-pointer hover-shine text-sm font-medium transition-colors flex items-center gap-2 group ${isHeroSectionActive ? 'text-gray-200 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Kontakt z działem sprzedaży
                <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-300" />
              </Link>

              {isLoggedIn ? (
                <>
                  {user && (
                    <span
                      className={`text-sm px-2 transition-colors ${isHeroSectionActive ? 'text-white' : 'text-gray-600'}`}
                    >
                      Witaj,{' '}
                      <strong className={isHeroSectionActive ? 'text-white' : 'text-black'}>
                        {user.username}
                      </strong>
                      !
                    </span>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard')}>
                    Panel
                  </Button>
                  <Button variant="dark" size="sm" onClick={handleLogout}>
                    Wyloguj
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={() => router.push('/login')}>
                    Zaloguj
                  </Button>
                  <Button variant="dark" size="sm" onClick={() => router.push('/register')}>
                    Zarejestruj się
                  </Button>
                </>
              )}

              {/* Wersja językowa */}
              <div className="flex items-center gap-1 ml-2">
                <Globe
                  className={`w-4 h-4 transition-colors ${isHeroSectionActive ? 'text-white' : 'text-gray-500'}`}
                />
                <select
                  id="lang-select"
                  className={`bg-transparent text-sm font-medium cursor-pointer border-none outline-none transition-colors ${isHeroSectionActive ? 'text-white' : 'text-gray-700'}`}
                  defaultValue="pl"
                  onChange={handleLanguageChange}
                >
                  <option value="pl">PL</option>
                  <option value="en">EN</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Mega Menu produktu */}
        {showProductMenu && (
          <ProductMegaMenu
            isOpen={showProductMenu}
            onMouseEnter={() => setShowProductMenu(true)}
            onMouseLeave={() => setShowProductMenu(false)}
            onClose={() => setShowProductMenu(false)}
          />
        )}

        {/* Mega Menu dla Kursów */}
        {showCoursesMenu && (
          <CoursesMegaMenu
            isOpen={showCoursesMenu}
            onMouseEnter={() => setShowCoursesMenu(true)}
            onMouseLeave={() => setShowCoursesMenu(false)}
            onClose={() => setShowCoursesMenu(false)}
          />
        )}

        {/* Mega Menu dla Cennika */}
        {showPricingMenu && (
          <PricingMegaMenu
            isOpen={showPricingMenu}
            onMouseEnter={() => setShowPricingMenu(true)}
            onMouseLeave={() => setShowPricingMenu(false)}
            onClose={() => setShowPricingMenu(false)}
          />
        )}

        {/* Mega Menu dla Aktualności */}
        {showNewsMenu && (
          <NewsMegaMenu
            isOpen={showNewsMenu}
            onMouseEnter={() => setShowNewsMenu(true)}
            onMouseLeave={() => setShowNewsMenu(false)}
            onClose={() => setShowNewsMenu(false)}
          />
        )}
      </header>
    </>
  );
}
