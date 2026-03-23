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
'use client'

import { useState } from 'react';
import { validateBoardName, validateBoardIcon } from '../utils/validation';
import { DEFAULT_BOARD_ICON, DEFAULT_BOARD_COLOR } from '../utils/constants';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';
import type { BoardFormData, BoardErrors, BoardCreateRequest } from '../types';

interface UseCreateBoardFormOptions {
  workspace_id: number;
  onSubmit: (data: BoardCreateRequest) => Promise<void>;
  onClose: () => void;
}

export function useCreateBoardForm({ workspace_id, onSubmit, onClose }: UseCreateBoardFormOptions) {
  // STATE

  const [formData, setFormData] = useState<BoardFormData>({
    name: '',
    icon: DEFAULT_BOARD_ICON,
    bg_color: DEFAULT_BOARD_COLOR,
  });
  const [errors, setErrors] = useState<BoardErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { handleError } = useErrorHandler({ onError: setSubmitError });

  // VALIDATION

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

  const handleChange = (field: keyof BoardFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const resetForm = () => {
    setFormData({ name: '', icon: DEFAULT_BOARD_ICON, bg_color: DEFAULT_BOARD_COLOR });
    setErrors({});
    setSubmitError('');
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
    setSubmitError('');
    try {
      await onSubmit({
        name: formData.name.trim(),
        icon: formData.icon,
        bg_color: formData.bg_color,
        workspace_id: workspace_id,
      });
      handleClose();
    } catch (err) {
      await handleError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    errors,
    submitError,
    isSubmitting,
    isReady: formData.name.trim() !== '',
    handleChange,
    handleClose,
    handleSubmit,
  };
}