/**
 * PASSWORD RESET HOOK
 *
 * Logika odzyskiwania hasła.
 * Używa shared useCodeInput dla step 2 (code verification).
 * Każdy krok ma własny state.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestPasswordReset, verifyResetCode, resetPassword } from '../api/authApi';
import { validateEmail, validatePassword, validatePasswordsMatch } from '../utils/validation';
import { useErrorHandler } from '@/_new/shared/hooks/useErrorHandler';
import type { FormErrors } from '../types';

type Step = 'email' | 'code' | 'password';

interface EmailFormData {
  email: string;
}

interface PasswordFormData {
  password: string;
  password_confirm: string;
}

export function usePasswordReset() {
  const router = useRouter();

  // STATE
  // ============================================================================

  const [step, setStep] = useState<Step>('email');
  const [verifiedCode, setVerifiedCode] = useState('');
  // Step 1
  const [email, setEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailErrors, setEmailErrors] = useState<FormErrors<EmailFormData>>({});
  const [emailError, setEmailError] = useState('');
  // Step 3
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<FormErrors<PasswordFormData>>({});
  const [passwordError, setPasswordError] = useState('');

  const { handleError: handleEmailError } = useErrorHandler({
    onError: setEmailError,
  });

  const { handleError: handlePasswordError } = useErrorHandler({
    onError: setPasswordError,
  });

  // STEP 1: EMAIL

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailErrors({})
    setEmailError('');
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateEmail(email);
    if (!validation.valid) {
      setEmailErrors({ email: validation.error });
      return;
    }

    setEmailLoading(true);
    setEmailError('');

    try {
      await requestPasswordReset({ email });
      setStep('code');
    } catch (err) {
      await handleEmailError(err);
    } finally {
      setEmailLoading(false);
    }
  };

  // STEP 2: CODE - callbacks dla CodeInput

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
    setPasswordErrors({});
    setPasswordError('');
  };

  const handlePasswordConfirmChange = (value: string) => {
    setPasswordConfirm(value);
    setPasswordErrors({});
    setPasswordError('');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: FormErrors<PasswordFormData> = {};

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      newErrors.password = passwordValidation.error;
    }

    const matchValidation = validatePasswordsMatch(password, passwordConfirm);
    if (!matchValidation.valid) {
      newErrors.password_confirm = matchValidation.error;
    }

    if (Object.keys(newErrors).length > 0) {
      setPasswordErrors(newErrors);
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
    } catch (err) {
      await handlePasswordError(err);
    } finally {
      setPasswordLoading(false);
    }
  };

  return {
    step,
    setStep,
    // Step 1
    email,
    emailErrors,
    emailError,
    emailLoading,
    handleEmailChange,
    handleSendEmail,
    // Step 2
    handleCodeVerified,
    handleCodeResend,
    // Step 3
    password,
    passwordConfirm,
    passwordErrors,
    passwordError,
    passwordLoading,
    handlePasswordChange,
    handlePasswordConfirmChange,
    handleResetPassword,
  };
}
