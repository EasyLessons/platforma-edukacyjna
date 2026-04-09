'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus_Jakarta_Sans } from 'next/font/google';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '800'],
  display: 'swap',
});

type Feature = {
  text: string;
  info: string;
};

const starterFeatures: Feature[] = [
  {
    text: '3 aktywne tablice jednocześnie',
    info: 'Możesz prowadzić do 3 różnych lekcji/projektów bez zamykania poprzednich.',
  },
  {
    text: 'Smart Search bez limitu',
    info: 'Szybko znajdziesz wzory, grafiki i materiały w trakcie zajęć.',
  },
  {
    text: 'Współpraca na żywo',
    info: 'Uczeń i korepetytor pracują na tej samej tablicy w czasie rzeczywistym.',
  },
  {
    text: 'Podstawowe raporty postępów',
    info: 'Podgląd aktywności i realizacji tematów z ostatnich lekcji.',
  },
  {
    text: 'Biblioteka materiałów: 1 GB',
    info: 'Miejsce na notatki, zdjęcia zadań i pliki PDF dla uczniów.',
  },
];

const proFeatures: Feature[] = [
  {
    text: 'Nielimitowane tablice i lekcje',
    info: 'Prowadzisz dowolną liczbę zajęć bez ograniczeń pojemności planu.',
  },
  {
    text: 'Smart Search bez limitu',
    info: 'Wyszukujesz materiały tak często, jak potrzebujesz podczas każdej lekcji.',
  },
  {
    text: 'Voice Chat premium',
    info: 'Stabilniejsza komunikacja głosowa i lepsza jakość rozmów na żywo.',
  },
  {
    text: 'Zaawansowany widok postępów',
    info: 'Śledzenie realizacji tematów, powtórek i wyników ucznia w jednym miejscu.',
  },
  {
    text: 'Priorytetowe wsparcie techniczne',
    info: 'Szybsza reakcja zespołu wsparcia, gdy potrzebujesz pomocy.',
  },
];

const aiTutorFeatures: Feature[] = [
  ...proFeatures,
  {
    text: 'Inteligentny Korepetytor na Voice Chacie',
    info: 'Asystent analizuje to, co piszesz na tablicy i podpowiada kolejne kroki rozwiazania na zywo.',
  },
];

