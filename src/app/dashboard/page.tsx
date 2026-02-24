'use client';

import { useState } from 'react';
import DashboardHeader from './Header/DashboardHeader';
import WorkspaceSidebar from './Components/WorkspaceSidebar';
import WelcomeSection from './Components/WelcomeSection';
import TemplatesSection from './Components/TemplateSection';
import LastBoards from './Components/LastBoards';

export default function Dashboard() {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* HEADER - Na samej górze */}
      <DashboardHeader />

      {/* GŁÓWNA ZAWARTOŚĆ - Sidebar + Content */}
      <div className="flex flex-1">
        {/* LEWY PASEK - Sidebar */}
        <WorkspaceSidebar />

        {/* PRAWA STRONA - Główna treść */}
        <div className="flex-1 overflow-auto">
          <div className="w-full mx-auto p-8">
            {/* SEKCJA POWITALNA */}
            <WelcomeSection />

            {/* SEKCJA SZABLONÓW */}
            <TemplatesSection />

            <LastBoards />
          </div>
        </div>
      </div>
    </div>
  );
}
