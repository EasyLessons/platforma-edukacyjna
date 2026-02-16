/**
 * PASSWORD RESET HOOK
 * 
 * Logika odzyskiwania hasła.
 * Używa shared useCodeInput dla step 2 (code verification).
 * Każdy krok ma własny state.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestPasswordReset, verifyResetCode, resetPassword } from '../api/auth-api';
import { validateEmail, validatePassword, validatePasswordsMatch } from '../utils/validation';

type Step = 'email' | 'code' | 'password';

export function usePasswordReset() {
  const router = useRouter();

  // STATE
  // ============================================================================

  const [step, setStep] = useState<Step>('email');
  const [verifiedCode, setVerifiedCode] = useState('');
  // Step 1
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  // Step 3
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // STEP 1: EMAIL
  // ============================================================================

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError('');
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      setEmailError(emailValidation.error!);
      return;
    }

    setEmailLoading(true);
    setEmailError('');

    try {
      await requestPasswordReset({ email });
      setStep('code');
    } catch (error: any) {
      setEmailError(error.message || 'Błąd wysyłania kodu');
    } finally {
      setEmailLoading(false);
    }
  };

  // STEP 2: CODE - callbacks dla CodeInput
  // ============================================================================
  const handleCodeVerified = async (code: string) => {
    await verifyResetCode({ email, code });
    setVerifiedCode(code);
    setStep('password');
  };

  const handleCodeResend = async () => {
    await requestPasswordReset({ email });
  };

  // STEP 3: PASSWORD
  // ============================================================================

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordError('');
  };

  const handlePasswordConfirmChange = (value: string) => {
    setPasswordConfirm(value);
    setPasswordError('');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setPasswordError(passwordValidation.error!);
      return;
    }

    const passwordsMatchValidation = validatePasswordsMatch(password, passwordConfirm);
    if (!passwordsMatchValidation.valid) {
      setPasswordError(passwordsMatchValidation.error!);
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');

    try {
      await resetPassword({
        email,
        code: verifiedCode,
        password,
        password_confirm: passwordConfirm,
      });
      router.push('/login?reset=success');
    } catch (error: any) {
      setPasswordError(error.message || 'Błąd resetowania hasła');
    } finally {
      setPasswordLoading(false);
    }
  };

  return {
    step,
    setStep,
    // Step 1
    email,
    handleEmailChange,
    handleSendEmail,
    emailLoading,
    emailError,
    // Step 2
    handleCodeVerified,
    handleCodeResend,
    // Step 3
    password,
    passwordConfirm,
    handlePasswordChange,
    handlePasswordConfirmChange,
    handleResetPassword,
    passwordLoading,
    passwordError,
  };
}