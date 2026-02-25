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
import { Button } from '@/_new/shared/ui/button';
import { useModal } from '@/_new/shared/hooks/use-modal';
import { WorkspaceIconPicker } from './workspace-icon-picker';
import { WorkspaceColorPicker } from './workspace-color-picker';
import { useCreateWorkspaceForm } from '../hooks/use-create-workspace-form';
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Stwórz nową przestrzeń</h2>

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
          <Button type="submit" className="w-full" disabled={isSubmitting || !isReady}>
            {isSubmitting ? 'Tworzenie...' : 'Utwórz przestrzeń'}
          </Button>
        </form>
      </div>
    </div>
  );
}
