import ProductHero from "./sections/ProductHero";
import DashboardSection from "./sections/DashboardSection";
import TutoringBoardSection from "./sections/TutoringBoardSection";
import { Plus_Jakarta_Sans } from 'next/font/google';

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700', '800'],
  display: 'swap',
});

export default function ProduktPage() {
  return (
    <div className={`min-h-screen bg-white ${jakartaSans.className}`}>
      <main className="pb-20">
        {/* HERO SECTION */}
        <ProductHero />

        {/* CZEŚĆ 1: DASHBOARD */}
        <DashboardSection />

        {/* CZEŚĆ 2: TUTORING BOARD */}
        <TutoringBoardSection />
      </main>
    </div>
  );
}