const comparisonRows = [
  {
    name: 'Dla kogo jest ten plan',
    starter: 'Stabilny start i podstawowy zestaw narzedzi do codziennych lekcji.',
    premium: 'Dla korepetytorow, ktorzy chca skalowac prace i oszczedzac czas.',
    tutor: 'Dla osob, ktore chca miec wsparcie AI podczas rozwiazywania zadan na zywo.',
  },
  { name: 'Wspolna tablica na zywo', starter: 'check', premium: 'check', tutor: 'check' },
  { name: 'Smart Search', starter: 'Bez limitu', premium: 'Bez limitu', tutor: 'Bez limitu' },
  { name: 'Voice Chat', starter: 'Podstawowy', premium: 'Premium', tutor: 'Premium + AI' },
  { name: 'Asystent rozwiazywania zadan', starter: '-', premium: '-', tutor: 'check' },
  { name: 'Aktywne tablice', starter: '3', premium: 'Nielimitowane', tutor: 'Nielimitowane' },
  { name: 'Priorytetowe wsparcie', starter: '-', premium: 'check', tutor: 'check' },
];

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="9" fill="#2bcc82" />
      <path d="M5 9.5l2.5 2.5 5.5-5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PricingSection() {
  const [yearly, setYearly] = useState(false);
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);

  return (
    <section className={`${jakartaSans.className} w-full bg-[#0f0f0f] py-14 sm:py-16 lg:py-20`} id="pakiet-premium">
      <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-14 2xl:px-20">
        <div className="mx-auto w-full max-w-[1920px]">
          <div className="text-center">
            <h2
              className="font-semibold text-white"
              style={{ fontSize: 'clamp(2rem, 5vw, 4.25rem)', lineHeight: 1.02 }}
            >
              Wybierz idealny plan dla Twojej pracy ;)
              <br />
            </h2>
            <p
              className="mx-auto mt-4 max-w-[680px]"
              style={{ fontSize: 'clamp(0.98rem, 1.3vw, 1.2rem)', color: 'rgba(255,255,255,0.70)' }}
            >
              Trzy przejrzyste plany. Przelaczaj miesiecznie lub rocznie w 1 kliknieciu.
            </p>

            <div className="mx-auto mt-7 flex items-center justify-center gap-3">
              <span className="text-sm font-semibold" style={{ color: yearly ? 'rgba(255,255,255,0.55)' : '#FFFFFF' }}>
                Miesięcznie
              </span>
              <button
                type="button"
                onClick={() => setYearly((v) => !v)}
                aria-label="Przelacz cennik miesieczny i roczny"
                className="relative h-7 w-14 rounded-full cursor-pointer"
                style={{ backgroundColor: yearly ? '#4bffab' : '#2f2f2f' }}
              >
                <span
                  className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all duration-200"
                  style={{ left: yearly ? '33px' : '4px' }}
                />
              </button>
              <span className="text-sm font-semibold" style={{ color: yearly ? '#FFFFFF' : 'rgba(255,255,255,0.55)' }}>
                Rocznie
              </span>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap justify-center gap-4">
            <PricingCard
              plan="Starter"
              monthlyPrice={0.00}
              yearlyPrice={0.00}
              yearly={yearly}
              subtitle="Idealny start dla indywidualnych korepetytorów"
              ctaLabel="Zacznij za darmo"
              ctaHref="/rejestracja?plan=starter"
              features={starterFeatures}
              highlighted={false}
            />

            <PricingCard
              plan="Premium"
              monthlyPrice={49.99}
              yearlyPrice={39.99}
              yearly={yearly}
              subtitle="Najlepszy wybór dla korepetytorów z większą liczbą uczniów"
              ctaLabel="Kup plan Premium"
              ctaHref="/rejestracja?plan=premium"
              features={proFeatures}
              highlighted
            />

            <PricingCard
              plan="Inteligentny Korepetytor"
              monthlyPrice={79.99}
              yearlyPrice={64.99}
              yearly={yearly}
              subtitle="Plan Premium + AI, który siedzi z Toba na Voice Chacie podczas korepetycji"
              ctaLabel="Kup plan AI Tutor"
              ctaHref="/rejestracja?plan=ai-tutor"
              features={aiTutorFeatures}
              highlighted={false}
            />
          </div>

          <h3
            className="mt-28 mb-7 hidden text-center font-semibold text-white lg:block"
            style={{ fontSize: 'clamp(2rem, 5vw, 4.25rem)', lineHeight: 1.02 }}
          >
            Porównaj plany
          </h3>

          <div
            className="mx-auto mt-8 hidden max-w-[1320px] border border-white/15 lg:block"
            style={{ backgroundColor: '#1f1f1f' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="border-b border-white/10 align-top">
                    <th className="w-[180px] px-5 py-6 text-left text-sm font-semibold text-white/70">Porownanie planow</th>
                    <th className="w-[260px] px-4 py-6 text-left">
                      <p className="text-[1.1rem] font-semibold text-white">Starter</p>
                      <p className="mt-0.5 text-xs text-white/55">Plan podstawowy</p>
                      <button
                        type="button"
                        className="mt-3 w-full rounded-md px-3 py-2 text-sm font-semibold text-white cursor-pointer"
                        style={{ backgroundColor: '#343434' }}
                      >
                        Kup Starter
                      </button>
                    </th>
                    <th className="w-[260px] px-4 py-6 text-left">
                      <p className="text-[1.1rem] font-semibold text-white">Premium</p>
                      <p className="mt-0.5 text-xs text-white/55">Najczesciej wybierany</p>
                      <button
                        type="button"
                        className="mt-3 w-full rounded-md px-3 py-2 text-sm font-semibold text-[#032515] cursor-pointer"
                        style={{ backgroundColor: '#4bffab' }}
                      >
                        Kup Premium
                      </button>
                    </th>
                    <th className="w-[260px] px-4 py-6 text-left">
                      <p className="text-[1.1rem] font-semibold text-white">Inteligentny Korepetytor</p>
                      <p className="mt-0.5 text-xs text-white/55">Voice Chat + AI pomoc</p>
                      <button
                        type="button"
                        className="mt-3 w-full rounded-md px-3 py-2 text-sm font-semibold text-white cursor-pointer"
                        style={{ backgroundColor: '#343434' }}
                      >
                        Kup AI Tutor
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, rowIndex) => (
                    <tr
                      key={row.name}
                      className="border-b border-white/8 align-top"
                      style={{
                        backgroundColor: hoveredRowIndex === rowIndex ? '#303030' : rowIndex % 2 === 0 ? '#1f1f1f' : '#1b1b1b',
                        transition: 'background-color 150ms ease',
                      }}
                      onMouseEnter={() => setHoveredRowIndex(rowIndex)}
                      onMouseLeave={() => setHoveredRowIndex(null)}
                    >
                      <td className="px-5 py-4 text-sm font-medium text-white">{row.name}</td>
                      <td className="px-4 py-4 text-sm text-white/75">{renderComparisonCell(row.starter)}</td>
                      <td className="px-4 py-4 text-sm text-white/85">{renderComparisonCell(row.premium)}</td>
                      <td className="px-4 py-4 text-sm text-white/85">{renderComparisonCell(row.tutor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type PricingCardProps = {
  plan: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearly: boolean;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  features: Feature[];
  highlighted: boolean;
};

function PricingCard({
  plan,
  monthlyPrice,
  yearlyPrice,
  yearly,
  subtitle,
  ctaLabel,
  ctaHref,
  features,
  highlighted,
}: PricingCardProps) {
  const price = yearly ? yearlyPrice : monthlyPrice;
  const yearlyTotal = yearly ? yearlyPrice * 12 : null;

  return (
    <article
      className="relative w-full max-w-[340px] border px-4 py-6 sm:px-5 sm:py-7"
      style={{
        backgroundColor: '#222222',
        borderColor: 'rgba(255,255,255,0.14)',
      }}
    >
      <p className="text-[1.45rem] font-medium text-white">{plan}</p>

      <div className="mt-2 flex items-end gap-1.5">
        <span className="text-[3rem] font-semibold leading-none text-white sm:text-[3.2rem]">
          {price.toFixed(2).replace('.', ',')}
        </span>
        <span className="pb-2 text-[1.75rem] font-semibold leading-none text-white">zł</span>
        <span className="pb-[0.58rem] text-[1.05rem] font-medium text-white/65">/mo</span>
      </div>

      <p className="mt-2 text-sm text-white/65 font-bold">{subtitle}</p>
      <p className="mt-1 text-xs text-white/45 font-bold">Cena zawiera VAT</p>
      <p className="mt-1 text-xs text-white/90 font-bold">
        {yearly
          ? `Rocznie: ${yearlyPrice.toFixed(2).replace('.', ',')} zł/mies. (${yearlyTotal?.toFixed(2).replace('.', ',')} zł/rok)`
          : 'Rozliczane miesięcznie'}
      </p>

      <div className="mt-6">
        <Link href={ctaHref}>
          <button
            type="button"
            className="group relative inline-flex w-full items-center justify-center rounded-xl px-5 py-3.5 font-bold transition-colors duration-200 cursor-pointer"
            style={{
              backgroundColor: highlighted ? '#4bffab' : '#343434',
              color: highlighted ? '#032515' : '#FFFFFF',
            }}
          >
            {ctaLabel}
          </button>
        </Link>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.06em] text-white/82">Co dostajesz:</p>

        <ul className="space-y-2.5">
          {features.map((feature) => (
            <li key={feature.text} className="group relative flex items-start gap-2.5 text-white/86">
              <CardCheckIcon />
              <span className="inline-flex flex-1 items-start gap-2 text-[0.96rem] leading-snug">
                {feature.text}
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/30 text-[11px] font-bold text-white/85">
                  i
                </span>
              </span>
              <span
                className="pointer-events-none absolute bottom-[124%] left-1/2 z-20 w-[220px] -translate-x-1/2 rounded-md border border-white/15 bg-[#1f1f1f] px-3 py-2 text-left text-xs font-medium leading-snug text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                role="tooltip"
              >
                {feature.info}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function renderComparisonCell(value: string) {
  if (value === 'check') {
    return <TableCheckIcon />;
  }

  if (value === '-') {
    return <span className="text-white/35">-</span>;
  }

  return <span>{value}</span>;
}

function CardCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4.5 9.3l2.4 2.4 6.6-6.4" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TableCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="9" cy="9" r="9" fill="#2bcc82" />
      <path d="M5 9.5l2.5 2.5 5.5-5.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}