/**
 * USE EDIT WORKSPACE FORM HOOK
 *
 * Hook który zarządza formularzem edycji workspace'a.
 *
 * Odpowiada za:
 * - Stan formularza (nazwa, ikona, kolor)
 * - Walidacja przed submit
 * - Obsługa błędów
 * - Reset formularza
 *
 */

import { useState, useEffect } from 'react';
import { validateWorkspaceName, validateWorkspaceIcon } from '../utils/validation';
import type {
  WorkspaceFormData,
  WorkspaceErrors,
  Workspace,
  WorkspaceUpdateRequest,
} from '../types';

interface UseEditWorkspaceFormOptions {
  workspace: Workspace;
  onSubmit: (data: WorkspaceUpdateRequest) => Promise<void>;
  onClose: () => void;
}

export function useEditWorkspaceForm({ workspace, onSubmit, onClose }: UseEditWorkspaceFormOptions) {
  // STATE
  // ================================
  const [formData, setFormData] = useState<WorkspaceFormData>({
    name: workspace.name,
    icon: workspace.icon,
    bg_color: workspace.bg_color,
  });
  const [errors, setErrors] = useState<WorkspaceErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Gdy workspace id się zmieni, zsynchronizuj formularz
  useEffect(() => {
    setFormData({
      name: workspace.name,
      icon: workspace.icon,
      bg_color: workspace.bg_color,
    });
    setErrors({});
  }, [workspace.id]);

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
      name: workspace.name,
      icon: workspace.icon,
      bg_color: workspace.bg_color,
    });
    setErrors({});
    setIsSubmitting(false);
  };

  // handleClose - obsługa zamknięcia formularza X
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // handleSubmit - ubsługa submit, zatwierdzenia formularza
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
      console.error('Error updating workspace:', err);
      alert('Nie udało się zaktualizować przestrzeni. Spróbuj ponownie.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // isDirty - Czy formularz został zmieniony
  const isDirty =
    formData.name !== workspace.name ||
    formData.icon !== workspace.icon ||
    formData.bg_color !== workspace.bg_color;

  return {
    // State
    formData,
    errors,
    isSubmitting,
    isDirty,
    // Handlers
    handleChange,
    handleClose,
    handleSubmit,
  };
}
