'use client';

import React from 'react';

export default function QuickNavSection() {
  const navItems = [
    { label: 'Początek z EasyLesson', href: '#poczatek' },
    { label: 'Korzyści', href: '#korzysci' },
    { label: 'Funkcje', href: '#funkcje' },
    { label: 'Wdrożenia w szkołach', href: '#wdrozenia' },
    { label: 'Aktualności', href: '#aktualnosci' },
    { label: 'Często zadawane pytania', href: '#faq' },
    { label: 'Pakiet premium', href: '#pakiet-premium' },
  ];

  return (
    <section className="bg-white py-4">
      <div className="max-w-7xl mx-auto px-6">
        <nav className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-gray-700 hover:text-black transition-colors font-medium"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
      
      {/* Separator przez całą szerokość */}
      <div className="w-full border-b border-gray-300 mt-4"></div>
    </section>
  );
}