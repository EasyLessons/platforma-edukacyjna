'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react';

import { Input } from '@new/shared/ui/input';
import { Button } from '@new/shared/ui/button';
import { requestPasswordReset, verifyResetCode, resetPassword } from '../api/auth-api';

type Step = 'email' | 'code' | 'password';

export function PasswordResetForm() {
  const router = useRouter();

  // STATE
  // ============================================================================

  // Step management
  const [step, setStep] = useState<Step>('email');

  // Form data
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Resend code
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');

  // Code input refs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // EFFECTS
  // ============================================================================

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto focus on first code input
  useEffect(() => {
    if (step === 'code') {
      inputRefs.current[0]?.focus();
    }
  }, [step]);

  // STEP 1: EMAIL
  // ============================================================================

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Podaj poprawny adres email');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await requestPasswordReset({ email });
      setStep('code');
      setResendCooldown(60);
    } catch (error: any) {
      setError(error.message || 'Błąd wysyłania kodu');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 2: CODE VERIFICATION
  // ============================================================================

  const handleChange = (index: number, value: string) => {
    // Only digits
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');

    // Auto focus next
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify when all filled
    if (index === 5 && value) {
      const fullCode = [...newCode.slice(0, 5), value].join('');
      if (fullCode.length === 6) {
        handleVerifyCode(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);

    if (!/^\d+$/.test(pastedData)) return;

    const newCode = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
    setCode(newCode);

    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();

    if (pastedData.length === 6) {
      handleVerifyCode(pastedData);
    }
  };

  const handleVerifyCode = async (codeToVerify?: string) => {
    const finalCode = codeToVerify || code.join('');

    if (finalCode.length !== 6) {
      setError('Wprowadź pełny 6-cyfrowy kod');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await verifyResetCode({ email, code: finalCode });
      setStep('password');
    } catch (error: any) {
      setError(error.message || 'Nieprawidłowy kod');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setIsLoading(true);
    setError('');
    setResendMessage('');

    try {
      await requestPasswordReset({ email });
      setResendMessage('✅ Nowy kod wysłany!');
      setResendCooldown(60);
      setTimeout(() => setResendMessage(''), 5000);
    } catch (error: any) {
      setError(error.message || 'Błąd wysyłania kodu');
    } finally {
      setIsLoading(false);
    }
  };

  // STEP 3: NEW PASSWORD
  // ============================================================================

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!password || password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków');
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setError('Hasło musi zawierać małą i wielką literę oraz cyfrę');
      return;
    }

    if (password !== passwordConfirm) {
      setError('Hasła nie są identyczne');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await resetPassword({
        email,
        code: code.join(''),
        password,
        password_confirm: passwordConfirm,
      });

      // Success - redirect to login
      router.push('/login?reset=success');
    } catch (error: any) {
      setError(error.message || 'Błąd resetowania hasła');
    } finally {
      setIsLoading(false);
    }
  };

  // RENDER
  // ============================================================================
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-200 via-green-300 to-emerald-400 p-5">
      {/* Back Button */}
      <Link
        href="/login"
        className="absolute top-8 left-8 text-white hover:text-white/80 transition-colors flex items-center gap-2"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Powrót do logowania</span>
      </Link>

      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-white text-2xl font-semibold">Odzyskiwanie hasła</h2>
        <p className="text-white/80 mt-2">
          {step === 'email' && 'Podaj swój adres email'}
          {step === 'code' && 'Wprowadź kod z emaila'}
          {step === 'password' && 'Ustaw nowe hasło'}
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* STEP 1: EMAIL */}
        {step === 'email' && (
          <form onSubmit={handleSendEmail} className="space-y-6">
            <Input
              label="Adres email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              leftIcon={<Mail className="w-5 h-5" />}
              placeholder="twoj@email.com"
              error={error}
              required
            />

            <Button type="submit" loading={isLoading} className="w-full">
              {isLoading ? 'Wysyłanie...' : 'Wyślij kod'}
            </Button>
          </form>
        )}

        {/* STEP 2: CODE */}
        {step === 'code' && (
          <div className="space-y-6">
            <div className="text-center">
              <Mail className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <p className="text-gray-600 text-sm">Wysłaliśmy 6-cyfrowy kod na adres:</p>
              <p className="font-semibold text-gray-800 mt-1">{email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                Wprowadź kod
              </label>
              <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold text-gray-800 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            {resendMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm text-center">
                {resendMessage}
              </div>
            )}

            <div className="text-center">
              <Button
                variant="link"
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || isLoading}
                className="text-sm"
              >
                {resendCooldown > 0
                  ? `Wyślij ponownie za ${resendCooldown}s`
                  : 'Wyślij kod ponownie'}
              </Button>
            </div>

            <Button
              onClick={() => handleVerifyCode()}
              disabled={code.join('').length !== 6}
              loading={isLoading}
              className="w-full"
            >
              {isLoading ? 'Weryfikacja...' : 'Zweryfikuj kod'}
            </Button>
          </div>
        )}

        {/* STEP 3: PASSWORD */}
        {step === 'password' && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <Input
              label="Nowe hasło"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              leftIcon={<Lock className="w-5 h-5" />}
              rightIcon={showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              onRightIconClick={() => setShowPassword(!showPassword)}
              placeholder="••••••••"
              helperText="Min. 8 znaków, wielka i mała litera, cyfra"
              error={error}
              required
            />

            <Input
              label="Powtórz hasło"
              type={showConfirmPassword ? 'text' : 'password'}
              value={passwordConfirm}
              onChange={(e) => {
                setPasswordConfirm(e.target.value);
                setError('');
              }}
              leftIcon={<Lock className="w-5 h-5" />}
              rightIcon={
                showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />
              }
              onRightIconClick={() => setShowConfirmPassword(!showConfirmPassword)}
              placeholder="••••••••"
              required
            />

            <Button type="submit" loading={isLoading} className="w-full">
              {isLoading ? 'Zmiana hasła...' : 'Zmień hasło'}
            </Button>
          </form>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-white text-sm">
        <p>
          Pamiętasz hasło?{' '}
          <Link href="/login" className="font-semibold underline hover:text-white/80">
            Zaloguj się
          </Link>
        </p>
      </div>
    </div>
  );
}