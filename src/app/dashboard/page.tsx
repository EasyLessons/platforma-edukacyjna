'use client';

import './dashboard-theme.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardHeader from './Header/DashboardHeader';
import WorkspaceSidebar from './Components/workspace-sidebar';
import BoardsSection from './Components/BoardsSection';
import TemplatesSection from './Components/TemplateSection';
import WorkspaceTopNav from './Components/workspace-top-nav';
import RecentsView from './Components/RecentsView';
import { useWorkspaces, useDashboardInit } from '@/_new/features/workspace/hooks/useWorkspaces';

export default function Dashboard() {
  // --- 1. BOOTSTRAP DASHBOARD ---
  // To zapewnia tylko jeden call do /init na starcie.
  const { isLoading: initLoading } = useDashboardInit();

  if (initLoading) {
    // Globalny loader na całą stronę dopóki Megabundle ładuje dane z init.
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50/50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          <span className="mt-4 text-gray-500 font-medium">Inicjalizacja środowiska...</span>
        </div>
      </div>
    );
  }

  return <DashboardContent />;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Zaciągną dane prosto z cache zasiane przez useDashboardInit
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

  const workspaceIdFromUrl = useMemo(() => {
    const value = searchParams.get('workspace');
    if (!value) return null;

    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(null);
  const [appliedUrlWorkspaceId, setAppliedUrlWorkspaceId] = useState<number | null>(null);
  const [currentView, setCurrentView] = useState<'workspace' | 'recent'>('workspace');
  const [workspaceTopNavHeight, setWorkspaceTopNavHeight] = useState(72);
  const workspaceTopNavRef = useRef<HTMLDivElement | null>(null);

  const handleWorkspaceSelect = useCallback((id: number, _name: string) => {
    setActiveWorkspaceId(id);
    setCurrentView('workspace');
    const params = new URLSearchParams(searchParams);
    params.set('workspace', id.toString());
    router.replace(`/dashboard?${params.toString()}`);
  }, [searchParams, router]);

  useEffect(() => {
    if (workspaces.length === 0) {
      setActiveWorkspaceId(null);
      return;
    }

    if (workspaceIdFromUrl && workspaceIdFromUrl !== appliedUrlWorkspaceId) {
      const exists = workspaces.some((workspace) => workspace.id === workspaceIdFromUrl);
      if (exists) {
        setActiveWorkspaceId(workspaceIdFromUrl);
        setAppliedUrlWorkspaceId(workspaceIdFromUrl);
        return;
      }
    }

    const firstFavourite = workspaces.find((w) => w.is_favourite);
    const defaultWorkspaceId = firstFavourite ? firstFavourite.id : workspaces[0].id;

    if (!activeWorkspaceId) {
      setActiveWorkspaceId(defaultWorkspaceId);
      return;
    }

    const exists = workspaces.some((workspace) => workspace.id === activeWorkspaceId);
    if (!exists) {
      setActiveWorkspaceId(defaultWorkspaceId);
    }
  }, [workspaces, activeWorkspaceId, workspaceIdFromUrl, appliedUrlWorkspaceId]);

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
          currentView={currentView}
          onWorkspaceSelect={handleWorkspaceSelect}
          onRecentSelect={() => setCurrentView('recent')}
          workspaces={workspaces}
          loading={loading}
          error={error}
          createWorkspace={createWorkspace}
          updateWorkspace={updateWorkspace}
          deleteWorkspace={deleteWorkspace}
          leaveWorkspace={leaveWorkspace}
          toggleFavourite={toggleFavourite}
        />

        <main className="dashboard-main flex-1 min-h-0 overflow-y-auto relative bg-white">
          {currentView === 'recent' ? (
            <RecentsView />
          ) : (
            <div className="flex flex-col w-full min-h-full">
              <div ref={workspaceTopNavRef} className="sticky top-0 z-30 bg-white">
                <WorkspaceTopNav
                  activeWorkspaceId={activeWorkspaceId}
                  workspaces={workspaces}
                  toggleFavourite={toggleFavourite}
                  updateWorkspace={updateWorkspace}
                  deleteWorkspace={deleteWorkspace}
                  leaveWorkspace={leaveWorkspace}
                />
              </div>

              <div className="p-4 pb-10 md:p-8 md:pb-20">
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
          )}
        </main>
      </div>
    </div>
  );
}
