/**
 * WORKSPACE EDIT MODAL
 *
 * Modal z formularzem edycji workspace'a.
 *
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Input } from '@/_new/shared/ui/input';
import { useModal } from '@/_new/shared/hooks/use-modal';
import { DashboardButton } from '@/app/dashboard/Components/DashboardButton';
import { WorkspaceIconPicker } from './workspaceIconPicker';
import { WorkspaceColorPicker } from './workspaceColorPicker';
import { useEditWorkspaceForm } from '../hooks/useEditWorkspaceForm';
import type { Workspace, WorkspaceUpdateRequest } from '../types';

interface WorkspaceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
  onSubmit: (data: WorkspaceUpdateRequest) => Promise<void>;
}

export function WorkspaceEditModal({
  isOpen,
  onClose,
  workspace,
  onSubmit,
}: WorkspaceEditModalProps) {
  // STATE
  // ================================

  const { formData, errors, isSubmitting, isDirty, handleChange, handleClose, handleSubmit } =
    useEditWorkspaceForm({ workspace, onSubmit, onClose });

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // MODAL BEHAVIOR
  // ================================

  useModal({
    isOpen,
    onClose: handleClose,
    modalRef,
    focusRef: inputRef,
    preventCloseWhen: () => isSubmitting,
  });

  // RENDER
  // ================================

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="dashboard-modal-overlay">
      <div
        ref={modalRef}
        className="dashboard-modal-surface max-w-lg"
      >
        {/* Header */}
        <div className="dashboard-modal-header">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Ustawienia przestrzeni</h2>
            <p className="text-sm text-gray-500 mt-1">{workspace.name}</p>
          </div>

          <DashboardButton
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Zamknij"
            className="h-9 w-9 rounded-full p-0"
          >
            <X size={20} />
          </DashboardButton>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Name Input */}
          <Input
            ref={inputRef}
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="Nazwa przestrzeni"
            label="Nazwa przestrzeni"
            error={errors.name}
            maxLength={200}
            disabled={isSubmitting}
          />

          {/* Icon Picker */}
          <WorkspaceIconPicker
            selected={formData.icon}
            onChange={(icon) => handleChange('icon', icon)}
            disabled={isSubmitting}
          />

          {/* Color Picker */}
          <WorkspaceColorPicker
            selected={formData.bg_color}
            onChange={(color) => handleChange('bg_color', color)}
            disabled={isSubmitting}
          />

          {/* Submit */}
          <DashboardButton
            variant="primary"
            type="submit"
            className="w-full"
            disabled={isSubmitting || !isDirty}
          >
            {isSubmitting ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </DashboardButton>
        </form>
      </div>
    </div>,
    document.body
  );
}
