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

import { useState, useEffect } from 'react';
import { validateBoardName, validateBoardIcon } from '../utils/validation';
import type { BoardFormData, BoardErrors, Board, BoardUpdateRequest } from '../types';

interface UseEditBoardFormOptions {
  board: Board;
  onSubmit: (data: BoardUpdateRequest) => Promise<void>;
  onClose: () => void;
}

export function useEditBoardForm({ board, onSubmit, onClose }: UseEditBoardFormOptions) {
  // STATE
  // ================================

  const [formData, setFormData] = useState<BoardFormData>({
    name: board.name,
    icon: board.icon,
    bg_color: board.bg_color,
  });
  const [errors, setErrors] = useState<BoardErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Gdy zmieni się edytowana tablica, zsynchronizuj formularz
  useEffect(() => {
    setFormData({ name: board.name, icon: board.icon, bg_color: board.bg_color });
    setErrors({});
  }, [board.id]);

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
    setFormData({ name: board.name, icon: board.icon, bg_color: board.bg_color });
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
      });
      handleClose();
    } catch (err) {
      console.error('Error updating board:', err);
      alert('Nie udało się zaktualizować tablicy. Spróbuj ponownie.');
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
    isSubmitting,
    isDirty,
    handleChange,
    handleClose,
    handleSubmit,
  };
}