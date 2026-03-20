'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus_Jakarta_Sans } from 'next/font/google';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '800'],
  display: 'swap',
});

const freeFeatures = [
  { text: '3 tablice jednocześnie', included: true },
  { text: 'Podstawowa współpraca', included: true },
  { text: 'SmartSearch — 20 wyszukań / mies.', included: true },
  { text: 'Chat AI — 10 wiadomości / mies.', included: true },
  { text: 'Konwersja LaTeX — 5 / mies.', included: true },
  { text: 'Współdzielenie tablicy', included: true },
  { text: 'Biblioteka plików', included: false },
  { text: 'Rozszerzenie do przeglądarki', included: false },
  { text: 'Priorytetowe wsparcie', included: false },
];

const proFeatures = [
  { text: 'Nieograniczone tablice', included: true },
  { text: 'Zaawansowana współpraca', included: true },
  { text: 'SmartSearch — UNLIMITED', included: true },
  { text: 'Chat AI — 500 wiadomości / mies.', included: true },
  { text: 'Konwersja LaTeX — UNLIMITED', included: true },
  { text: 'Współdzielenie tablicy', included: true },
  { text: 'Biblioteka plików — 10 GB', included: true },
  { text: 'Rozszerzenie do przeglądarki', included: true },
  { text: 'Export do PDF/PNG', included: true },
  { text: 'Historia zmian — 30 dni', included: true },
  { text: 'Priorytetowe wsparcie', included: true },
];

