/**
 * BOARD EDIT MODAL
 *
 * Modal z formularzem edycji tablicy.
 */

'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/_new/shared/ui/input';
import { Button } from '@/_new/shared/ui/button';
import { useModal } from '@/_new/shared/hooks/use-modal';
import { BoardIconPicker } from './board-icon-picker';
import { BoardColorPicker } from './board-color-picker';
import { useEditBoardForm } from '../hooks/use-edit-board-form';
import { getGradientClass, getIconComponent } from '../utils/helpers';
import type { Board, BoardUpdateRequest } from '../types';

interface BoardEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  board: Board;
  onSubmit: (data: BoardUpdateRequest) => Promise<void>;
}

export function BoardEditModal({ isOpen, onClose, board, onSubmit }: BoardEditModalProps) {
  // STATE
  // ================================

  const { formData, errors, isSubmitting, isDirty, handleChange, handleClose, handleSubmit } =
    useEditBoardForm({ board, onSubmit, onClose });

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const PreviewIcon = getIconComponent(formData.icon);
  const previewGradient = getGradientClass(formData.bg_color);

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
            <h2 className="text-xl font-bold text-gray-900">Ustawienia tablicy</h2>
            <p className="text-sm text-gray-500 mt-1">{board.name}</p>
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
              placeholder="Nazwa tablicy"
              label="Nazwa tablicy"
              error={errors.name}
              maxLength={50}
              disabled={isSubmitting}
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
            disabled={isSubmitting || !isDirty}
          >
            {isSubmitting ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </Button>
        </div>
      </div>
    </div>
  );
}