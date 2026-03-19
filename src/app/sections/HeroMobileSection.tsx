'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '800'],
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['700'],
  style: ['italic'],
  display: 'swap',
});

const testAvatars = [
  'https://i.pravatar.cc/150?img=32',
  'https://i.pravatar.cc/150?img=47',
  'https://i.pravatar.cc/150?img=12',
  'https://i.pravatar.cc/150?img=25',
];

export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className={`${jakartaSans.className} w-full bg-white px-4 sm:px-6 lg:px-8 pt-4 pb-8`}>

      <section
        className="relative w-full overflow-hidden"
        style={{
          borderRadius: '24px',
          height: '88vh',
          minHeight: '560px',
        }}
      >

        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          src="/HeroFilm/EasylessonHeroFilm.mp4"
          autoPlay
          muted
          loop
          playsInline
        />

        {/* Overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              160deg,
              rgba(0, 61, 167, 0.87) 0%,
              rgba(0, 115, 255, 0.87) 50%,
              rgba(0, 98, 184, 0.82) 100%
            )`,
          }}
        />

        {/* Gradient od dołu */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.10) 28%, transparent 50%)',
          }}
        />

        {/* Środkowa treść */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10 px-5 sm:px-8">

          {/* Znacznik - ukryty na bardzo małych */}
          <div className="hidden sm:flex items-center gap-2 mb-4">
            <div
              className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[9px] rotate-90"
              style={{ borderBottomColor: '#4bffab' }}
            />
            <span
              className="text-white font-semibold tracking-widest uppercase"
              style={{ fontSize: '0.68rem', letterSpacing: '0.14em' }}
            >
              STWORZONY DLA UCZNIÓW, KOREPETYTORÓW I NAUCZYCIELI
            </span>
          </div>

          {/* H1 - vh zamiast clamp */}
          <h1
            className="font-bold leading-tight text-white mb-4"
            style={{
              fontSize: '5.5vh',
              maxWidth: '1100px',
              lineHeight: '1.1',
            }}
          >
            Jeden board.{' '}
            <span style={{ color: '#4bffab' }}>
              Milion możliwości
            </span>
            {' '}nauki.
          </h1>

          {/* H2 - vh */}
          <p
            className="font-light leading-relaxed mb-8"
            style={{
              fontSize: '1.9vh',
              color: 'rgba(255,255,255,0.82)',
              maxWidth: '560px',
            }}
          >
            Interaktywne tablice, notatki, AI-tutor i wspólna nauka w jednym miejscu.{' '}
            <span style={{ fontWeight: 700, color: '#fff' }}>Zacznij już dziś — bezpłatnie.</span>
          </p>

          {/* Przyciski */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/rejestracja">
              <button className="hero-btn-primary">Zaloguj się</button>
            </Link>
            <Link href="/poradnik">
              <button className="hero-btn-secondary">Obejrzyj poradnik</button>
            </Link>
          </div>
        </div>

        {/* Dolny pasek */}
        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-end justify-between px-5 sm:px-8 pb-5 sm:pb-7">

          {/* Lewa - avatary */}
          <div className="flex flex-col gap-1.5">
            <p
              className="text-white font-semibold"
              style={{ fontSize: '1.5vh', opacity: 0.9 }}
            >
              Easylesson wybierają najlepsi korepetytorzy
            </p>
            <div className="flex items-center gap-1">
              {testAvatars.map((src, index) => (
                <img
                  key={index}
                  src={src}
                  alt=""
                  className="rounded-full border-2 border-white object-cover"
                  style={{
                    width: '3.5vh',
                    height: '3.5vh',
                    minWidth: '26px',
                    minHeight: '26px',
                    marginLeft: index === 0 ? '0' : '-8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                />
              ))}
              <span
                className="text-white font-semibold ml-2"
                style={{ fontSize: '1.4vh', opacity: 0.85 }}
              >
                +40 użytkowników
              </span>
            </div>
          </div>

          {/* Prawa - social media, ukryte na xs */}
          <div className="hidden sm:flex items-center gap-4">
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="hero-social-link">Instagram ↗</a>
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hero-social-link">Facebook ↗</a>
            <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="hero-social-link">TikTok ↗</a>
          </div>

        </div>

        <style jsx>{`

          .hero-btn-primary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 1.5vh 4vh;
            border-radius: 100px;
            border: none;
            cursor: pointer;
            font-size: 1.8vh;
            font-weight: 700;
            color: #032515;
            background: #4bffab;
            box-shadow: 0 2px 14px rgba(43, 204, 130, 0.40);
            transition: transform 0.13s ease, box-shadow 0.13s ease, background 0.13s ease;
            user-select: none;
          }

          .hero-btn-primary:hover {
            transform: scale(1.03);
            background: rgb(6, 250, 144);
            box-shadow: 0 4px 22px rgba(43, 204, 130, 0.60);
          }

          .hero-btn-primary:active {
            transform: scale(0.98);
          }

          .hero-btn-secondary {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 1.5vh 4vh;
            border-radius: 100px;
            border: none;
            cursor: pointer;
            font-size: 1.8vh;
            font-weight: 700;
            color: #432f00;
            background: #ffce22;
            box-shadow: 0 2px 14px rgba(255, 206, 34, 0.35);
            transition: transform 0.13s ease, box-shadow 0.13s ease, background 0.13s ease;
            user-select: none;
          }

          .hero-btn-secondary:hover {
            transform: scale(1.03);
            background: #ffd84a;
            box-shadow: 0 4px 20px rgba(255, 206, 34, 0.55);
          }

          .hero-btn-secondary:active {
            transform: scale(0.98);
          }

          .hero-social-link {
            color: rgba(255, 255, 255, 0.75);
            font-size: 0.78rem;
            font-weight: 600;
            text-decoration: none;
            letter-spacing: 0.03em;
            transition: color 0.15s ease;
          }

          .hero-social-link:hover {
            color: rgba(255, 255, 255, 1);
          }

        `}</style>

      </section>
    </div>
  );
}