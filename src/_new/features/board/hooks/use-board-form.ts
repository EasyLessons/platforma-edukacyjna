/**
 * USE BOARD FORM
 *
 * Hook zarządzający formularzem tablicy.
 * Działa zarówno dla tworzenia nowego jak i edycji istniejącego.
 *
 * Odpowiada za:
 * - Stan formularza (nazwa, ikona, kolor)
 * - Walidacja przed submit
 * - Obsługa błędów
 * - Reset formularza
 *
 * Jeden hook, dwa przypadki użycia:
 * - Bez initialData = CREATE
 * - Z initialData   = UPDATE
 *
 */

import { useState, useEffect } from 'react';
import { validateBoardName, validateBoardIcon } from '../utils/validation';
import { DEFAULT_BOARD_ICON, DEFAULT_BOARD_COLOR } from '../utils/constants';
import type { BoardFormData, BoardErrors, Board } from '../types';

interface UseBoardFormOptions {
  initialData?: Board | null;
}

export function useBoardForm(options: UseBoardFormOptions = {}) {
  const { initialData } = options;

  // STATE
  // ================================

  const [formData, setFormData] = useState<BoardFormData>({
    name: initialData?.name || '',
    icon: initialData?.icon || DEFAULT_BOARD_ICON,
    bg_color: initialData?.bg_color || DEFAULT_BOARD_COLOR,
  });
  const [errors, setErrors] = useState<BoardErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // EFFECTS
  // ================================

  // Gdy initialData się zmieni, zaktualizuj formData
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        icon: initialData.icon,
        bg_color: initialData.bg_color,
      });
      setErrors({});
    }
  }, [initialData]);

  // VALIDATION
  // ================================

  const validateForm = (): boolean => {
    const newErrors: BoardErrors = {};

    const nameValidation = validateBoardName(formData.name);
    if (!nameValidation.valid) {
      newErrors.name = nameValidation.error;
    }

    const iconValidation = validateBoardIcon(formData.icon);
    if (!iconValidation.valid) {
      newErrors.icon = iconValidation.error;
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // ACTIONS
  // ================================

  // handleChange - Obsługuje zmianę wartości pola
  const handleChange = (field: keyof BoardFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Wyczyść błąd dla tego pola przy zmianie
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // resetForm - Resetuje formularz do stanu początkowego
  const resetForm = () => {
    if (initialData) {
      // UPDATE mode - wróć do initialData
      setFormData({
        name: initialData.name,
        icon: initialData.icon,
        bg_color: initialData.bg_color,
      });
    } else {
      // CREATE mode - wyczyść formularz
      setFormData({
        name: '',
        icon: DEFAULT_BOARD_ICON,
        bg_color: DEFAULT_BOARD_COLOR,
      });
    }

    setErrors({});
    setIsSubmitting(false);
  };

  // isDirty - Czy formularz został zmieniony względem initialData
  const isDirty = initialData
    ? formData.name !== initialData.name ||
      formData.icon !== initialData.icon ||
      formData.bg_color !== initialData.bg_color
    : formData.name.trim() !== '';

  return {
    // State
    formData,
    errors,
    isSubmitting,
    isDirty,
    // Actions
    setIsSubmitting,
    validateForm,
    handleChange,
    resetForm,
    // Meta
    isCreateMode: !initialData,
    isUpdateMode: !!initialData,
  };
}
