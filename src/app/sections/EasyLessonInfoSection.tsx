'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus_Jakarta_Sans } from 'next/font/google';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '800'],
  display: 'swap',
});

const YOUTUBE_ID = 'r0vrPSZjWMQ';
const THUMBNAIL = `https://img.youtube.com/vi/${YOUTUBE_ID}/maxresdefault.jpg`;

export default function EasyLessonInfoSection() {
  const [playing, setPlaying] = useState(false);

  return (
    <div className={`${jakartaSans.className} w-full bg-white px-4 sm:px-6 lg:px-8 py-8`}>

      <div
        className="relative w-full overflow-hidden"
        style={{
          borderRadius: '24px',
          background: '#111112',
          padding: '5vh clamp(2rem, 5vw, 5rem)',
        }}
      >

        {/* Siatka */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 50% 100%, rgba(17,17,18,0.0) 0%, rgba(17,17,18,0.85) 65%)',
          }}
        />

        {/* Centralny kontener */}
        <div className="relative flex flex-col items-center text-center">

          {/* Badge */}
          <div className="flex items-center gap-2 mb-5">
            <div
              className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[9px] rotate-90"
              style={{ borderBottomColor: '#2bcc82' }}
            />
            <span
              className="font-semibold tracking-widest uppercase"
              style={{
                fontSize: 'clamp(0.6rem, 0.85vw, 0.72rem)',
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: '0.14em',
              }}
            >
              JAK TO DZIAŁA
            </span>
          </div>

          {/* H2 */}
          <h2
            className="font-bold text-white leading-tight mb-4"
            style={{
              fontSize: 'clamp(1.8rem, 4vw, 3.8rem)',
              lineHeight: 1.1,
              maxWidth: '820px',
            }}
          >
            Zmień standardowe zajęcia
            <br />
            w lekcje pełne{' '}
            <span style={{ color: '#2bcc82' }}>konkretów.</span>
          </h2>

          {/* H3 */}
          <p
            className="font-light leading-relaxed mb-8"
            style={{
              fontSize: 'clamp(0.95rem, 1.4vw, 1.15rem)',
              color: 'rgba(255,255,255,0.55)',
              maxWidth: '520px',
            }}
          >
            Platforma, która pomaga uczyć efektywniej i ułatwia pracę.
            Zaoszczędź czas i przejdź na{' '}
            <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>EasyLesson</span>.
          </p>

          {/* Film */}
          <div className="w-full mb-8" style={{ maxWidth: '780px' }}>
            <div
              className="relative overflow-hidden cursor-pointer group w-full"
              style={{
                borderRadius: '16px',
                boxShadow: '0 24px 60px rgba(0,0,0,0.50)',
                aspectRatio: '16/9',
              }}
              onClick={() => setPlaying(true)}
            >
              {playing ? (
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1&rel=0`}
                  title="EasyLesson w 3 minuty"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <>
                  <img
                    src={THUMBNAIL}
                    alt="EasyLesson w 3 minuty"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.20)' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                      style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '50%',
                        background: '#fff',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
                      }}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="#111112">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  <div
                    className="absolute bottom-3 right-3 font-semibold"
                    style={{
                      background: 'rgba(0,0,0,0.75)',
                      color: '#fff',
                      fontSize: '0.72rem',
                      padding: '3px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    3:00
                  </div>
                </>
              )}
            </div>
            <p
              className="mt-2 font-medium"
              style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.30)' }}
            >
              Obejrzyj 3 minuty i korzystaj na zawsze
            </p>
          </div>

          {/* CTA */}
          <Link href="/rejestracja">
            <button
              className="inline-flex items-center font-bold"
              style={{
                padding: '13px 36px',
                borderRadius: '100px',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'clamp(14px, 1.1vw, 16px)',
                color: '#032515',
                background: '#4bffab',
                boxShadow: '0 2px 16px rgba(75,255,171,0.30)',
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
              Zaloguj się
            </button>
          </Link>

        </div>
      </div>
    </div>
  );
}