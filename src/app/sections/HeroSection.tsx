'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Plus_Jakarta_Sans } from 'next/font/google';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '800'],
  display: 'swap',
});

export default function HeroSection() {
  return (
    <section
      className={`${jakartaSans.className} relative w-screen overflow-hidden`}
      style={{
        height: '100vh',
        minHeight: '100vh',
        marginLeft: 'calc(50% - 50vw)',
        marginRight: 'calc(50% - 50vw)',
      }}
    >
        <video
          className="absolute inset-0 w-[100vw] h-full object-cover scale-[1.05]"
          src="https://pub-9f3b498e57d045a682d3009381570da0.r2.dev/EasylessonherosectionWEBM.webm"
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          disableRemotePlayback
        />

        {/* Płynne przyciemnienie od dołu */}
        <div
          className="absolute inset-x-0 bottom-0 h-[70%] pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.76) 26%, rgba(0,0,0,0.50) 54%, rgba(0,0,0,0.16) 82%, rgba(0,0,0,0) 100%)',
          }}
        />

        {/* Blur od dołu dla lepszej czytelności */}
        <div
          className="absolute inset-x-0 bottom-0 h-[46%] backdrop-blur-[7px] pointer-events-none"
          style={{
            WebkitMaskImage:
              'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.78) 44%, rgba(0,0,0,0.12) 76%, rgba(0,0,0,0) 100%)',
            maskImage:
              'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.78) 44%, rgba(0,0,0,0.12) 76%, rgba(0,0,0,0) 100%)',
          }}
        />

        {/* Karta info w prawym górnym rogu */}
        <div className="absolute top-20 right-8 sm:top-24 sm:right-12 lg:top-28 lg:right-16 z-20 w-[90%] max-w-[320px] sm:max-w-[360px] rounded-3xl border border-white/20 bg-black/82 backdrop-blur-md py-4 px-6 sm:py-4 sm:px-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="min-w-0 flex-1 py-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/90">Nadchodzące wydarzenie</p>
              </div>
              <p className="mt-2 text-[11px] sm:text-xs leading-relaxed text-white/85">
                Easylesson rusza z nauczaniem na TikToku. Wpadaj i ucz się razem z nami do matury! Czekamy na ciebie ;)
              </p>
            </div>

            <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 overflow-hidden rounded-xl border border-white/20 bg-black/80">
              <Image
                src="/resources/tiktok-event.jpg"
                alt="Wydarzenie TikTok"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>

        {/* Główna treść Hero */}
        <div className="absolute inset-0 z-10 px-6 sm:px-12 lg:px-20 xl:px-28 pb-16 sm:pb-24 lg:pb-32 pt-24 sm:pt-28 flex items-end">
          <div className="w-full max-w-[1536px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">
            <div className="lg:col-span-7 xl:col-span-7">
              <h1
                className="font-bold leading-[0.96] text-white"
                style={{ fontSize: 'clamp(2.25rem, 5.9vw, 4.9rem)', maxWidth: '760px' }}
              >
                <span className="block whitespace-nowrap">Jedna tablica. Milion</span>
                <span className="block">możliwości nauki.</span>
              </h1>
            </div>

            <div className="lg:col-span-5">
              <p className="text-white/95 text-lg sm:text-xl leading-relaxed max-w-xl">
                Easylesson to platforma, która łączy nowoczesne narzędzia, praktykę i wsparcie korepetytorów.
                Ucz się skutecznie, wygodnie i regularnie aż do matury.
              </p>

              <div className="mt-8">
                <Link href="/login">
                  <button
                    type="button"
                    className="group relative cursor-pointer inline-flex items-center gap-3.5 rounded-xl bg-green-500 text-white font-bold px-7 py-4 ring-1 ring-green-400/50 hover:bg-green-400 transition-colors duration-200 hover:scale-[1.02] shadow-lg shadow-green-500/20"
                  >
                    <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white shadow-sm">
                      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                        <path
                          fill="#EA4335"
                          d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.5 14.5 2.6 12 2.6 6.9 2.6 2.8 6.7 2.8 11.8S6.9 21 12 21c6.9 0 9.1-4.8 9.1-7.3 0-.5 0-.8-.1-1.1H12z"
                        />
                        <path
                          fill="#34A853"
                          d="M3.9 7.3l3.2 2.3c.9-1.8 2.7-3 4.9-3 1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.5 14.5 2.6 12 2.6c-3.6 0-6.7 2-8.3 4.7z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M12 21c2.4 0 4.5-.8 6.1-2.2l-2.8-2.3c-.8.6-1.9 1-3.3 1-3.9 0-5.2-2.6-5.4-3.9l-3.2 2.5C4.9 18.9 8.2 21 12 21z"
                        />
                        <path
                          fill="#4285F4"
                          d="M21.1 13.7c0-.5 0-.8-.1-1.1H12v3.9h5.4c-.3 1.1-1 2.1-2 2.8l2.8 2.3c1.7-1.6 2.9-3.9 2.9-6.9z"
                        />
                      </svg>
                    </span>
                    Zaloguj się z Google
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>

    </section>
  );
}
