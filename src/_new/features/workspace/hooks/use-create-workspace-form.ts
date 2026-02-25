/**
 * USE CREATE WORKSPACE FORM HOOK
 *
 * Hook który zarządza formularzem tworzenia workspace'a.
 *
 * Odpowiada za:
 * - Stan formularza (nazwa, ikona, kolor)
 * - Walidacja przed submit
 * - Obsługa błędów
 * - Reset formularza
 *
 */

import { useState } from 'react';
import { validateWorkspaceName, validateWorkspaceIcon } from '../utils/validation';
import { DEFAULT_WORKSPACE_ICON, DEFAULT_WORKSPACE_COLOR } from '../utils/constants';
import type { WorkspaceFormData, WorkspaceErrors, WorkspaceCreateRequest } from '../types';

interface UseCreateWorkspaceFormOptions {
  onSubmit: (data: WorkspaceCreateRequest) => Promise<void>;
  onClose: () => void;
}

export function useCreateWorkspaceForm({ onSubmit, onClose }: UseCreateWorkspaceFormOptions) {
  // STATE
  // ================================
  const [formData, setFormData] = useState<WorkspaceFormData>({
    name: '',
    icon: DEFAULT_WORKSPACE_ICON,
    bg_color: DEFAULT_WORKSPACE_COLOR,
  });
  const [errors, setErrors] = useState<WorkspaceErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // VALIDATION
  // ================================

  // validateForm - Waliduje cały formularz
  const validateForm = (): boolean => {
    const newErrors: WorkspaceErrors = {};

    // Walidacja nazwy
    const nameValidation = validateWorkspaceName(formData.name);
    if (!nameValidation.valid) {
      newErrors.name = nameValidation.error;
    }

    // Walidacja ikony
    const iconValidation = validateWorkspaceIcon(formData.icon);
    if (!iconValidation.valid) {
      newErrors.icon = iconValidation.error;
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  // ACTIONS
  // ================================

  // handleChange - Obsługuje zmianę wartości pola
  const handleChange = (field: keyof WorkspaceFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Wyczyść błąd dla tego pola
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // resetForm - Resetuje formularz do stanu początkowego
  const resetForm = () => {
    setFormData({
      name: '',
      icon: DEFAULT_WORKSPACE_ICON,
      bg_color: DEFAULT_WORKSPACE_COLOR,
    });
    setErrors({});
    setIsSubmitting(false);
  };

  // handleClose - obsługuje zamknięcie modala X
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // handleSubmit - obsługuje submit, zatwierdzenie formularza
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
      console.error('Error creating workspace:', err);
      alert('Nie udało się utworzyć przestrzeni. Spróbuj ponownie.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // isReady - Czy nazwa została wpisana
  const isReady = formData.name.trim() !== '';

  return {
    // State
    formData,
    errors,
    isSubmitting,
    isReady,
    // Handlers
    handleChange,
    handleClose,
    handleSubmit,
  };
}
