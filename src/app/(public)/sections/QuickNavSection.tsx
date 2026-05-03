'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
});

const navItems = [
  { label: 'Początek z EasyLesson', href: 'poczatek' },
  { label: 'Korzyści', href: 'korzysci' },
  { label: 'Funkcje', href: 'funkcje' },
  { label: 'Wdrożenia w szkołach', href: 'wdrozenia' },
  { label: 'Aktualności', href: 'aktualnosci' },
  { label: 'Często zadawane pytania', href: 'faq' },
  { label: 'Pakiet premium', href: 'pakiet-premium' },
];

export default function QuickNavSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0, rootMargin: '0px' }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sectionEls = navItems
      .map(item => document.getElementById(item.href))
      .filter(Boolean) as HTMLElement[];

    if (sectionEls.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3, rootMargin: '-80px 0px -40% 0px' }
    );

    sectionEls.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (href: string) => {
    const el = document.getElementById(href);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <>
      <section ref={sectionRef} className={`${jakartaSans.className} bg-white`}>
        <NavBar activeSection={activeSection} onItemClick={scrollTo} visible={true} />
      </section>

      {/* Sticky - animowane wjeżdżanie */}
      <div
        className={`${jakartaSans.className} fixed left-0 right-0 z-40`}
        style={{
          top: '64px',
          transform: isSticky ? 'translateY(0)' : 'translateY(-110%)',
          opacity: isSticky ? 1 : 0,
          transition: 'transform 0.30s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
          pointerEvents: isSticky ? 'auto' : 'none',
        }}
      >
        <NavBar activeSection={activeSection} onItemClick={scrollTo} visible={isSticky} />
      </div>
    </>
  );
}

function NavBar({
  activeSection,
  onItemClick,
  visible,
}: {
  activeSection: string;
  onItemClick: (href: string) => void;
  visible: boolean;
}) {
  return (
    <nav
      className="w-full bg-white"
      style={{ padding: '10px 0' }}
    >
      <div className="w-full px-6 sm:px-10">
        <ul className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2">
          {navItems.map((item) => {
            const isActive = activeSection === item.href;
            return (
              <li key={item.href}>
                <button
                  onClick={() => onItemClick(item.href)}
                  style={{
                    padding: '7px 20px',
                    borderRadius: '100px',
                    border: isActive ? '2px solid #ffce22' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: '0.92rem',
                    fontWeight: 700,
                    background: 'transparent',
                    color: isActive ? '#b8860b' : '#888',
                    transition: 'color 0.15s ease, border-color 0.15s ease, transform 0.12s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.color = '#444';
                    e.currentTarget.style.transform = 'scale(1.03)';
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.color = '#888';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}