const comparisonFeatures = [
  { name: 'Liczba tablic', free: '3', pro: '∞' },
  { name: 'Współpraca w czasie rzeczywistym', free: '✓', pro: '✓' },
  { name: 'SmartSearch wzorów', free: '20/mies.', pro: '∞' },
  { name: 'Chat AI', free: '10 msg/mies.', pro: '500 msg/mies.' },
  { name: 'Konwersja LaTeX', free: '5/mies.', pro: '∞' },
  { name: 'Biblioteka plików', free: '—', pro: '10 GB' },
  { name: 'Rozszerzenie Chrome/Firefox', free: '—', pro: '✓' },
  { name: 'Export do PDF/PNG', free: '—', pro: '✓' },
  { name: 'Historia zmian', free: '—', pro: '30 dni' },
  { name: 'Max osób na tablicy', free: '5', pro: '∞' },
  { name: 'Własne szablony', free: '—', pro: '✓' },
  { name: 'Priorytetowe wsparcie', free: '—', pro: '✓' },
];

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="9" fill="#2bcc82" />
      <path d="M5 9.5l2.5 2.5 5.5-5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="9" fill="#f0f0f0" />
      <path d="M6 6l6 6M12 6l-6 6" stroke="#ccc" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function PricingSection() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className={`${jakartaSans.className} w-full bg-white px-4 sm:px-6 lg:px-8 py-8`} id="pakiet-premium">

      {/* Wrapper - ciemny blok jak EasyLessonInfoSection */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          borderRadius: '24px',
          background: '#111112',
          padding: '5vh clamp(1.5rem, 4vw, 4rem)',
        }}
      >

        {/* Siatka */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Blask zielony w tle */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '-80px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '600px',
            height: '300px',
            borderRadius: '50%',
            background: 'rgba(43,204,130,0.08)',
            filter: 'blur(80px)',
          }}
        />

        {/* Nagłówek */}
        <div className="relative text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div
              className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[9px] rotate-90"
              style={{ borderBottomColor: '#2bcc82' }}
            />
            <span
              className="font-semibold tracking-widest uppercase"
              style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.14em' }}
            >
              CENNIK
            </span>
          </div>

          <h2
            className="font-bold text-white mb-3"
            style={{ fontSize: 'clamp(1.8rem, 4vw, 3.6rem)', lineHeight: 1.1 }}
          >
            Zacznij za darmo.{' '}
            <span style={{ color: '#2bcc82' }}>Skaluj gdy chcesz.</span>
          </h2>

          <p
            className="font-light"
            style={{ fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)', color: 'rgba(255,255,255,0.50)', maxWidth: '500px', margin: '0 auto' }}
          >
            Bez karty kredytowej. Bez ukrytych opłat. Upgrade w każdej chwili.
          </p>

          {/* Toggle miesięcznie / rocznie */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span
              className="font-semibold"
              style={{ fontSize: '0.85rem', color: yearly ? 'rgba(255,255,255,0.4)' : '#fff' }}
            >
              Miesięcznie
            </span>
            <button
              onClick={() => setYearly(v => !v)}
              className="relative"
              style={{
                width: '48px',
                height: '26px',
                borderRadius: '100px',
                background: yearly ? '#2bcc82' : 'rgba(255,255,255,0.15)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '3px',
                  left: yearly ? '25px' : '3px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              />
            </button>
            <span
              className="font-semibold"
              style={{ fontSize: '0.85rem', color: yearly ? '#fff' : 'rgba(255,255,255,0.4)' }}
            >
              Rocznie
              <span
                className="ml-2 font-bold"
                style={{
                  fontSize: '0.72rem',
                  background: '#ffce22',
                  color: '#6b4400',
                  padding: '2px 8px',
                  borderRadius: '100px',
                }}
              >
                -17%
              </span>
            </span>
          </div>
        </div>

        {/* Karty planów */}
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-5 mb-12" style={{ maxWidth: '860px', margin: '0 auto 3rem auto' }}>

          {/* FREE */}
          <div
            style={{
              borderRadius: '20px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
              padding: '2.5rem 2rem',
            }}
          >
            <p
              className="font-bold uppercase mb-4"
              style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.40)', letterSpacing: '0.14em' }}
            >
              Darmowy
            </p>
            <div className="flex items-end gap-2 mb-1">
              <span className="font-bold text-white" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1 }}>€0</span>
              <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.40)', paddingBottom: '6px' }}>/ miesiąc</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.25)', marginBottom: '1.8rem' }}>Na zawsze bezpłatny</p>

            <Link href="/rejestracja">
              <button
                className="w-full font-bold"
                style={{
                  padding: '12px 0',
                  borderRadius: '100px',
                  border: '1.5px solid rgba(255,255,255,0.20)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.80)',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  marginBottom: '1.8rem',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.20)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.80)';
                }}
              >
                Zacznij za darmo
              </button>
            </Link>

            <ul className="flex flex-col gap-3">
              {freeFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-3">
                  {f.included ? <CheckIcon /> : <CrossIcon />}
                  <span
                    style={{
                      fontSize: '0.85rem',
                      color: f.included ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.28)',
                    }}
                  >
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* PRO */}
          <div
            className="relative"
            style={{
              borderRadius: '20px',
              background: 'linear-gradient(145deg, rgba(43,204,130,0.15) 0%, rgba(43,204,130,0.06) 100%)',
              border: '1.5px solid rgba(43,204,130,0.45)',
              padding: '2.5rem 2rem',
            }}
          >
            {/* Badge najpopularniejszy */}
            <div
              className="absolute font-bold"
              style={{
                top: '-14px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#2bcc82',
                color: '#032515',
                fontSize: '0.7rem',
                padding: '4px 16px',
                borderRadius: '100px',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
              }}
            >
              NAJPOPULARNIEJSZY
            </div>

            <p
              className="font-bold uppercase mb-4"
              style={{ fontSize: '0.7rem', color: '#2bcc82', letterSpacing: '0.14em' }}
            >
              Pro
            </p>
            <div className="flex items-end gap-2 mb-1">
              <span className="font-bold text-white" style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1 }}>
                {yearly ? '€10' : '€12'}
              </span>
              <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.40)', paddingBottom: '6px' }}>/ miesiąc</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginBottom: '1.8rem' }}>
              {yearly ? 'Rozliczane rocznie (€120/rok)' : 'lub €10/mies. płatne rocznie'}
            </p>

            <Link href="/rejestracja?plan=pro">
              <button
                className="w-full font-bold"
                style={{
                  padding: '12px 0',
                  borderRadius: '100px',
                  border: 'none',
                  background: '#2bcc82',
                  color: '#032515',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  marginBottom: '1.8rem',
                  boxShadow: '0 4px 20px rgba(43,204,130,0.35)',
                  transition: 'transform 0.13s ease, background 0.13s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.background = '#22e08d';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.background = '#2bcc82';
                }}
              >
                Wypróbuj PRO — 14 dni za darmo
              </button>
            </Link>

            <ul className="flex flex-col gap-3">
              {proFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-3">
                  <CheckIcon />
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.80)' }}>
                    {f.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Tabela porównawcza */}
        <div className="relative" style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h3
            className="font-bold text-white text-center mb-6"
            style={{ fontSize: 'clamp(1.2rem, 2vw, 1.8rem)' }}
          >
            Szczegółowe porównanie
          </h3>

          <div
            style={{
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <table className="w-full">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th className="text-left p-4 font-bold" style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.50)' }}>Funkcja</th>
                  <th className="text-center p-4 font-bold" style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.50)' }}>FREE</th>
                  <th className="text-center p-4 font-bold" style={{ fontSize: '0.82rem', color: '#2bcc82' }}>PRO</th>
                </tr>
              </thead>
              <tbody>
                {comparisonFeatures.map((f, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: i < comparisonFeatures.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <td className="p-4 font-medium" style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)' }}>{f.name}</td>
                    <td className="p-4 text-center" style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.35)' }}>{f.free}</td>
                    <td className="p-4 text-center font-bold" style={{ fontSize: '0.82rem', color: '#2bcc82' }}>{f.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA końcowe */}
        <div className="relative text-center mt-12">
          <p
            className="font-bold text-white mb-2"
            style={{ fontSize: 'clamp(1.1rem, 2vw, 1.6rem)' }}
          >
            Gotowy żeby zacząć?
          </p>
          <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.40)', marginBottom: '1.5rem' }}>
            Potrzebujesz wersji dla szkoły?{' '}
            <a href="/kontakt" style={{ color: '#2bcc82', fontWeight: 600, textDecoration: 'none' }}>
              Skontaktuj się z nami
            </a>
          </p>
          <Link href="/rejestracja">
            <button
              className="inline-flex items-center font-bold"
              style={{
                padding: '14px 40px',
                borderRadius: '100px',
                border: 'none',
                background: '#4bffab',
                color: '#032515',
                fontSize: 'clamp(14px, 1.1vw, 16px)',
                cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(75,255,171,0.30)',
                transition: 'transform 0.13s ease, background 0.13s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.03)';
                e.currentTarget.style.background = 'rgb(6,250,144)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = '#4bffab';
              }}
            >
              Wypróbuj EasyLesson za darmo
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}