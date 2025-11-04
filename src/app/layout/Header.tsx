import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard } from 'lucide-react';

const Header = () => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo po lewej */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image
                src="/resources/LogoEasyLesson.webp"
                alt="EasyLesson Logo"
                width={160}
                height={40}
                className="h-10 w-auto"
                priority
              />
            </Link>
          </div>

          {/* Menu po prawej */}
          <div className="flex items-center gap-4">
            
            {/* Link Ceny */}
            <Link 
              href="#pricing" 
              className="text-gray-700 hover:text-gray-900 font-medium transition-colors duration-200"
            >
              Ceny
            </Link>

            {/* Przycisk Zaloguj się */}
            <Link href="/login">
              <button className="px-4 py-2 text-gray-700 font-medium hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200">
                Zaloguj się
              </button>
            </Link>

            {/* Przycisk Zarejestruj się (zielony, wyróżniony) */}
            <Link href="/rejestracja">
              <button className="px-5 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all duration-200 shadow-md hover:shadow-lg">
                Zarejestruj się
              </button>
            </Link>

            {/* Ikonka Dashboard */}
            {/* <Link href="/dashboard">
              <button 
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200"
                aria-label="Dashboard"
              >
                <LayoutDashboard className="w-6 h-6" />
              </button>
            </Link> */}

          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;