/**
 * Publiczne API feature'a `landing` (strony marketingowe: "/", /product, nawigacja).
 * Strony w src/app/(public) skladaja widok wylacznie z tego pliku
 * (PR-A7 z docs/architecture/REFAKTOR-PLAN.md).
 *
 * Czysty UI bez logiki domenowej; Header sam pyta useAuth(), zeby pokazac
 * wlasciwy zestaw przyciskow (patrz docs/architecture/auth.md).
 *
 * Uwaga: w sections/ leza tez sekcje, ktorych zadna strona dzis nie importuje
 * (BenefitsSection, FAQSection, TestimonialsSection, ...). Przeniesione 1:1,
 * decyzja "usunac czy przywrocic na landing" jest osobna - patrz opis PR-A7.
 */

export { default as Header } from './navigation/Header';
export { default as Footer } from './navigation/Footer';

export { default as HeroSection } from './sections/HeroSection';
export { default as WhyTutorsSection } from './sections/WhyTutorsSection';
export { default as BenefitsTimelineSection } from './sections/BenefitsTimelineSection';
export { default as PricingSection } from './sections/PricingSection';

export { default as ProductHero } from './product/ProductHero';
export { default as DashboardSection } from './product/DashboardSection';
export { default as TutoringBoardSection } from './product/TutoringBoardSection';
