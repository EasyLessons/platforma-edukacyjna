'use client';

import './dashboard-theme.css';
import { useEffect, useMemo, useState } from 'react';
import DashboardHeader from './Header/DashboardHeader';
import WorkspaceSidebar from './Components/workspace-sidebar';
import BoardsSection from './Components/boards-section';
import TemplatesSection from './Components/TemplateSection';
import WorkspaceTopNav from './Components/workspace-top-nav';
import { useWorkspaces } from '@/_new/features/workspace/hooks/use-workspaces';

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

  const handleWorkspaceSelect = (id: number, name: string) => {
    setActiveWorkspaceId(id);
  };

  useEffect(() => {
    if (workspaces.length === 0) {
      setActiveWorkspaceId(null);
      return;
    }

    if (!activeWorkspaceId) {
      setActiveWorkspaceId(workspaces[0].id);
      return;
    }

    const exists = workspaces.some((workspace) => workspace.id === activeWorkspaceId);
    if (!exists) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, activeWorkspaceId]);

  const activeWorkspaceName = useMemo(() => {
    if (!activeWorkspaceId) return undefined;
    return workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name;
  }, [workspaces, activeWorkspaceId]);

  return (
    <div className="dashboard-shell min-h-screen flex flex-col">
      <DashboardHeader />

      <div className="flex flex-1">
        <WorkspaceSidebar
          activeWorkspaceId={activeWorkspaceId}
          onWorkspaceSelect={handleWorkspaceSelect}
          workspaces={workspaces}
          loading={loading}
          error={error}
          createWorkspace={createWorkspace}
          updateWorkspace={updateWorkspace}
          deleteWorkspace={deleteWorkspace}
          leaveWorkspace={leaveWorkspace}
          toggleFavourite={toggleFavourite}
        />

        <div className="dashboard-main flex-1 overflow-auto">
          <div className="w-full">
            <WorkspaceTopNav
              activeWorkspaceId={activeWorkspaceId}
              workspaces={workspaces}
              toggleFavourite={toggleFavourite}
              updateWorkspace={updateWorkspace}
              deleteWorkspace={deleteWorkspace}
              leaveWorkspace={leaveWorkspace}
            />

            <div className="p-8">
              <TemplatesSection workspaceId={activeWorkspaceId} />

              {activeWorkspaceId && (
                <BoardsSection workspaceId={activeWorkspaceId} workspaceName={activeWorkspaceName} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
