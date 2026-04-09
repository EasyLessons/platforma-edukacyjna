'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function WhyTutorsSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.35 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const stats = [
    {
      value: '2,3x',
      title: 'Szybsze tempo lekcji',
      description:
        'Najlepsi korepetytorzy podwajają swoją efektywność. Wbudowany Smart Search błyskawicznie podrzuca potrzebne wzory, wykresy i zdjęcia prosto na tablicę. Zero przerw na szukanie w Google.',
    },
    {
      value: '87%',
      title: 'Mniej skakania po zakładkach',
      description:
        '87% naszych użytkowników odzyskuje spokój w pierwsze 30 dni. Koniec z uciążliwym "Ctrl+C i Ctrl+V". Masz wszystko w jednym oknie przeglądarki - bez żonglowania zewnętrznymi materiałami.',
    },
    {
      value: '99%',
      title: 'Mniej technicznego stresu',
      description:
        'Interaktywna tablica, zintegrowany Voice Chat i dedykowany widok śledzenia postępów. Potężne narzędzie "wszystko-w-jednym", które zastępuje 5 innych aplikacji.',
    },
  ];

  const animatedValues = useAnimatedStats(isVisible);

  return (
    <section ref={sectionRef} className="w-full bg-[#0f0f0f] text-white">
      <div className="mx-auto max-w-[1640px] px-6 py-16 sm:px-10 sm:py-20 lg:px-14 lg:py-24">
        <h2 className="mx-auto mt-8 mb-16 max-w-[1020px] text-center text-3xl leading-[1.05] text-white sm:mt-10 sm:mb-20 sm:text-4xl lg:mt-12 lg:mb-24 lg:text-6xl">
          Prowadź korepetycje bez chaosu. Tablica, materiały i komunikacja w jednym miejscu, by uczyć
          płynniej i skuteczniej.
        </h2>

        <div className="grid grid-cols-1 gap-16 md:grid-cols-3 md:gap-8">
          {stats.map((item, index) => (
            <article key={item.title} className="mx-auto max-w-[340px] text-center md:max-w-[380px] md:text-left">
              <p
                className="text-6xl font-medium leading-none text-white sm:text-7xl lg:text-8xl transition-transform duration-500"
                style={{ transform: isVisible ? 'scale(1)' : 'scale(0.88)' }}
              >
                {animatedValues[index]}
              </p>
              <h3 className="mt-4 text-[2rem] font-medium leading-tight text-white sm:mt-5 sm:text-2xl">
                {item.title}
              </h3>
              <p className="mt-4 text-lg leading-relaxed text-white/70">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function useAnimatedStats(shouldStart: boolean): string[] {
  const [values, setValues] = useState(['0,0x', '0%', '0%']);
  const finishedRef = useRef(false);

  const targets = useMemo(() => [2.3, 87, 99], []);

  useEffect(() => {
    if (!shouldStart || finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    const durationMs = 1400;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      const nextValues = [
        `${(targets[0] * easeOut).toFixed(1).replace('.', ',')}x`,
        `${Math.round(targets[1] * easeOut)}%`,
        `${Math.round(targets[2] * easeOut)}%`,
      ];

      setValues(nextValues);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [shouldStart, targets]);

  return values;
}
