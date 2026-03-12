'use client';

import { useState } from 'react';
import DashboardHeader from './Header/DashboardHeader';
import WorkspaceSidebar from './Components/workspace-sidebar';
import BoardsSection from './Components/boards-section';
import WelcomeSection from './Components/WelcomeSection';
import TemplatesSection from './Components/TemplateSection';

export default function Dashboard() {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(null);
  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string | undefined>(undefined);
  const handleWorkspaceSelect = (id: number, name: string) => {
    setActiveWorkspaceId(id);
    setActiveWorkspaceName(name);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <DashboardHeader />

      <div className="flex flex-1">
        <WorkspaceSidebar
          activeWorkspaceId={activeWorkspaceId}
          onWorkspaceSelect={handleWorkspaceSelect}
        />

        <div className="flex-1 overflow-auto">
          <div className="w-full mx-auto p-8">
            <WelcomeSection />

            <TemplatesSection workspaceId={activeWorkspaceId} />
            {activeWorkspaceId && (
              <BoardsSection workspaceId={activeWorkspaceId} workspaceName={activeWorkspaceName} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
