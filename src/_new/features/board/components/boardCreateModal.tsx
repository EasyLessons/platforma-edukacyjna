/**
 * BOARD CREATE MODAL
 *
 * Modal z formularzem tworzenia tablicy.
 */

'use client';

import { useRef } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/_new/shared/ui/input';
import { useModal } from '@/_new/shared/hooks/use-modal';
import { DashboardButton } from '@/app/dashboard/Components/DashboardButton';
import { BoardIconPicker } from './boardIconPicker';
import { BoardColorPicker } from './boardColorPicker';
import { useCreateBoardForm } from '../hooks/useCreateBoardForm';
import { getGradientClass, getIconComponent } from '../utils/helpers';
import type { BoardCreateRequest } from '../types';

interface BoardCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace_id: number;
  onSubmit: (data: BoardCreateRequest) => Promise<void>;
}

export function BoardCreateModal({ isOpen, onClose, workspace_id, onSubmit }: BoardCreateModalProps) {
  // STATE
  // ================================

  const { formData, errors, isSubmitting, isReady, handleChange, handleClose, handleSubmit } =
    useCreateBoardForm({ workspace_id, onSubmit, onClose });

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
    <div className="dashboard-modal-overlay">
      <div
        ref={modalRef}
        className="dashboard-modal-surface max-w-lg"
      >
        {/* Header */}
        <div className="dashboard-modal-header">
          <h2 className="text-xl font-bold text-gray-900">Nowa tablica</h2>
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
              placeholder="np. Projekt X, Sprint 1..."
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
        <div className="dashboard-modal-footer">
          <DashboardButton variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            Anuluj
          </DashboardButton>
          <DashboardButton
            variant="primary"
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !isReady}
          >
            {isSubmitting ? 'Tworzenie...' : 'Utwórz tablicę'}
          </DashboardButton>
        </div>
      </div>
    </div>
  );
}