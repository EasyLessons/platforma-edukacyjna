/**
 * STRONA ODZYSKIWANIA HASŁA
 * =========================
 *
 * Cel: Reset hasła użytkownika przez 6-cyfrowy kod wysłany na email
 *
 * Przepływ:
 * 1. Użytkownik podaje email
 * 2. Dostaje 6-cyfrowy kod na email
 * 3. Wpisuje kod
 * 4. Ustawia nowe hasło
 * 5. Redirect do /login
 *
 * Powiązane pliki:
 * - src/auth_api/api.ts (requestPasswordReset, verifyResetCode, resetPassword)
 * - src/app/login/page.tsx (link "Zapomniałeś hasła?")
 * - backend/auth/routes.py (endpointy /api/request-password-reset, etc.)
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mail, ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react';
import { requestPasswordReset, verifyResetCode, resetPassword } from '@/auth_api/api';
import Link from 'next/link';

export default function PasswordReset() {
  const router = useRouter();

  // Kroki: 'email' | 'code' | 'password'
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');

  // Dane
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // UI stany
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');

  // Referencje do inputów kodu
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer dla cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto focus na pierwszy input kodu
  useEffect(() => {
    if (step === 'code') {
      inputRefs.current[0]?.focus();
    }
  }, [step]);

  // === KROK 1: WYSŁANIE EMAILA ===
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();

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

  // === KROK 2: WERYFIKACJA KODU ===
  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Tylko cyfry

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');

    // Auto focus na następny
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify gdy wszystkie wypełnione
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

  // Ponowne wysłanie kodu
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

  // === KROK 3: ZMIANA HASŁA ===
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Walidacja
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

      // Sukces - redirect do logowania
      router.push('/login?reset=success');
    } catch (error: any) {
      setError(error.message || 'Błąd resetowania hasła');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-200 via-green-300 to-emerald-400 p-5">
      {/* Back button */}
      <Link
        href="/login"
        className="absolute top-8 left-8 text-white hover:text-white/80 transition-colors flex items-center gap-2"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Powrót do logowania</span>
      </Link>

      {/* Logo/Brand Section */}
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
        {/* KROK 1: EMAIL */}
        {step === 'email' && (
          <form onSubmit={handleSendEmail} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Adres email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-10 pr-4 py-3 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="twoj@email.com"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Wysyłanie...
                </>
              ) : (
                'Wyślij kod'
              )}
            </button>
          </form>
        )}

        {/* KROK 2: KOD */}
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
              <button
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || isLoading}
                className="text-sm text-green-600 hover:text-green-700 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0
                  ? `Wyślij ponownie za ${resendCooldown}s`
                  : 'Wyślij kod ponownie'}
              </button>
            </div>

            <button
              onClick={() => handleVerifyCode()}
              disabled={isLoading || code.join('').length !== 6}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Weryfikacja...
                </>
              ) : (
                'Zweryfikuj kod'
              )}
            </button>
          </div>
        )}

        {/* KROK 3: NOWE HASŁO */}
        {step === 'password' && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Nowe hasło
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-10 pr-12 py-3 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Min. 8 znaków, wielka i mała litera, cyfra
              </p>
            </div>

            <div>
              <label
                htmlFor="passwordConfirm"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Powtórz hasło
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="passwordConfirm"
                  value={passwordConfirm}
                  onChange={(e) => {
                    setPasswordConfirm(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-10 pr-12 py-3 text-gray-800 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Zmiana hasła...
                </>
              ) : (
                'Zmień hasło'
              )}
            </button>
          </form>
        )}
      </div>

      {/* Footer links */}
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
