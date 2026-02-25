'use client';

import { useState } from 'react';
import { useWorkspaces } from '@/_new/features/workspace/hooks/use-workspaces';
import DashboardHeader from './Header/DashboardHeader';
import WorkspaceSidebarNew from './components_new/workspace-sidebar';
import BoardsSection from './components_new/boards-section';
import WorkspaceSidebar from './Components/WorkspaceSidebar';
import WelcomeSection from './Components/WelcomeSection';
import TemplatesSection from './Components/TemplateSection';
import LastBoards from './Components/LastBoards';

export default function Dashboard() {
  const {
    workspaces,
    loading,
    error,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    leaveWorkspace,
    toggleFavourite,
  } = useWorkspaces();

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <DashboardHeader />

      <div className="flex flex-1">
        {/* <WorkspaceSidebarNew
          workspaces={workspaces}
          loading={loading}
          error={error}
          activeWorkspaceId={activeWorkspaceId}
          onWorkspaceSelect={setActiveWorkspaceId}
          onCreateWorkspace={createWorkspace}
          onUpdateWorkspace={updateWorkspace}
          onDeleteWorkspace={deleteWorkspace}
          onLeaveWorkspace={leaveWorkspace}
          onToggleFavourite={toggleFavourite}
         /> */}

         <WorkspaceSidebar />

        <div className="flex-1 overflow-auto">
          <div className="w-full mx-auto p-8">
            <WelcomeSection />

            <TemplatesSection />

            <LastBoards />
          </div>
        </div>
      </div>
    </div>
  );
}
