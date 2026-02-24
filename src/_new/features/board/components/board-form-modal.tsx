/**
 * BOARD FORM MODAL
 *
 * Modal z formularzem tablicy.
 * Działa zarówno dla TWORZENIA nowej jak i EDYCJI istniejącej.
 *
 */

'use client';

import { useRef } from 'react';
import { X, Check } from 'lucide-react';
import { Input } from '@/_new/shared/ui/input';
import { Button } from '@/_new/shared/ui/button';
import { useModal } from '@/_new/shared/hooks/use-modal';
import { useBoardForm } from '../hooks/use-board-form';
import { useBoards } from '../hooks/use-boards';
import { getGradientClass, getIconComponent } from '../utils/helpers';
import { BoardColorPicker } from './board-color-picker';
import { BoardIconPicker } from './board-icon-picker';
import type { Board } from '../types';

interface BoardFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  board: Board | null;
  workspaceId: number;
}

export function BoardFormModal({ isOpen, onClose, mode, board, workspaceId }: BoardFormModalProps) {
  // STATE & DATA
  // ================================

  const { createBoard, updateBoard } = useBoards({ workspaceId, autoLoad: false });

  const {
    formData,
    errors,
    isSubmitting,
    isDirty,
    setIsSubmitting,
    validateForm,
    handleChange,
    resetForm,
  } = useBoardForm({
    initialData: mode === 'edit' ? board : undefined,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const isCreateMode = mode === 'create';
  const isEditMode = mode === 'edit';

  const title = isCreateMode ? 'Nowa tablica' : 'Ustawienia tablicy';
  const buttonText = isCreateMode ? 'Utwórz tablicę' : 'Zapisz zmiany';
  const loadingText = isCreateMode ? 'Tworzenie...' : 'Zapisywanie...';

  const PreviewIcon = getIconComponent(formData.icon);
  const previewGradient = getGradientClass(formData.bg_color);

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
        await createBoard({
          name: formData.name.trim(),
          icon: formData.icon,
          bg_color: formData.bg_color,
          workspace_id: workspaceId,
        });
      } else {
        if (!board) throw new Error('Board is required');
        await updateBoard(board.id, {
          name: formData.name.trim(),
          icon: formData.icon,
          bg_color: formData.bg_color,
        });
      }
      handleClose();
    } catch (err) {
      console.error(`Error ${isCreateMode ? 'creating' : 'updating'} board:`, err);
      alert(
        `Nie udało się ${isCreateMode ? 'utworzyć' : 'zaktualizować'} tablicy. Spróbuj ponownie.`
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

  if (isEditMode && !board) {
    console.error('BoardFormModal: board is required in edit mode');
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
            {isEditMode && board && <p className="text-sm text-gray-500 mt-1">{board.name}</p>}
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
          {/* Podgląd */}
          <div className="flex items-center justify-center">
            <div
              className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${previewGradient} flex items-center justify-center shadow-lg`}
            >
              <PreviewIcon size={40} className="text-white drop-shadow" />
            </div>
          </div>

          {/* Nazwa */}
          <div>
            <Input
              ref={inputRef}
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={isCreateMode ? 'np. Projekt X, Sprint 1...' : 'Nazwa tablicy'}
              error={errors.name}
              disabled={isSubmitting}
              label="Nazwa tablicy"
              maxLength={50}
            />
            <div className="text-right text-xs text-gray-400 mt-1">{formData.name.length}/50</div>
          </div>

          {/* Icon Picker */}
          <BoardIconPicker
            selected={formData.icon}
            onChange={(icon) => handleChange('icon', icon)}
            disabled={isSubmitting}
          />

          {/* Color Picker */}
          <BoardColorPicker
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
