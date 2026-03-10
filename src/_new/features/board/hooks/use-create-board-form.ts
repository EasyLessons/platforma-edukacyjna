/**
 * USE CREATE BOARD FORM
 *
 * Hook zarządzający formularzem tworzenia tablicy.
 *
 * Odpowiada za:
 * - Stan formularza (nazwa, ikona, kolor)
 * - Walidację przed submit
 * - Obsługę błędów
 * - Reset formularza po zamknięciu
 */

import { useState } from 'react';
import { validateBoardName, validateBoardIcon } from '../utils/validation';
import { DEFAULT_BOARD_ICON, DEFAULT_BOARD_COLOR } from '../utils/constants';
import type { BoardFormData, BoardErrors, BoardCreateRequest } from '../types';

interface UseCreateBoardFormOptions {
  workspaceId: number;
  onSubmit: (data: BoardCreateRequest) => Promise<void>;
  onClose: () => void;
}

export function useCreateBoardForm({ workspaceId, onSubmit, onClose }: UseCreateBoardFormOptions) {
  // STATE
  // ================================

  const [formData, setFormData] = useState<BoardFormData>({
    name: '',
    icon: DEFAULT_BOARD_ICON,
    bg_color: DEFAULT_BOARD_COLOR,
  });
  const [errors, setErrors] = useState<BoardErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // VALIDATION
  // ================================

  const validateForm = (): boolean => {
    const newErrors: BoardErrors = {};

    const nameValidation = validateBoardName(formData.name);
    if (!nameValidation.valid) newErrors.name = nameValidation.error;

    const iconValidation = validateBoardIcon(formData.icon);
    if (!iconValidation.valid) newErrors.icon = iconValidation.error;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ACTIONS
  // ================================

  const handleChange = (field: keyof BoardFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const resetForm = () => {
    setFormData({ name: '', icon: DEFAULT_BOARD_ICON, bg_color: DEFAULT_BOARD_COLOR });
    setErrors({});
    setIsSubmitting(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: formData.name.trim(),
        icon: formData.icon,
        bg_color: formData.bg_color,
        workspace_id: workspaceId,
      });
      handleClose();
    } catch (err) {
      console.error('Error creating board:', err);
      alert('Nie udało się utworzyć tablicy. Spróbuj ponownie.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReady = formData.name.trim() !== '';

  return {
    formData,
    errors,
    isSubmitting,
    isReady,
    handleChange,
    handleClose,
    handleSubmit,
  };
}