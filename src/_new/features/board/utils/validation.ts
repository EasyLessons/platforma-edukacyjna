/**
 * BOARD VALIDATION
 *
 * Walidacja danych tablicy przed wysłaniem do backendu.
 * Odzwierciedla reguły z backend/dashboard/boards/schemas.py.
 *
 */

// validateBoardName - Waliduje nazwę tablicy.
// Backend: min_length=1, max_length=50
export const validateBoardName = (
  name: string
): { valid: boolean; error?: string } => {
  const trimmed = name.trim();

  if (!trimmed) {
    return { valid: false, error: 'Nazwa tablicy jest wymagana' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Nazwa może mieć maksymalnie 50 znaków' };
  }

  return { valid: true };
};

// validateBoardIcon - Waliduje nazwę ikony.
export const validateBoardIcon = (
  icon: string
): { valid: boolean; error?: string } => {
  if (!icon || !icon.trim()) {
    return { valid: false, error: 'Ikona jest wymagana' };
  }

  return { valid: true };
};