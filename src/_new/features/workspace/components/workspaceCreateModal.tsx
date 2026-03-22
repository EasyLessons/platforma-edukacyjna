/**
 * WORKSPACE CREATE MODAL
 *
 * Modal z formularzem tworzenia workspace'a.
 *
 */

'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/_new/shared/ui/input';
import { useModal } from '@/_new/shared/hooks/use-modal';
import { DashboardButton } from '@/app/dashboard/Components/DashboardButton';
import { WorkspaceIconPicker } from './workspaceIconPicker';
import { WorkspaceColorPicker } from './workspaceColorPicker';
import { useCreateWorkspaceForm } from '../hooks/useCreateWorkspaceForm';
import type { WorkspaceCreateRequest } from '../types';

interface WorkspaceCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: WorkspaceCreateRequest) => Promise<void>;
}

export function WorkspaceCreateModal({ isOpen, onClose, onSubmit }: WorkspaceCreateModalProps) {
  // STATE
  // ================================

  const { formData, errors, isSubmitting, isReady, handleChange, handleClose, handleSubmit } =
    useCreateWorkspaceForm({ onSubmit, onClose });

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
    <div className="dashboard-modal-overlay">
      <div
        ref={modalRef}
        className="dashboard-modal-surface max-w-lg"
      >
        {/* Header */}
        <div className="dashboard-modal-header">
          <h2 className="text-xl font-bold text-gray-900">Stwórz nową przestrzeń</h2>

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
            placeholder="np. Moja Firma"
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
            disabled={isSubmitting || !isReady}
          >
            {isSubmitting ? 'Tworzenie...' : 'Utwórz przestrzeń'}
          </DashboardButton>
        </form>
      </div>
    </div>
  );
}
