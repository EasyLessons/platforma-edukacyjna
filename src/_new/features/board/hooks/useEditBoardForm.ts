/**
 * USE EDIT BOARD FORM
 *
 * Hook zarządzający formularzem edycji tablicy.
 *
 * Odpowiada za:
 * - Stan formularza zainicjowany danymi tablicy
 * - Walidację przed submit
 * - Obsługę błędów
 * - Reset do wartości pierwotnych po zamknięciu
 */
'use client';

import { useState, useEffect } from 'react';
import { validateBoardName, validateBoardIcon } from '../utils/validation';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';
import type { BoardFormData, BoardErrors, Board, BoardUpdateRequest } from '../types';

interface UseEditBoardFormOptions {
  board: Board;
  onSubmit: (data: BoardUpdateRequest) => Promise<void>;
  onClose: () => void;
}

export function useEditBoardForm({ board, onSubmit, onClose }: UseEditBoardFormOptions) {
  // STATE

  const [formData, setFormData] = useState<BoardFormData>({
    name: board.name,
    icon: board.icon,
    bg_color: board.bg_color,
  });
  const [errors, setErrors] = useState<BoardErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { handleError } = useErrorHandler({ onError: setSubmitError });

  // Gdy zmieni się edytowana tablica, zsynchronizuj formularz
  useEffect(() => {
    setFormData({ name: board.name, icon: board.icon, bg_color: board.bg_color });
    setErrors({});
    setSubmitError('');
  }, [board.id]);

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
    setSubmitError('');
  };

  const resetForm = () => {
    setFormData({ name: board.name, icon: board.icon, bg_color: board.bg_color });
    setErrors({})
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
      });
      handleClose();
    } catch (err) {
      await handleError(err); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDirty =
    formData.name !== board.name ||
    formData.icon !== board.icon ||
    formData.bg_color !== board.bg_color;

  return {
    formData,
    errors,
    submitError,
    isSubmitting,
    isDirty,
    handleChange,
    handleClose,
    handleSubmit,
  };
}