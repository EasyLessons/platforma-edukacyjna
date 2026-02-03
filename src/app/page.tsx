import HeroSection from './sections/HeroSection';
import HeroMobileSection from './sections/HeroMobileSection';
import ProblemsAndSolutionsSection from './sections/ProblemsSection';
import MainFunctionsSection from './sections/MainFunctionsSection';
import HowItWorksSection from './sections/HowItWorksSection';
import ForWhoSection from './sections/ForWhoSection';
import PricingSection from './sections/PricingSection';
import SocialProofSection from './sections/SocialProofSection';
import FAQSection from './sections/FAQSection';
import LastCTASection from './sections/LastCTASection';

export default function Home() {
  return (
    <div>
      {/* Desktop Hero - ukryty na mobile */}
      <div className="hidden lg:block">
        <HeroSection />
      </div>

      {/* Mobile Hero - ukryty na desktop */}
      <div className="block lg:hidden">
        <HeroMobileSection />
      </div>

      {/* Sekcja problemów i rozwiązań - pokazuje się na wszystkich urządzeniach */}
      <ProblemsAndSolutionsSection />

      <MainFunctionsSection />

      <HowItWorksSection />

      <ForWhoSection />

      <PricingSection />

      <SocialProofSection />

      <FAQSection />

      <LastCTASection />
    </div>
  );
}
