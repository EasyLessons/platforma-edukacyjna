import { ProductHero, DashboardSection, TutoringBoardSection } from '@/_new/features/landing';
import { plusJakartaSans as jakartaSans } from '@new/shared/fonts';

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
