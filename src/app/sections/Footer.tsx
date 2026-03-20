'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Plus_Jakarta_Sans } from 'next/font/google';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '800'],
  display: 'swap',
});

const footerLinks = {
  produkt: [
    { label: 'Tablica', href: '/tablica#board' },
    { label: 'Narzędzia', href: '/tablica#tools' },
    { label: 'SmartSearch', href: '/tablica#smart-search' },
    { label: 'VoiceChat', href: '/tablica#voice-chat' },
    { label: 'AI Tutor', href: '/tablica#ai-tutor' },
    { label: 'Współbieżność', href: '/tablica#collaboration' },
    { label: "Workspace'y", href: '/dashboard' },
  ],
  kursy: [
    { label: 'Matematyka Podstawowa', href: '/kursy/matematyka/podstawowa' },
    { label: 'Matematyka Rozszerzona', href: '/kursy/matematyka/rozszerzona' },
  ],
  firma: [
    { label: 'Aktualności', href: '/aktualnosci' },
    { label: 'Cennik', href: '/cennik' },
    { label: 'Kontakt z działem sprzedaży', href: '/kontakt' },
    { label: 'Polityka prywatności', href: '/polityka-prywatnosci' },
    { label: 'Regulamin', href: '/regulamin' },
  ],
};

export default function Footer() {
  return (
    <div className={`${jakartaSans.className} w-full bg-white px-4 sm:px-6 lg:px-8 pb-8`}>

      <footer
        className="relative w-full overflow-hidden"
        style={{
          borderRadius: '24px',
          minHeight: '480px',
        }}
      >

        {/* Tło — ten sam gradient overlay co hero */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              160deg,
              rgba(0, 61, 167, 0.97) 0%,
              rgba(0, 115, 255, 0.95) 50%,
              rgba(0, 98, 184, 0.97) 100%
            )`,
          }}
        />

        {/* Gradient od dołu jak w hero */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.05) 40%, transparent 65%)',
          }}
        />

        {/* Dekoracyjne kolorowe kółka jak w hero */}
        <div className="absolute pointer-events-none" style={{ top: '-80px', right: '-60px', width: '340px', height: '340px', borderRadius: '50%', background: 'rgba(75,255,171,0.12)', filter: 'blur(60px)' }} />
        <div className="absolute pointer-events-none" style={{ bottom: '-60px', left: '-40px', width: '280px', height: '280px', borderRadius: '50%', background: 'rgba(255,206,34,0.10)', filter: 'blur(50px)' }} />
        <div className="absolute pointer-events-none" style={{ top: '30%', left: '20%', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,132,39,0.08)', filter: 'blur(40px)' }} />

        {/* Treść */}
        <div className="relative z-10 flex flex-col h-full px-8 sm:px-12 pt-12 pb-8">

          {/* Górna sekcja — logo + wielki CTA */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-10 mb-12 pb-10"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}
          >
            {/* Logo */}
            <Image
              src="/resources/LogoEasyLesson.webp"
              alt="EasyLesson"
              width={160}
              height={40}
              className="h-10 w-auto brightness-0 invert"
            />

            {/* CTA środek */}
            <div className="flex flex-col items-start lg:items-center text-center gap-3 flex-1">
              <p
                className="font-bold text-white"
                style={{ fontSize: 'clamp(1.4rem, 3vw, 2.4rem)', lineHeight: 1.15 }}
              >
                Jedna tablica.{' '}
                <span style={{ color: '#4bffab' }}>Milion możliwości</span>{' '}nauki.
              </p>
              <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.60)', fontWeight: 300 }}>
                Zacznij za darmo — bez karty kredytowej.
              </p>
            </div>

            {/* Przyciski */}
            <div className="flex flex-wrap gap-3 flex-shrink-0">
              <Link href="/rejestracja">
                <button
                  className="font-bold"
                  style={{
                    padding: '12px 28px',
                    borderRadius: '100px',
                    border: 'none',
                    background: '#4bffab',
                    color: '#032515',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 16px rgba(75,255,171,0.35)',
                    transition: 'transform 0.13s ease, background 0.13s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.background = 'rgb(6,250,144)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = '#4bffab'; }}
                >
                  Zarejestruj się
                </button>
              </Link>
              <Link href="/login">
                <button
                  className="font-bold"
                  style={{
                    padding: '12px 28px',
                    borderRadius: '100px',
                    border: '1.5px solid rgba(255,255,255,0.30)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.85)',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'border-color 0.13s, color 0.13s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.65)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.30)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; }}
                >
                  Zaloguj się
                </button>
              </Link>
            </div>
          </div>

          {/* Linki */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 mb-10">

            <div>
              <p className="font-bold uppercase mb-4" style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.40)', letterSpacing: '0.16em' }}>
                Produkt
              </p>
              <ul className="flex flex-col gap-2">
                {footerLinks.produkt.map(l => (
                  <li key={l.href}>
                    <Link href={l.href}
                      style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.13s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
                    >{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-bold uppercase mb-4" style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.40)', letterSpacing: '0.16em' }}>
                Kursy video
              </p>
              <ul className="flex flex-col gap-2">
                {footerLinks.kursy.map(l => (
                  <li key={l.href}>
                    <Link href={l.href}
                      style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.13s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
                    >{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="font-bold uppercase mb-4" style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.40)', letterSpacing: '0.16em' }}>
                Firma
              </p>
              <ul className="flex flex-col gap-2">
                {footerLinks.firma.map(l => (
                  <li key={l.href}>
                    <Link href={l.href}
                      style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.13s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
                    >{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Dolny pasek — jak w hero */}
          <div
            className="flex items-center justify-between pt-6"
            style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}
          >
            {/* Lewa — avatary jak w hero */}
            <div className="flex flex-col gap-1.5">
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
                Easylesson wybierają najlepsi korepetytorzy
              </p>
              <div className="flex items-center gap-1">
                {['32','47','12','25'].map((id, i) => (
                  <img
                    key={id}
                    src={`https://i.pravatar.cc/150?img=${id}`}
                    alt=""
                    className="rounded-full border-2 border-white object-cover"
                    style={{ width: '28px', height: '28px', marginLeft: i === 0 ? '0' : '-7px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
                  />
                ))}
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', marginLeft: '8px', fontWeight: 600 }}>
                  +40 użytkowników
                </span>
              </div>
            </div>

            {/* Środek — copyright */}
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.30)', fontWeight: 500 }}>
              © {new Date().getFullYear()} EasyLesson
            </p>

            {/* Prawa — social */}
            <div className="flex items-center gap-4">
              {['Instagram', 'Facebook', 'TikTok'].map(s => (
                <a
                  key={s}
                  href={`https://${s.toLowerCase()}.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontWeight: 600, letterSpacing: '0.03em', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
                >
                  {s} ↗
                </a>
              ))}
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}