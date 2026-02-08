'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
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

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

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
      <div className="h-screen flex flex-col items-center justify-center relative overflow-hidden bg-white">
      {/* Gradient blobs - większe i bardziej widoczne */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Zielonkawy - lewy górny */}
        <div 
          className="absolute -top-20 -left-20 w-[700px] h-[700px] rounded-full opacity-40 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(134, 239, 172, 0.7) 0%, rgba(134, 239, 172, 0) 70%)'
          }}
        />
        
        {/* Niebieski - prawy górny */}
        <div 
          className="absolute -top-32 -right-32 w-[650px] h-[650px] rounded-full opacity-40 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(147, 197, 253, 0.7) 0%, rgba(147, 197, 253, 0) 70%)'
          }}
        />
        
        {/* Żółty - lewy dół */}
        <div 
          className="absolute -bottom-32 -left-20 w-[600px] h-[600px] rounded-full opacity-35 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(253, 224, 71, 0.6) 0%, rgba(253, 224, 71, 0) 70%)'
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-md px-6 -mt-40">
        {/* Logo */}
        <div className="text-center mb-10">
          <Image 
            src="/resources/LogoEasyLesson.webp"
            alt="EasyLesson"
            width={200}
            height={60}
            className="mx-auto"
          />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-light text-gray-900 text-center mb-3">
          {step === 'email' && 'Odzyskiwanie hasła'}
          {step === 'code' && 'Weryfikacja kodu'}
          {step === 'password' && 'Ustaw nowe hasło'}
        </h2>
        <p className="text-center text-gray-600 font-light mb-8">
          {step === 'email' && 'Podaj swój adres email'}
          {step === 'code' && 'Wprowadź kod z emaila'}
          {step === 'password' && 'Ustaw nowe hasło'}
        </p>

        {/* STEP 1: EMAIL */}
        {step === 'email' && (
          <form onSubmit={handleSendEmail} className="space-y-3">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="Email"
                className="w-full h-10 px-4 bg-white border border-gray-300 rounded-lg text-gray-900 font-light placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-all"
                required
              />
              {error && (
                <p className="mt-1 text-sm text-red-600 font-light">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="hover-shine w-full h-10 bg-gray-900 text-white font-light rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:cursor-pointer"
            >
              {isLoading ? 'Wysyłanie...' : 'Wyślij kod'}
            </button>
          </form>
        )}

        {/* STEP 2: CODE */}
        {step === 'code' && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-gray-600 text-sm font-light">Wysłaliśmy 6-cyfrowy kod na adres:</p>
              <p className="text-gray-900 font-normal mt-1">{email}</p>
            </div>

            <div>
              <label className="block text-sm font-light text-gray-600 mb-3 text-center">
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
                    className="w-10 h-10 text-center text-lg font-light text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-all"
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center font-light">
                {error}
              </div>
            )}

            {resendMessage && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm text-center font-light">
                {resendMessage}
              </div>
            )}

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCooldown > 0 || isLoading}
                className="hover-shine text-sm text-blue-600 font-light hover:text-blue-700 hover:underline transition-colors hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0
                  ? `Wyślij ponownie za ${resendCooldown}s`
                  : 'Wyślij kod ponownie'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleVerifyCode()}
              disabled={code.join('').length !== 6}
              className="hover-shine w-full h-10 bg-gray-900 text-white font-light rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:cursor-pointer"
            >
              {isLoading ? 'Weryfikacja...' : 'Zweryfikuj kod'}
            </button>
          </div>
        )}

        {/* STEP 3: PASSWORD */}
        {step === 'password' && (
          <form onSubmit={handleResetPassword} className="space-y-3">
            <div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Nowe hasło"
                  className="w-full h-10 px-4 pr-12 bg-white border border-gray-300 rounded-lg text-gray-900 font-light placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors hover:cursor-pointer"
                >
                  {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 font-light">
                Min. 8 znaków, wielka i mała litera, cyfra
              </p>
              {error && (
                <p className="mt-1 text-sm text-red-600 font-light">{error}</p>
              )}
            </div>

            <div>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={(e) => {
                    setPasswordConfirm(e.target.value);
                    setError('');
                  }}
                  placeholder="Powtórz hasło"
                  className="w-full h-10 px-4 pr-12 bg-white border border-gray-300 rounded-lg text-gray-900 font-light placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors hover:cursor-pointer"
                >
                  {showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="hover-shine w-full h-10 bg-gray-900 text-white font-light rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:cursor-pointer"
            >
              {isLoading ? 'Zmiana hasła...' : 'Zmień hasło'}
            </button>
          </form>
        )}
      </div>

      {/* Help text at bottom */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <Link 
          href="/login"
          className="hover-shine text-sm text-gray-600 font-light hover:text-gray-900 hover:underline transition-colors hover:cursor-pointer"
        >
          Powrót do logowania
        </Link>
      </div>
    </div>
  );
}