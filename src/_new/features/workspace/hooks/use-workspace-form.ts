/**
 * USE CREATE WORKSPACE HOOK
 *
 * Hook który zarządza formularzem workspace'a.
 * Działa zarówna dla tworzenia nowego jak i edycji istniejącego.
 *
 * Odpowiada za:
 * - Stan formularza (nazwa, ikona, kolor)
 * - Walidacja przed submit
 * - Obsługa błędów
 * - Reset formularza
 *
 * Jeden hook, dwa przypadki użycia:
 * - Bez initialData = CREATE
 * - Z initial Data = UPDATE
 *
 */

import { useState, useEffect } from 'react';
import { validateWorkspaceName, validateWorkspaceIcon } from '../utils/validation';
import { DEFAULT_WORKSPACE_ICON, DEFAULT_WORKSPACE_COLOR } from '../utils/constants';
import type { WorkspaceFormData, WorkspaceErrors, Workspace } from '../types';

interface UseWorkspaceFormOptions {
  initialData?: Workspace | null;
}

export function useCreateWorkspace(options: UseWorkspaceFormOptions = {}) {
  const { initialData } = options;

  // STATE
  // ================================
  const [formData, setFormData] = useState<WorkspaceFormData>({
    name: initialData?.name || '',
    icon: initialData?.icon || DEFAULT_WORKSPACE_ICON,
    bg_color: initialData?.bg_color || DEFAULT_WORKSPACE_COLOR,
  });
  const [errors, setErrors] = useState<WorkspaceErrors>({});
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
        icon: DEFAULT_WORKSPACE_ICON,
        bg_color: DEFAULT_WORKSPACE_COLOR,
      });
    }

    setErrors({});
    setIsSubmitting(false);
  };

  // isDirty - Czy formularz został zmieniony
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
