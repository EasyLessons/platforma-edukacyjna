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
      className={`${jakartaSans.className} relative w-full overflow-hidden`}
      style={{
        height: '100vh',
        minHeight: '100vh',
      }}
    >
        <video
          className="absolute inset-0 w-full h-full object-cover scale-[1.05]"
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
        <a
          href="https://www.tiktok.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:block absolute top-20 right-4 sm:top-24 sm:right-12 lg:top-28 lg:right-16 z-20 w-[calc(100%-2rem)] sm:w-[90%] max-w-[320px] sm:max-w-[360px] rounded-3xl border border-white/20 bg-black/82 backdrop-blur-md py-4 px-6 sm:py-4 sm:px-8 transition-all duration-200 hover:border-white/35 hover:bg-black/88 hover:scale-[1.01]"
          aria-label="Przejdź do TikToka Easylesson"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="min-w-0 flex-1 py-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/90">Ostatnie wydarzenie</p>
              </div>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-white/85">
                Easylesson rusza z nauczaniem na TikToku! Wpadaj i ucz się razem z nami do matury!
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
        </a>

        {/* Główna treść Hero */}
        <div className="absolute inset-0 z-10 px-6 sm:px-12 lg:px-20 xl:px-28 pb-16 sm:pb-24 lg:pb-32 pt-24 sm:pt-28 flex items-end">
          <div className="w-full max-w-[1536px] mx-auto">
            <div className="max-w-[760px] text-left flex flex-col items-start justify-end lg:hidden">
              <h1
                className="font-bold leading-[0.96] text-white"
                style={{ fontSize: 'clamp(2rem, 8.5vw, 4.9rem)' }}
              >
                Jedna tablica. Milion możliwości nauki.
              </h1>

              <p className="mt-5 text-white/95 text-base sm:text-xl leading-relaxed max-w-[620px]">
                Easylesson to platforma, która łączy nowoczesne narzędzia, praktykę i wsparcie korepetytorów.
                Ucz się skutecznie, wygodnie i regularnie aż do matury.
              </p>

              <div className="mt-7">
                <Link href="/login">
                  <button
                    type="button"
                    className="group relative cursor-pointer inline-flex items-center gap-3 rounded-xl bg-green-500 text-white px-6 sm:px-7 py-3.5 sm:py-4 ring-1 ring-green-400/50 hover:bg-green-400 transition-colors duration-200 hover:scale-[1.02] shadow-lg shadow-green-500/20"
                  >
                    <span className="inline-flex h-[30px] w-[30px] sm:h-[34px] sm:w-[34px] items-center justify-center rounded-full bg-white shadow-sm">
                      <Image
                        src="/resources/googleSVG.svg"
                        alt="Google"
                        width={22}
                        height={22}
                        className="h-[22px] w-[22px]"
                      />
                    </span>
                    <span className="flex flex-col items-start leading-tight text-left">
                      <span className="text-[13px] sm:text-[15px] font-extrabold uppercase tracking-[0.04em]">ZALOGUJ SIĘ Z GOOGLE</span>
                      <span className="text-[11px] sm:text-[13px] font-medium normal-case text-white/95 mx-auto">i wypróbuj za darmo</span>
                    </span>
                  </button>
                </Link>
              </div>
            </div>

            <div className="hidden lg:grid lg:grid-cols-12 gap-8 lg:gap-16 items-start">
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
                      className="group relative cursor-pointer inline-flex items-center gap-3 rounded-xl bg-green-500 text-white px-7 py-4 ring-1 ring-green-400/50 hover:bg-green-400 transition-colors duration-200 hover:scale-[1.02] shadow-lg shadow-green-500/20"
                    >
                      <span className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white shadow-sm">
                        <Image
                          src="/resources/googleSVG.svg"
                          alt="Google"
                          width={22}
                          height={22}
                          className="h-[22px] w-[22px]"
                        />
                      </span>
                      <span className="flex flex-col items-start leading-tight text-left">
                        <span className="text-[15px] font-extrabold uppercase tracking-[0.04em]">ZALOGUJ SIĘ Z GOOGLE</span>
                        <span className="text-[13px] font-medium normal-case text-white/95 mx-auto">i wypróbuj za darmo</span>
                      </span>
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

    </section>
  );
}
