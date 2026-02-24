/**
 * WORKSPACE SIDEBAR
 *
 * Dashboard-specific layout dla workspace'ów.
 * Wszystkie akcje na workspace zarządza WorkspaceCard.
 * Sidebar zarządza tylko CREATE (globalna akcja).
 *
 */

'use client';

import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react';
import { Button } from '@/_new/shared/ui/button';
import { Input } from '@/_new/shared/ui/input';
import { WorkspaceList } from '@/_new/features/workspace/components/workspace-list';
import { WorkspaceFormModal } from '@/_new/features/workspace/components/workspace-form-modal';
import { useWorkspaces } from '@/_new/features/workspace/hooks/use-workspaces';

interface WorkspaceSidebarProps {
  onWorkspaceSelect: (workspaceId: number) => void;
}

export default function WorkspaceSidebar({ onWorkspaceSelect }: WorkspaceSidebarProps) {
  // STATE
  // ================================

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { workspaces } = useWorkspaces();

  // HANDLERS
  // ================================

  const handleWorkspaceSelect = (workspaceId: number) => {
    onWorkspaceSelect(workspaceId);
  };

  // RENDER
  // ================================

  return (
    <>
      <div
        className={`${
          isCollapsed ? 'w-[72px]' : 'w-[350px]'
        } h-[calc(100vh-64px)] bg-gray-50 border-r border-gray-200 flex flex-col sticky top-[64px] transition-all duration-300`}
      >
        {/* HEADER */}

        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            {!isCollapsed && (
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Przestrzenie
                </h2>
                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full font-semibold">
                  {workspaces.length}
                </span>
              </div>
            )}

            <Button
              variant="secondary"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="border border-gray-200 shadow-sm"
              title={isCollapsed ? 'Rozwiń sidebar' : 'Zwiń sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </Button>
          </div>

          {/* Search Input - tylko w expanded mode */}
          {!isCollapsed && (
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Szukaj przestrzeni..."
              leftIcon={<Search size={16} />}
            />
          )}
        </div>

        {/* WORKSPACE LIST */}

        <div className="flex-1 overflow-hidden">
          <WorkspaceList
            searchQuery={searchQuery}
            onWorkspaceSelect={handleWorkspaceSelect}
            variant={isCollapsed ? 'compact' : 'default'}
            showStats={!isCollapsed}
          />
        </div>

        {/* FOOTER - Create Button */}

        {!isCollapsed && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <Button
              leftIcon={<Plus size={20} />}
              onClick={() => setShowCreateModal(true)}
              className="w-full"
            >
              Dodaj przestrzeń
            </Button>
          </div>
        )}

        {/* Collapsed Footer */}
        {isCollapsed && (
          <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-center">
            <Button size="icon" onClick={() => setShowCreateModal(true)} title="Dodaj przestrzeń">
              <Plus size={20} />
            </Button>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}

      <WorkspaceFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        mode="create"
        workspace={null}
      />
    </>
  );
}
