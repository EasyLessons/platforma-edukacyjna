/**
 * WORKSPACE SIDEBAR
 *
 * Sidebar z listą workspace'ów - KOMPOZYCJA z małych komponentów.
 * Dashboard-specific layout (collapse, sticky positioning).
 *
 * Sidebar używa gotowego WorkspaceList i dodaje tylko:
 * - Collapse/expand functionality
 * - Dashboard-specific layout
 * - Sticky positioning
 */

'use client';

import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';
import { WorkspaceList } from '@/_new/features/workspace/components/workspace-list';
import { WorkspaceFormModal } from '@/_new/features/workspace/components/workspace-form-modal';
import { useWorkspaces } from '@/_new/features/workspace/hooks/use-workspaces';

export default function WorkspaceSidebar() {
  // STATE
  // ================================

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { workspaces, loading } = useWorkspaces();

  // RENDERS
  // ================================

  // Colapsed version
  if (isCollapsed) {
    return (
      <>
        <div className="w-[72px] h-[calc(100vh-64px)] bg-gray-50 border-r border-gray-200 flex flex-col sticky top-[64px] transition-all duration-300">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-center">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsCollapsed(false)}
              title="Rozwiń sidebar"
            >
              <PanelLeftOpen size={18} />
            </Button>
          </div>

          {/* Collapsed content */}
          <div className="flex-1 p-2">
            {loading ? (
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
            ) : (
              <p className="text-xs text-center text-gray-500 mt-4">{workspaces.length}</p>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4 flex justify-center">
            <Button size="icon" onClick={() => setShowCreateModal(true)} title="Dodaj przestrzeń">
              <Plus size={20} />
            </Button>
          </div>
        </div>

        {/* Create Modal */}
        <WorkspaceFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          mode="create"
          workspace={null}
        />
      </>
    );
  }

  // Expanded version
  return (
    <>
      <div className="w-[350px] h-[calc(100vh-64px)] bg-gray-50 border-r border-gray-200 flex flex-col sticky top-[64px] transition-all duration-300">
        {/* HEADER */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                Przestrzenie
              </h2>
              <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full font-semibold">
                {workspaces.length}
              </span>
            </div>

            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsCollapsed(true)}
              className="border border-gray-200 shadow-sm"
              title="Zwiń sidebar"
            >
              <PanelLeftClose size={18} />
            </Button>
          </div>
        </div>

        {/* WORKSPACE LIST - Główny komponent */}
        <WorkspaceList
          onWorkspaceClick={(id) => {
            console.log('Selected workspace:', id);
            // TODO: Navigate to workspace boards lub set active
          }}
          showSearch={true}
          showCreateButton={false}
        />

        {/* FOOTER - Create Button */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <Button
            leftIcon={<Plus size={20} />}
            onClick={() => setShowCreateModal(true)}
            className="w-full"
          >
            Dodaj przestrzeń
          </Button>
        </div>
      </div>

      {/* Create Modal */}
      <WorkspaceFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mode="create"
        workspace={null}
      />
    </>
  );
}
