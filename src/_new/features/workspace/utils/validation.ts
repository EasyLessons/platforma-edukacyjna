/**
 * WORKSPACE VALIDATION
 * 
 * Walidacja danych workspace przed wysłaniem do backendu.
 * Walidacja jest też w backendzie, ale teraz użytkownik dostaje 
 * błąd natychmiast, nie czeka na odpowiedź API.
 *
*/

// validateWorkspaceName - Waliduje nazwę workspace'a
export const validateWorkspaceName = (
  name: string
): { valid: boolean; error?: string } => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return { valid: false, error: 'Nazwa jest wymagana' };
  }

  if (trimmedName.length > 200) {
    return { 
      valid: false, 
      error: 'Nazwa może mieć maksymalnie 200 znaków' 
    };
  }

  return { valid: true };
};

// validateWorkspaceIcon - Waliduje nazwę ikony
export const validateWorkspaceIcon = (
  icon: string
): { valid: boolean; error?: string } => {
  if (!icon || !icon.trim()) {
    return { valid: false, error: 'Ikona jest wymagana' };
  }

  return { valid: true };
};
