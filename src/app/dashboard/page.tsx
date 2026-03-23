'use client';

import './dashboard-theme.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import DashboardHeader from './Header/DashboardHeader';
import WorkspaceSidebar from './Components/workspace-sidebar';
import BoardsSection from './Components/BoardsSection';
import TemplatesSection from './Components/TemplateSection';
import WorkspaceTopNav from './Components/workspace-top-nav';
import { useWorkspaces } from '@/_new/features/workspace/hooks/useWorkspaces';
import { boardKeys } from '@/_new/features/board/hooks/useBoard';
import { fetchBoards } from '@/_new/features/board/api/boardApi';

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
    refreshWorkspaces,
  } = useWorkspaces();

  const queryClient = useQueryClient();

  // Priority prefetch: active workspace boards fire immediately.
  // Background prefetch: remaining workspaces load after 800ms so they
  // don't compete with the primary request for bandwidth.
  useEffect(() => {
    if (workspaces.length === 0) return;

    void queryClient.prefetchQuery({
      queryKey: boardKeys.workspace(workspaces[0].id),
      queryFn: () => fetchBoards(workspaces[0].id),
      staleTime: 10 * 60 * 1000,
    });

    if (workspaces.length <= 1) return;

    const timer = setTimeout(() => {
      workspaces.slice(1).forEach((ws) => {
        void queryClient.prefetchQuery({
          queryKey: boardKeys.workspace(ws.id),
          queryFn: () => fetchBoards(ws.id),
          staleTime: 10 * 60 * 1000,
        });
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [workspaces, queryClient]);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(null);
  const [workspaceTopNavHeight, setWorkspaceTopNavHeight] = useState(72);
  const workspaceTopNavRef = useRef<HTMLDivElement | null>(null);

  const handleWorkspaceSelect = useCallback((id: number, _name: string) => {
    setActiveWorkspaceId(id);
  }, []);

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

  useEffect(() => {
    const topNavElement = workspaceTopNavRef.current;
    if (!topNavElement) return;

    const updateHeight = () => {
      const measuredHeight = Math.ceil(topNavElement.getBoundingClientRect().height);
      if (measuredHeight > 0) {
        setWorkspaceTopNavHeight(measuredHeight);
      }
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }

    const resizeObserver = new ResizeObserver(updateHeight);
    resizeObserver.observe(topNavElement);

    return () => resizeObserver.disconnect();
  }, [activeWorkspaceId, workspaces.length]);

  return (
    <div className="dashboard-shell h-screen flex flex-col overflow-hidden bg-[var(--dash-panel)]">
      <DashboardHeader refreshWorkspaces={refreshWorkspaces} />

      <div className="flex flex-1 min-h-0 overflow-hidden ">
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

        <main className="dashboard-main flex-1 min-h-0 overflow-y-auto relative bg-white rounded-tl-[3.5rem] shadow-[0_1px_2px_rgba(0,0,0,0.05)] mr-6 mb-6">
          <div className="flex flex-col w-full min-h-full">
            <div ref={workspaceTopNavRef} className="sticky top-0 z-30 bg-[var(--dash-panel)]">
              <WorkspaceTopNav
                activeWorkspaceId={activeWorkspaceId}
                workspaces={workspaces}
                toggleFavourite={toggleFavourite}
                updateWorkspace={updateWorkspace}
                deleteWorkspace={deleteWorkspace}
                leaveWorkspace={leaveWorkspace}
              />
            </div>

            <div className="p-8 pb-20">
              <TemplatesSection workspaceId={activeWorkspaceId} />

              {activeWorkspaceId && (
                <BoardsSection
                  workspace_id={activeWorkspaceId}
                  workspace_name={activeWorkspaceName}
                  stickyOffset={workspaceTopNavHeight}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
