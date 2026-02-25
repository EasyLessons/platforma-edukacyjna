/**
 * WORKSPACE EDIT MODAL
 *
 * Modal z formularzem edycji workspace'a.
 *
 */

'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/_new/shared/ui/input';
import { Button } from '@/_new/shared/ui/button';
import { useModal } from '@/_new/shared/hooks/use-modal';
import { WorkspaceIconPicker } from './workspace-icon-picker';
import { WorkspaceColorPicker } from './workspace-color-picker';
import { useEditWorkspaceForm } from '../hooks/use-edit-workspace-form';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Ustawienia przestrzeni</h2>
            <p className="text-sm text-gray-500 mt-1">{workspace.name}</p>
          </div>

          <Button
            variant="destructive"
            size="icon"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Zamknij"
          >
            <X size={20} />
          </Button>
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
          <Button type="submit" className="w-full" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </Button>
        </form>
      </div>
    </div>
  );
}
