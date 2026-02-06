'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/_new/shared/ui/button';

export default function AuthHeader() {
  const router = useRouter();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    console.log('✅ Wylogowano!');
    router.push('/');
  };

  // States for mega menus
  const [showProductMenu, setShowProductMenu] = useState(false);
  const [showCoursesMenu, setShowCoursesMenu] = useState(false);
  const [showPricingMenu, setShowPricingMenu] = useState(false);
  const [showNewsMenu, setShowNewsMenu] = useState(false);

  // States for closing animations
  const [productMenuClosing, setProductMenuClosing] = useState(false);
  const [coursesMenuClosing, setCoursesMenuClosing] = useState(false);
  const [pricingMenuClosing, setPricingMenuClosing] = useState(false);
  const [newsMenuClosing, setNewsMenuClosing] = useState(false);

  // Timeout refs
  const [productMenuTimeout, setProductMenuTimeout] = useState<NodeJS.Timeout | null>(null);
  const [coursesMenuTimeout, setCoursesMenuTimeout] = useState<NodeJS.Timeout | null>(null);
  const [pricingMenuTimeout, setPricingMenuTimeout] = useState<NodeJS.Timeout | null>(null);
  const [newsMenuTimeout, setNewsMenuTimeout] = useState<NodeJS.Timeout | null>(null);

  // Handlers for Product menu
  const handleProductMouseEnter = () => {
    if (productMenuTimeout) clearTimeout(productMenuTimeout);
    setProductMenuClosing(false);
    setShowProductMenu(true);
  };

  const handleProductMouseLeave = () => {
    const timeout = setTimeout(() => {
      setProductMenuClosing(true);
      setTimeout(() => {
        setShowProductMenu(false);
        setProductMenuClosing(false);
      }, 200);
    }, 150);
    setProductMenuTimeout(timeout);
  };

  // Handlers for Courses menu
  const handleCoursesMouseEnter = () => {
    if (coursesMenuTimeout) clearTimeout(coursesMenuTimeout);
    setCoursesMenuClosing(false);
    setShowCoursesMenu(true);
  };

  const handleCoursesMouseLeave = () => {
    const timeout = setTimeout(() => {
      setCoursesMenuClosing(true);
      setTimeout(() => {
        setShowCoursesMenu(false);
        setCoursesMenuClosing(false);
      }, 200);
    }, 150);
    setCoursesMenuTimeout(timeout);
  };

  // Handlers for Pricing menu
  const handlePricingMouseEnter = () => {
    if (pricingMenuTimeout) clearTimeout(pricingMenuTimeout);
    setPricingMenuClosing(false);
    setShowPricingMenu(true);
  };

  const handlePricingMouseLeave = () => {
    const timeout = setTimeout(() => {
      setPricingMenuClosing(true);
      setTimeout(() => {
        setShowPricingMenu(false);
        setPricingMenuClosing(false);
      }, 200);
    }, 150);
    setPricingMenuTimeout(timeout);
  };

  // Handlers for News menu
  const handleNewsMouseEnter = () => {
    if (newsMenuTimeout) clearTimeout(newsMenuTimeout);
    setNewsMenuClosing(false);
    setShowNewsMenu(true);
  };

  const handleNewsMouseLeave = () => {
    const timeout = setTimeout(() => {
      setNewsMenuClosing(true);
      setTimeout(() => {
        setShowNewsMenu(false);
        setNewsMenuClosing(false);
      }, 200);
    }, 150);
    setNewsMenuTimeout(timeout);
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-md border-b border-gray-200">
      <div className="max-w-[1400px] mx-auto px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo po lewej */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center">
              <Image
                src="/resources/LogoEasyLesson.webp"
                alt="EasyLesson Logo"
                width={160}
                height={40}
                className="h-10 w-auto"
                priority
              />
            </Link>

            {/* Menu główne */}
            <nav className="flex items-center gap-2">
              {/* Produkt z dropdown */}
              <div 
                className="relative"
                onMouseEnter={handleProductMouseEnter}
                onMouseLeave={handleProductMouseLeave}
              >
                <button className="hover-shine hover:cursor-pointer flex items-center gap-1 px-4 py-2 text-gray-500 hover:text-gray-600 hover:bg-gray-200 transition-colors text-sm font-medium rounded-md">
                  Produkt
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Kursy z dropdown */}
              <div 
                className="relative"
                onMouseEnter={handleCoursesMouseEnter}
                onMouseLeave={handleCoursesMouseLeave}
              >
                <button className="hover-shine hover:cursor-pointer flex items-center gap-1 px-4 py-2 text-gray-500 hover:text-gray-600 hover:bg-gray-200 transition-colors text-sm font-medium rounded-md">
                  Kursy video
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Aktualności */}
              <div 
                className="relative"
                onMouseEnter={handleNewsMouseEnter}
                onMouseLeave={handleNewsMouseLeave}
              >
                <button className="hover-shine hover:cursor-pointer flex items-center gap-1 px-4 py-2 text-gray-500 hover:text-gray-600 hover:bg-gray-200 transition-colors text-sm font-medium rounded-md">
                  Aktualności
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Cennik */}
              <div 
                className="relative"
                onMouseEnter={handlePricingMouseEnter}
                onMouseLeave={handlePricingMouseLeave}
              >
                <button className="hover-shine hover:cursor-pointer flex items-center gap-1 px-4 py-2 text-gray-500 hover:text-gray-600 hover:bg-gray-200 transition-colors text-sm font-medium rounded-md">
                  Cennik
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </nav>
          </div>

          {/* Prawa strona - wersja dla zalogowanych */}
          <div className="flex items-center gap-2">
            {/* Kontakt z działem sprzedaży */}
            <button className="px-4 py-2 hover:cursor-pointer hover-shine text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors flex items-center gap-2 group">
              Kontakt z działem sprzedaży
              <svg className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transform group-hover:translate-x-0.5 transition-all duration-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Witaj username */}
            {user && (
              <span className="text-gray-600 text-sm px-2">
                Witaj, <strong>{user.username}</strong>!
              </span>
            )}

            {/* Panel */}
            <Link href="/dashboard">
              <button className="hover-shine hover:cursor-pointer flex items-center gap-1 px-4 py-2 text-gray-700 hover:text-black bg-gray-200 hover:bg-gray-300 transition-colors text-sm font-medium rounded-md">
                Panel
              </button>
            </Link>

            {/* Wyloguj */}
            <button 
              onClick={handleLogout}
              className="hover-shine hover:cursor-pointer flex items-center gap-1 px-4 py-2 text-gray-100 hover:text-white hover:bg-gray-200 transition-colors text-sm font-medium rounded-md"
              style={{ backgroundColor: '#212224' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#37383c'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#212224'}
            >
              Wyloguj
            </button>

            {/* Wersja językowa */}
            <div className="flex items-center gap-1 ml-2">
              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
              </svg>
              <select 
                className="bg-transparent text-gray-700 text-sm font-medium cursor-pointer border-none outline-none"
                defaultValue="pl"
              >
                <option value="pl">PL</option>
                <option value="en">EN</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Mega Menu - Produkt */}
      {(showProductMenu || productMenuClosing) && (
        <>
          {/* Backdrop - blur i przyciemnienie TYLKO dla contentu pod headerem */}
          <div 
            className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-30 ${productMenuClosing ? 'animate-backdropFadeOut' : 'animate-backdropFadeIn'}`}
            style={{ 
              top: '64px'
            }}
            onClick={() => setShowProductMenu(false)}
          />
          
          {/* Mega Menu */}
          <div 
            className="fixed left-0 right-0 top-16 z-50 mega-menu-extend"
            onMouseEnter={handleProductMouseEnter}
            onMouseLeave={handleProductMouseLeave}
          >
            {/* Białe tło mega menu z animacją */}
            <div 
              className={`bg-white ${productMenuClosing ? 'animate-megaMenuFadeOut' : 'animate-slideDown'}`}
              style={{
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
              }}
            >
              <div className="max-w-[1400px] mx-auto px-6 pb-8">
                <div className="grid grid-cols-12 gap-8 pt-8">
                  {/* Kolumna 1 - Dashboard */}
                  <div className="col-span-3 animate-fadeInUp" style={{ animationDelay: '0ms' }}>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Dashboard
                    </h3>
                    <div className="space-y-1">
                      <Link 
                        href="/dashboard" 
                        className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                      >
                        <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-base">Workspace'y</span>
                          <span className="text-xs text-gray-500 mt-0.5">Zarządzaj projektami i zespołem</span>
                        </div>
                      </Link>
                      <Link 
                        href="/tablica" 
                        className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                      >
                        <div className="w-6 h-6 bg-green-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-base">Tablice Workspace'u</span>
                          <span className="text-xs text-gray-500 mt-0.5">Lista wszystkich tablic w projekcie</span>
                        </div>
                      </Link>
                    </div>
                  </div>

                  {/* Kolumna 2 - Tutoring Board */}
                  <div className="col-span-3 animate-fadeInUp" style={{ animationDelay: '50ms' }}>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Tutoring Board
                    </h3>
                    <div className="space-y-1">
                      <Link 
                        href="/tablica#board" 
                        className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                      >
                        <div className="w-6 h-6 bg-purple-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-base">Tablica</span>
                          <span className="text-xs text-gray-500 mt-0.5">Interaktywna przestrzeń do nauki</span>
                        </div>
                      </Link>
                      <Link 
                        href="/tablica#tools" 
                        className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                      >
                        <div className="w-6 h-6 bg-orange-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-base">Narzędzia</span>
                          <span className="text-xs text-gray-500 mt-0.5">Kalkulator, wykres i więcej</span>
                        </div>
                      </Link>
                      <Link 
                        href="/tablica#smart-search" 
                        className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                      >
                        <div className="w-6 h-6 bg-cyan-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-base">SmartSearch</span>
                          <span className="text-xs text-gray-500 mt-0.5">Wyszukiwarka arkuszy i zadań</span>
                        </div>
                      </Link>
                      <Link 
                        href="/tablica#voice-chat" 
                        className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                      >
                        <div className="w-6 h-6 bg-pink-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-base">VoiceChat</span>
                          <span className="text-xs text-gray-500 mt-0.5">Komunikacja głosowa z AI</span>
                        </div>
                      </Link>
                      <Link 
                        href="/tablica#ai-tutor" 
                        className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                      >
                        <div className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-base">AI Tutor</span>
                          <span className="text-xs text-gray-500 mt-0.5">Inteligentny asystent nauki</span>
                        </div>
                      </Link>
                      <Link 
                        href="/tablica#collaboration" 
                        className="hover-shine flex items-start gap-3 px-3 py-2 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-md transition-all group"
                      >
                        <div className="w-6 h-6 bg-emerald-500 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-base">Współbieżność</span>
                          <span className="text-xs text-gray-500 mt-0.5">Praca w czasie rzeczywistym</span>
                        </div>
                      </Link>
                    </div>
                  </div>

                  {/* Kolumna 3 - Poradnik */}
                  <div className="col-span-6 animate-fadeInUp" style={{ animationDelay: '100ms' }}>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Zapoznaj się z EasyLesson
                    </h3>
                    <div className="bg-gray-100 rounded-lg overflow-hidden shadow-md">
                      <div className="aspect-video relative">
                        <iframe
                          width="100%"
                          height="100%"
                          src="https://www.youtube.com/embed/r0vrPSZjWMQ?start=0"
                          title="Historie użytkowników"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="rounded-lg"
                        />
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm mt-3 leading-snug">
                      Zobacz, jak EasyLesson pomaga nauczycielom i uczniom osiągać lepsze wyniki
                    </p>
                  </div>
                </div>

                {/* Separator i Newsletter */}
                <div className="border-t border-gray-200 mt-8 pt-6 animate-newsletterFadeIn">
                  <div className="grid grid-cols-12 gap-8 items-center">
                    <div className="col-span-5">
                      <h3 className="text-2xl font-playfair italic text-gray-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
                        Dołącz do naszej społeczności
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        Otrzymuj wiadomości o nowych funkcjach, poradnikach i najlepszych praktykach w edukacji online.
                      </p>
                    </div>
                    <div className="col-span-7">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          placeholder="Imię"
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <input
                          type="email"
                          placeholder="Adres e-mail"
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button 
                          className="hover-shine hover:cursor-pointer px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors"
                          style={{ backgroundColor: '#212224' }}
                        >
                          Subskrybuj
                        </button>
                      </div>
                      <div className="flex items-start gap-2 mt-3">
                        <input type="checkbox" id="newsletter-privacy" className="mt-0.5 cursor-pointer" />
                        <label htmlFor="newsletter-privacy" className="text-xs text-gray-600 cursor-pointer">
                          Akceptuję <a href="#" className="text-blue-600 hover:underline">politykę prywatności</a> i wyrażam zgodę na otrzymywanie informacji handlowych
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mega Menu dla Kursów */}
      {(showCoursesMenu || coursesMenuClosing) && (
        <>
          {/* Backdrop */}
          <div 
            className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-30 ${coursesMenuClosing ? 'animate-backdropFadeOut' : 'animate-backdropFadeIn'}`}
            style={{ 
              top: '64px'
            }}
            onClick={() => setShowCoursesMenu(false)}
          />
          
          {/* Mega Menu */}
          <div 
            className="fixed left-0 right-0 top-16 z-50 mega-menu-extend"
            onMouseEnter={handleCoursesMouseEnter}
            onMouseLeave={handleCoursesMouseLeave}
          >
            {/* Białe tło mega menu z animacją */}
            <div 
              className={`bg-white ${coursesMenuClosing ? 'animate-megaMenuFadeOut' : 'animate-slideDown'}`}
              style={{
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
              }}
            >
              <div className="max-w-[1400px] mx-auto px-6 pb-8">
                <div className="grid grid-cols-12 gap-8 pt-8">
                  {/* Kolumna 1 - Matematyka */}
                  <div className="col-span-6 animate-fadeInUp" style={{ animationDelay: '0ms' }}>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                      Matematyka
                    </h3>
                    <div className="space-y-2">
                      {/* Matematyka Podstawowa */}
                      <Link 
                        href="/kursy/matematyka/podstawowa" 
                        className="hover-shine flex items-start gap-3 px-4 py-3 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-lg transition-all group"
                      >
                        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                          </svg>
                        </div>
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-base">Matematyka Podstawowa</span>
                            <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-xs text-gray-500 mt-1">17 działów | Ponad 300 filmów</span>
                        </div>
                      </Link>

                      {/* Matematyka Rozszerzona */}
                      <Link 
                        href="/kursy/matematyka/rozszerzona" 
                        className="hover-shine flex items-start gap-3 px-4 py-3 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-lg transition-all group"
                      >
                        <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-base">Matematyka Rozszerzona</span>
                            <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-xs text-gray-500 mt-1">17 działów | Ponad 500 filmów</span>
                        </div>
                      </Link>
                    </div>

                    {/* Wyróżniony bloczek z informacją */}
                    <div className="mt-6 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-5 animate-fadeInUp" style={{ animationDelay: '100ms' }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-1">100% Gwarancja satysfakcji</h4>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            Tworzone przez korepetytorów z wieloletnim doświadczeniem. Profesjonalne filmy w łatwej i ładnej formie video.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                  </div>

                  {/* Kolumna 2 - Program Kursów + Gwarancja */}
                  <div className="col-span-6 animate-fadeInUp" style={{ animationDelay: '50ms' }}>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                      Zapoznaj się z programem kursów
                    </h3>
                    
                    {/* Film YouTube */}
                    <div className="bg-gray-100 rounded-xl overflow-hidden shadow-md mb-4">
                      <div className="aspect-video relative">
                        <iframe
                          width="100%"
                          height="100%"
                          src="https://www.youtube.com/embed/YBW-EY4OJT0"
                          title="Program kursów matematyki"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-5 leading-snug">
                      Zobacz dokładny przegląd tematów objętych kursem matematyki
                    </p>

                    
                  </div>
                </div>

                {/* Separator i Newsletter */}
                <div className="border-t border-gray-200 mt-8 pt-6 animate-newsletterFadeIn">
                  <div className="grid grid-cols-12 gap-8 items-center">
                    <div className="col-span-5">
                      <h3 className="text-2xl font-playfair italic text-gray-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
                        Bądź na bieżąco z nowościami
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        Dowiedz się jako pierwszy o nowych kursach, materiałach i funkcjach platformy.
                      </p>
                    </div>
                    <div className="col-span-7">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          placeholder="Imię"
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <input
                          type="email"
                          placeholder="Adres e-mail"
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        <button 
                          className="hover-shine hover:cursor-pointer px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors"
                          style={{ backgroundColor: '#212224' }}
                        >
                          Subskrybuj
                        </button>
                      </div>
                      <div className="flex items-start gap-2 mt-3">
                        <input type="checkbox" id="courses-newsletter-privacy" className="mt-0.5 cursor-pointer" />
                        <label htmlFor="courses-newsletter-privacy" className="text-xs text-gray-600 cursor-pointer">
                          Akceptuję <a href="#" className="text-blue-600 hover:underline">politykę prywatności</a> i wyrażam zgodę na otrzymywanie informacji handlowych
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mega Menu dla Cennika */}
      {(showPricingMenu || pricingMenuClosing) && (
        <>
          {/* Backdrop */}
          <div 
            className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-30 ${pricingMenuClosing ? 'animate-backdropFadeOut' : 'animate-backdropFadeIn'}`}
            style={{ 
              top: '64px'
            }}
            onClick={() => setShowPricingMenu(false)}
          />
          
          {/* Mega Menu */}
          <div 
            className="fixed left-0 right-0 top-16 z-50 mega-menu-extend"
            onMouseEnter={handlePricingMouseEnter}
            onMouseLeave={handlePricingMouseLeave}
          >
            {/* Białe tło mega menu z animacją */}
            <div 
              className={`bg-white ${pricingMenuClosing ? 'animate-megaMenuFadeOut' : 'animate-slideDown'}`}
              style={{
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
              }}
            >
              <div className="max-w-[1400px] mx-auto px-6 pb-8">
                <div className="grid grid-cols-12 gap-8 pt-8">
                  {/* Kolumna 1 - Ceny */}
                  <div className="col-span-4 animate-fadeInUp" style={{ animationDelay: '0ms' }}>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                      Ceny
                    </h3>
                    
                    {/* Link do szczegółowego cennika */}
                    <Link 
                      href="/cennik" 
                      className="hover-shine flex items-start gap-3 px-4 py-3 text-gray-700 hover:text-black hover:bg-gray-200/70 rounded-lg transition-all group mb-5"
                    >
                      <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">Cennik - szczegóły</span>
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-xs text-gray-500 mt-1">Zobacz pełną listę funkcji</span>
                      </div>
                    </Link>

                    {/* Film z Historiami użytkowników */}
                    <div className="bg-gray-100 rounded-xl overflow-hidden shadow-md">
                      <div className="aspect-video relative">
                        <iframe
                          width="100%"
                          height="100%"
                          src="https://www.youtube.com/embed/Jc72Ot0Qdq0"
                          title="Historie użytkowników"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm mt-3 leading-snug">
                      Zobacz co czeka się w planie premium i dlaczego warto zainwestować w lepsze narzędzia do nauki!
                    </p>
                  </div>

                  {/* Kolumna 2 - Szybkie porównanie */}
                  <div className="col-span-4 animate-fadeInUp" style={{ animationDelay: '50ms' }}>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                      Szybkie porównanie
                    </h3>
                    
                    {/* Tabela porównawcza */}
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm table-fixed">
                        <colgroup>
                          <col style={{ width: '50%' }} />
                          <col style={{ width: '25%' }} />
                          <col style={{ width: '25%' }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 font-semibold text-gray-700">Funkcja</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-700">Free</th>
                            <th className="text-center px-4 py-3 font-semibold text-indigo-600">Premium</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          <tr className="hover:bg-gray-50 transition-colors h-14">
                            <td className="px-4 py-3 text-gray-700">Liczba workspace'ów</td>
                            <td className="text-center px-4 py-3 text-gray-600">3</td>
                            <td className="text-center px-4 py-3 font-semibold text-indigo-600">Nielimitowane</td>
                          </tr>
                          <tr className="hover:bg-gray-50 transition-colors h-14">
                            <td className="px-4 py-3 text-gray-700">Liczba tablic</td>
                            <td className="text-center px-4 py-3 text-gray-600">3</td>
                            <td className="text-center px-4 py-3 font-semibold text-indigo-600">Nielimitowane</td>
                          </tr>
                          <tr className="hover:bg-gray-50 transition-colors h-14">
                            <td className="px-4 py-3 text-gray-700">Współpraca realtime</td>
                            <td className="text-center px-4 py-3 text-gray-600">2 osoby</td>
                            <td className="text-center px-4 py-3 font-semibold text-indigo-600"> 15 osób</td>
                          </tr>
                          <tr className="hover:bg-gray-50 transition-colors h-14">
                            <td className="px-4 py-3 text-gray-700">Ilość elementów na tablicy</td>
                            <td className="text-center px-4 py-3 text-gray-600">500</td>
                            <td className="text-center px-4 py-3 font-semibold text-indigo-600">Nielimitowane</td>
                          </tr>
                          <tr className="hover:bg-gray-50 transition-colors h-14">
                            <td className="px-4 py-3 text-gray-700">Chat na tablicy</td>
                            <td className="text-center px-4 py-3 text-gray-600">5 pytań</td>
                            <td className="text-center px-4 py-3 font-semibold text-indigo-600">Nielimitowane</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Kolumna 3 - Zaawansowane funkcje + CTA */}
                  <div className="col-span-4 animate-fadeInUp" style={{ animationDelay: '100ms' }}>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                      &nbsp;
                    </h3>
                    
                    {/* Kontynuacja tabeli - zaawansowane narzędzia */}
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-5">
                      <table className="w-full text-sm table-fixed">
                        <colgroup>
                          <col style={{ width: '50%' }} />
                          <col style={{ width: '25%' }} />
                          <col style={{ width: '25%' }} />
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-4 py-3 font-semibold text-gray-700">Zaawansowane</th>
                            <th className="text-center px-4 py-3 font-semibold text-gray-700">Free</th>
                            <th className="text-center px-4 py-3 font-semibold text-indigo-600">Premium</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          <tr className="hover:bg-gray-50 transition-colors h-14">
                            <td className="px-4 py-3 text-gray-700 h-14">Narzędzia matematyczne</td>
                            <td className="text-center px-4 py-3">
                              <svg className="w-5 h-5 text-red-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </td>
                            <td className="text-center px-4 py-3 align-middle">
                              {/* Zielone kółko z checkmarkiem + cień */}
                              <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </td>
                          </tr>
                          <tr className="hover:bg-gray-50 transition-colors h-14">
                            <td className="px-4 py-3 text-gray-700 h-14">Rysowanie funkcji</td>
                            <td className="text-center px-4 py-3">
                              <svg className="w-5 h-5 text-red-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </td>
                            <td className="text-center px-4 py-3 align-middle">
                              {/* Zielone kółko z checkmarkiem + cień */}
                              <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </td>
                          </tr>
                          <tr className="hover:bg-gray-50 transition-colors h-14">
                            <td className="px-4 py-3 text-gray-700 h-14">Kalkulator naukowy</td>
                            <td className="text-center px-4 py-3">
                              <svg className="w-5 h-5 text-red-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </td>
                            <td className="text-center px-4 py-3 align-middle">
                              {/* Zielone kółko z checkmarkiem + cień */}
                              <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </td>
                          </tr>
                          <tr className="hover:bg-gray-50 transition-colors h-14">
                            <td className="px-4 py-3 text-gray-700 h-14">AI Tutor</td>
                            <td className="text-center px-4 py-3">
                              <svg className="w-5 h-5 text-red-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </td>
                            <td className="text-center px-4 py-3 align-middle">
                              {/* Zielone kółko z checkmarkiem + cień */}
                              <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </td>
                          </tr>
                          <tr className="hover:bg-gray-50 transition-colors h-14">
                            <td className="px-4 py-3 text-gray-700 h-14">Export do PDF</td>
                            <td className="text-center px-4 py-3">
                              <svg className="w-5 h-5 text-red-500 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </td>
                            <td className="text-center px-4 py-3 align-middle">
                              {/* Zielone kółko z checkmarkiem + cień */}
                              <div className="inline-flex items-center justify-center w-5 h-5 bg-green-500 rounded-full shadow-sm">
                                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* CTA Button */}
                    <Link href="/rejestracja?plan=premium">
                      <button 
                        className="hover-shine hover:cursor-pointer w-full flex items-center justify-center gap-2 px-6 py-4 text-white hover:text-white transition-all text-base font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        style={{ backgroundColor: '#212224' }}
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 1.414L10.586 9H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                        </svg>
                        Przejdź na Premium
                      </button>
                    </Link>
                    <p className="text-center text-xs text-gray-500 mt-3">
                      14 dni okres testowy za darmo
                    </p>
                  </div>
                </div>

                {/* Separator i Newsletter */}
                <div className="border-t border-gray-200 mt-8 pt-6 animate-newsletterFadeIn">
                  <div className="grid grid-cols-12 gap-8 items-center">
                    <div className="col-span-5">
                      <h3 className="text-2xl font-playfair italic text-gray-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
                        Otrzymuj oferty specjalne
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        Darmowe miesiące, zniżki dla nauczycieli i ekskluzywne promocje - tylko dla subskrybentów.
                      </p>
                    </div>
                    <div className="col-span-7">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          placeholder="Imię"
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        <input
                          type="email"
                          placeholder="Adres e-mail"
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        <button 
                          className="hover-shine hover:cursor-pointer px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors"
                          style={{ backgroundColor: '#212224' }}
                        >
                          Subskrybuj
                        </button>
                      </div>
                      <div className="flex items-start gap-2 mt-3">
                        <input type="checkbox" id="pricing-newsletter-privacy" className="mt-0.5 cursor-pointer" />
                        <label htmlFor="pricing-newsletter-privacy" className="text-xs text-gray-600 cursor-pointer">
                          Akceptuję <a href="#" className="text-blue-600 hover:underline">politykę prywatności</a> i wyrażam zgodę na otrzymywanie informacji handlowych
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mega Menu dla Aktualności */}
      {(showNewsMenu || newsMenuClosing) && (
        <>
          {/* Backdrop */}
          <div 
            className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-30 ${newsMenuClosing ? 'animate-backdropFadeOut' : 'animate-backdropFadeIn'}`}
            style={{ 
              top: '64px'
            }}
            onClick={() => setShowNewsMenu(false)}
          />
          
          {/* Mega Menu */}
          <div 
            className="fixed left-0 right-0 top-16 z-50 mega-menu-extend"
            onMouseEnter={handleNewsMouseEnter}
            onMouseLeave={handleNewsMouseLeave}
          >
            {/* Białe tło mega menu z animacją */}
            <div 
              className={`bg-white ${newsMenuClosing ? 'animate-megaMenuFadeOut' : 'animate-slideDown'}`}
              style={{
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
              }}
            >
              <div className="max-w-[1400px] mx-auto px-6 pb-8">
                {/* Header z przyciskiem */}
                <div className="flex items-center justify-between mb-6 pt-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
                        <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Aktualności EasyLesson</h2>
                      <p className="text-sm text-gray-500">Najnowsze funkcje i aktualizacje platformy</p>
                    </div>
                  </div>
                  <Link 
                    href="/aktualnosci" 
                    className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium text-sm group"
                  >
                    Zobacz wszystkie aktualności
                    <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </Link>
                </div>

                {/* Grid z 3 artykułami */}
                <div className="grid grid-cols-3 gap-6">
                  {/* Artykuł 1 */}
                  <Link 
                    href="/aktualnosci/nowe-narzedzia-matematyczne" 
                    className="parallax-container group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-200 animate-fadeInUp"
                    style={{ animationDelay: '0ms' }}
                  >
                    <div className="aspect-video relative overflow-hidden">
                      <img 
                        src="/resources/Aktualnosci/Nowosc.jpg" 
                        alt="Nowe narzędzia matematyczne"
                        className="parallax-image w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">Nowe funkcje</span>
                        <span className="text-xs text-gray-500">2 dni temu</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">
                        Zaawansowane narzędzia matematyczne
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        Dodaliśmy nowy kalkulator naukowy, rysowanie funkcji matematycznych i zaawansowany edytor równań. Idealne dla nauczycieli matematyki!
                      </p>
                    </div>
                  </Link>

                  {/* Artykuł 2 */}
                  <Link 
                    href="/aktualnosci/ai-tutor-ulepszenia" 
                    className="parallax-container group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-200 animate-fadeInUp"
                    style={{ animationDelay: '50ms' }}
                  >
                    <div className="aspect-video relative overflow-hidden">
                      <img 
                        src="/resources/Aktualnosci/Nauczyciel.jpg" 
                        alt="AI Tutor - lepsze odpowiedzi"
                        className="parallax-image w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded">AI</span>
                        <span className="text-xs text-gray-500">5 dni temu</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">
                        AI Tutor - lepsze odpowiedzi i kontekst
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        Ulepszyliśmy algorytm AI Tutora! Teraz jeszcze lepiej rozumie kontekst pytań i udziela bardziej szczegółowych odpowiedzi.
                      </p>
                    </div>
                  </Link>

                  {/* Artykuł 3 */}
                  <Link 
                    href="/aktualnosci/wspolpraca-realtime" 
                    className="parallax-container group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-200 animate-fadeInUp"
                    style={{ animationDelay: '100ms' }}
                  >
                    <div className="aspect-video relative overflow-hidden">
                      <img 
                        src="/resources/Aktualnosci/Wspolbieznosc.jpg" 
                        alt="Współpraca w czasie rzeczywistym"
                        className="parallax-image w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">Współpraca</span>
                        <span className="text-xs text-gray-500">1 tydzień temu</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors">
                        Współpraca w czasie rzeczywistym do 50 osób
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        Zwiększyliśmy limit współpracy realtime! Teraz w planie Premium do 50 osób może pracować jednocześnie na tablicy.
                      </p>
                    </div>
                  </Link>
                </div>

                {/* Separator i Newsletter */}
                <div className="border-t border-gray-200 mt-8 pt-6 animate-newsletterFadeIn">
                  <div className="grid grid-cols-12 gap-8 items-center">
                    <div className="col-span-5">
                      <h3 className="text-2xl font-playfair italic text-gray-900 mb-2" style={{ fontFamily: 'var(--font-playfair)' }}>
                        Nie przegap żadnej nowości
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        Najświeższe aktualizacje, nowe funkcje i case studies od naszej społeczności edukatorów.
                      </p>
                    </div>
                    <div className="col-span-7">
                      <div className="flex gap-3">
                        <input
                          type="text"
                          placeholder="Imię"
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                        <input
                          type="email"
                          placeholder="Adres e-mail"
                          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                        <button 
                          className="hover-shine hover:cursor-pointer px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors"
                          style={{ backgroundColor: '#212224' }}
                        >
                          Subskrybuj
                        </button>
                      </div>
                      <div className="flex items-start gap-2 mt-3">
                        <input type="checkbox" id="news-newsletter-privacy" className="mt-0.5 cursor-pointer" />
                        <label htmlFor="news-newsletter-privacy" className="text-xs text-gray-600 cursor-pointer">
                          Akceptuję <a href="#" className="text-blue-600 hover:underline">politykę prywatności</a> i wyrażam zgodę na otrzymywanie informacji handlowych
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </header>
  );
}
