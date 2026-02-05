import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LayoutDashboard } from 'lucide-react';

import { Button } from '@new/shared/ui/button';

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
              <Button variant="secondary">Zaloguj się</Button>
            </Link>

            {/* Przycisk Zarejestruj się */}
            <Link href="/rejestracja">
              <Button variant="primary">Zarejestruj się</Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
