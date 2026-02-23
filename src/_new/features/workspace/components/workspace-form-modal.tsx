/**
 * WORKSPACE FORM MODAL
 *
 * Modal z formularzem workspace'a.
 * Działa zarówno dla TWORZENIA nowego jak i EDYCJI istniejącego.
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
import { useWorkspaceForm } from '../hooks/use-workspace-form';
import { useWorkspaces } from '../hooks/use-workspaces';
import type { Workspace } from '../types';

interface WorkspaceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  workspace: Workspace | null;
}

export function WorkspaceFormModal({
  isOpen,
  onClose,
  mode,
  workspace,
}: WorkspaceFormModalProps) {
  // STATE & DATA
  // ================================

  const { createWorkspace, updateWorkspace } = useWorkspaces();

  const {
    formData,
    errors,
    isSubmitting,
    isDirty,
    setIsSubmitting,
    validateForm,
    handleChange,
    resetForm,
  } = useWorkspaceForm({
    initialData: mode === 'edit' ? workspace : undefined,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const isCreateMode = mode === 'create';
  const isEditMode = mode === 'edit';

  const title = isCreateMode ? 'Stwórz nową przestrzeń' : 'Ustawienia przestrzeni';
  const buttonText = isCreateMode ? 'Utwórz przestrzeń' : 'Zapisz zmiany';
  const loadingText = isCreateMode ? 'Tworzenie...' : 'Zapisywanie...';

  // HANDLERS
  // ================================

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;
    setIsSubmitting(true);

    try {
      if (isCreateMode) {
        // CREATE mode
        await createWorkspace({
          name: formData.name.trim(),
          icon: formData.icon,
          bg_color: formData.bg_color,
        });
      } else {
        // EDIT mode
        if (!workspace) {
          throw new Error('Workspace is required');
        }
        await updateWorkspace(workspace.id, {
          name: formData.name.trim(),
          icon: formData.icon,
          bg_color: formData.bg_color,
        });
      }
      handleClose();
    } catch (err) {
      console.error(`Error ${isCreateMode ? 'creating' : 'updating'} workspace:`, err);
      alert(
        `Nie udało się ${isCreateMode ? 'utworzyć' : 'zaktualizować'} przestrzeni. Spróbuj ponownie.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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

  if (isEditMode && !workspace) {
    console.error('WorkspaceFormModal: workspace is required');
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            {isEditMode && workspace && (
              <p className="text-sm text-gray-500 mt-1">{workspace.name}</p>
            )}
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
          <div>
            <Input
              ref={inputRef}
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={
                isCreateMode ? 'np. Moja Firma, Projekt X, Korepetycje...' : 'Nazwa przestrzeni'
              }
              error={errors.name}
              disabled={isSubmitting}
              label="Nazwa przestrzeni"
              maxLength={200}
            />
          </div>

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
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Anuluj
          </Button>
          <Button
            variant="dark"
            type="submit"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || (isCreateMode ? !formData.name.trim() : !isDirty)}
          >
            {isSubmitting ? loadingText : buttonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
