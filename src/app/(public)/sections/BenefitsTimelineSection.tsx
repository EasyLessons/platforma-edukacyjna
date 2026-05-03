'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Plus_Jakarta_Sans } from 'next/font/google';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

const milestones = [
  {
    badge: 'W pierwsze 2 minuty',
    description: 'Stwórz przestrzeń, zaproś ucznia i płynnie rozpocznij swoją pierwszą lekcję.',
    image: '/resources/Feature1.webp',
    imageAlt: 'EasyLesson funkcja 1',
  },
  {
    badge: 'W pierwsze 4 minuty',
    description: 'Poczuj się jak u siebie. Tablica i materiały zawsze pod ręką. Bez zbędnego klikania i szukania.',
    image: '/resources/Feature2.webp',
    imageAlt: 'EasyLesson funkcja 2',
  },
  {
    badge: 'W 4 tygodnie',
    description: 'Zapomnij o chaosie. Znajduj wzory w sekundę i ucz znacznie skuteczniej.',
    image: '/resources/Feature3.webp',
    imageAlt: 'EasyLesson funkcja 3',
  },
];

export default function BenefitsTimelineSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [maxTranslate, setMaxTranslate] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile(); // set init
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      const track = trackRef.current;

      if (!viewport || !track) {
        return;
      }

      setMaxTranslate(Math.max(0, track.scrollWidth - viewport.clientWidth));
    };

    measure();
    window.addEventListener('resize', measure);

    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    let frameId = 0;

    const updateProgress = () => {
      const section = sectionRef.current;
      if (!section) {
        return;
      }

      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const scrollableDistance = Math.max(rect.height - viewportHeight, 1);
      const travelled = Math.min(Math.max(-rect.top, 0), scrollableDistance);

      setScrollProgress(travelled / scrollableDistance);
    };

    const onScroll = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const translateX = -(scrollProgress * maxTranslate);

  return (
    <section
      ref={sectionRef}
      className={`${jakartaSans.className} w-full bg-[#0f0f0f] text-white`}
    >
      {/* --- WERSJA MOBILNA --- */}
      <div className="flex flex-col px-6 py-14 sm:px-8 sm:py-16 lg:hidden">
        <div className="mx-auto w-full max-w-[1500px]">
          <p
            className="max-w-6xl text-[2rem] font-semibold leading-[1.02] text-white sm:max-w-5xl sm:text-[2.8rem]"
            style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0)' : 'translateY(18px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}
          >
            Oto co zyskasz z EasyLesson<br/> w zaledwie 30 dni.
          </p>

          <div className="mt-12 flex flex-col gap-14 sm:gap-16">
            {milestones.map((item, index) => (
              <article
                key={item.badge}
                className="flex flex-col"
                style={{
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                  transition: `opacity 0.7s ease ${index * 120}ms, transform 0.7s ease ${index * 120}ms`,
                }}
              >
                <div className="mb-4 inline-flex w-fit items-center rounded-full bg-[#2a2a2a] px-3 py-1.5 text-sm font-bold text-[#d1d1d1] shadow-sm">
                  {item.badge}
                </div>

                <p className="mb-6 max-w-[40ch] text-[1.4rem] leading-relaxed text-white/86 sm:text-[1.6rem]">
                  {item.description}
                </p>

                <div className="relative w-full aspect-[16/11] shrink-0 overflow-hidden rounded-[18px] border border-white/10 bg-[#171717] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                  <Image
                    src={item.image}
                    alt={item.imageAlt}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover object-top"
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* --- WERSJA DESKTOP --- */}
      <div className="hidden lg:block relative" style={{ height: '320vh' }}>
        <div className="sticky top-0 h-screen overflow-hidden">
          <div className="flex h-full w-full flex-col justify-start py-18">
            <div className="mx-auto w-full max-w-[1500px] px-10">
              <p
                className="max-w-6xl text-[3.6rem] font-semibold leading-[1.02] text-white"
                style={{ opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0)' : 'translateY(18px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}
              >
                Oto co zyskasz z EasyLesson<br/> w zaledwie 30 dni.
              </p>
            </div>

            <div ref={viewportRef} className="relative mt-10 flex-1 overflow-hidden w-full">
              <div
                className="absolute left-0 top-0 h-full w-full overflow-hidden"
                style={{
                  maskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 5%, rgba(0,0,0,1) 95%, rgba(0,0,0,0) 100%)',
                  WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 5%, rgba(0,0,0,1) 95%, rgba(0,0,0,0) 100%)',
                }}
              >
                <div
                  ref={trackRef}
                  className="flex h-full gap-8 pl-[25vw] will-change-transform"
                  style={{
                    transform: `translate3d(${translateX}px, 0, 0)`,
                  }}
                >
                  {milestones.map((item, index) => (
                    <article
                      key={item.badge}
                      className="flex h-full min-w-[50vw] flex-col"
                      style={{
                        opacity: isVisible ? 1 : 0,
                        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
                        transition: `opacity 0.7s ease ${index * 120}ms, transform 0.7s ease ${index * 120}ms`,
                      }}
                    >
                      <div className="mb-4 mt-auto inline-flex w-fit items-center rounded-full bg-[#2a2a2a] px-3 py-1.5 text-sm font-bold text-[#d1d1d1] shadow-sm">
                        {item.badge}
                      </div>

                      <p className="mb-6 max-w-[40ch] text-[2rem] leading-relaxed text-white/86">
                        {item.description}
                      </p>

                      <div className="relative w-full aspect-[16/11] shrink-0 overflow-hidden rounded-[18px] border border-white/10 bg-[#171717] shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
                        <Image
                          src={item.image}
                          alt={item.imageAlt}
                          fill
                          sizes="50vw"
                          className="object-cover object-top"
                        />
                      </div>
                    </article>
                  ))}
                  
                  {/* Sztuczny opór dla scrolla przeliczający brakujące pole (right padding), co poprawnie centruje widok */}
                  <div className="shrink-0 w-[25vw]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}