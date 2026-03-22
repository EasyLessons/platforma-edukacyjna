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
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';
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
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { handleError } = useErrorHandler({ onError: setSubmitError });

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
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSubmitError('');
  };

  // resetForm - Resetuje formularz do stanu początkowego
  const resetForm = () => {
    setFormData({
      name: '',
      icon: DEFAULT_WORKSPACE_ICON,
      bg_color: DEFAULT_WORKSPACE_COLOR,
    });
    setErrors({});
    setSubmitError('');
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

  return {
    // State
    formData,
    errors,
    isSubmitting,
    isReady: formData.name.trim() !== '',
    // Handlers
    handleChange,
    handleClose,
    handleSubmit,
  };
}
