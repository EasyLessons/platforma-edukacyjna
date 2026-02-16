/**
 * CODE INPUT HOOK
 * 
 * Hook dla 6-cyfrowego kodu weryfikacyjnego
 * Zarządza:
 * - Input state (code array, focus, paste)
 * - Verification logic
 * - Resend logic + cooldown
 * - Error/success messages
 * 
 * Używany w:
 * - Email verification
 * - Password reset (step 2)
 */

import { useState, useRef, useEffect } from 'react';

interface UseCodeInputOptions {
  length?: number;
  autoFocus?: boolean;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  cooldownSeconds?: number;
}

export function useCodeInput({
  length = 6,
  autoFocus = true,
  onVerify,
  onResend,
  cooldownSeconds = 60,
}: UseCodeInputOptions) {

  // STATE
  const [code, setCode] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');

  // EFFECTS

  // Auto focus
  useEffect(() => {
    if (autoFocus) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // HANDLERS
  // ====================================

  // Obsługa zmiany w pojedynczym input
  const handleChange = (index: number, value: string) => {
    // Only digits allowed
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when complete
    if (index === length - 1 && value) {
      const fullCode = [...newCode.slice(0, length - 1), value].join('');
      if (fullCode.length === length) {
        handleVerify(fullCode);
      }
    }
  };

  //Obsługa Backspace - wraca do poprzedniego input
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Obsługa paste - wkleja cały kod na raz
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length);

    // Only digits allowed
    if (!/^\d+$/.test(pastedData)) return;

    const newCode = pastedData.split('').concat(Array(length).fill('')).slice(0, length);
    setCode(newCode);

    // Focus on last filled input
    const lastIndex = Math.min(pastedData.length, length - 1);
    inputRefs.current[lastIndex]?.focus();

    // Auto-verify if complete
    if (pastedData.length === length) {
      handleVerify(pastedData);
    }
  };

  // Weryfikacja kodu
  const handleVerify = async (codeToVerify?: string) => {
    const finalCode = codeToVerify || code.join('');

    // Validation
    if (finalCode.length !== length) {
      setError(`Wprowadź pełny ${length}-cyfrowy kod`);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onVerify(finalCode);
    } catch (error: any) {
      setError(error.message || 'Nieprawidłowy kod weryfikacyjny');
      clearCode();
    } finally {
      setIsLoading(false);
    }
  };

  // Ponowne wysłanie kodu
  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    setError('');
    setResendMessage('');

    try {
      await onResend();
      setResendMessage('Nowy kod wysłany!');
      setResendCooldown(cooldownSeconds);
      // Clear message after 5 seconds
      setTimeout(() => setResendMessage(''), 5000);
    } catch (error: any) {
      setError(error.message || 'Błąd wysyłania kodu');
    } finally {
      setIsLoading(false);
    }
  };

  // UTILS
  // ====================================

  // Wyczyść kod
  const clearCode = () => {
    setCode(Array(length).fill(''));
    inputRefs.current[0]?.focus();
  };
  // Pobierz kod jako string
  const getCodeString = () => code.join('');
  // Sprawdź czy kod jest kompletny
  const isComplete = () => code.every(digit => digit !== '') && code.length === length;

  return {
    // State
    code,
    inputRefs,
    isLoading,
    error,
    resendCooldown,
    resendMessage,
    // Handlers
    handleChange,
    handleKeyDown,
    handlePaste,
    handleVerify,
    handleResend,
    // Utils
    clearCode,
    getCodeString,
    isComplete,
  };
}
