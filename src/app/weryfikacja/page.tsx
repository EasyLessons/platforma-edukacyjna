/**
 * STRONA WERYFIKACJI EMAILA
 * =========================
 *
 * Cel: Weryfikacja konta użytkownika przez 6-cyfrowy kod wysłany na email
 *
 * Przepływ:
 * 1. Użytkownik wchodzi tutaj z URL: /weryfikacja?userId=123&email=test@test.com
 * 2. Wpisuje 6-cyfrowy kod z emaila
 * 3. Po weryfikacji → automatyczne logowanie i redirect do /dashboard
 *
 * Przypadki użycia:
 * - Po rejestracji (redirect z /rejestracja)
 * - Po próbie logowania z niezweryfikowanym kontem
 * - Po przypadkowym zamknięciu strony podczas rejestracji
 *
 * Funkcje:
 * - Weryfikacja kodu (POST /api/verify-email)
 * - Ponowne wysłanie kodu (POST /api/resend-code)
 * - Timer odliczający do ponownego wysłania (60 sekund)
 * - Automatyczne wklejanie kodu
 *
 * Powiązane pliki:
 * - src/auth_api/api.ts (verifyEmail, resendVerificationCode)
 * - src/app/rejestracja/page.tsx (przekierowuje tutaj)
 * - src/app/login/page.tsx (przekierowuje tutaj jeśli niezweryfikowane)
 * - backend/main.py (endpointy /api/verify-email, /api/resend-code)
 */

'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { verifyEmail, resendVerificationCode, saveToken, saveUser } from '@/auth_api/api';
import Link from 'next/link';

function VerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pobierz dane z URL
  const userId = searchParams.get('userId');
  const email = searchParams.get('email');

  // Stan dla 6 inputów kodu
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Stan dla resend
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState('');

  // Referencje do inputów
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer dla cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto focus na pierwszy input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Redirect jeśli brak danych
  useEffect(() => {
    if (!userId || !email) {
      router.push('/rejestracja');
    }
  }, [userId, email, router]);

  // Obsługa zmiany w input
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

    // Auto submit gdy wszystkie wypełnione
    if (index === 5 && value) {
      const fullCode = [...newCode.slice(0, 5), value].join('');
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  // Obsługa backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Obsługa paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);

    if (!/^\d+$/.test(pastedData)) return;

    const newCode = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
    setCode(newCode);

    // Focus na ostatni wypełniony
    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();

    // Auto submit jeśli pełny kod
    if (pastedData.length === 6) {
      handleVerify(pastedData);
    }
  };

  // Weryfikacja kodu
  const handleVerify = async (codeToVerify?: string) => {
    const finalCode = codeToVerify || code.join('');

    if (finalCode.length !== 6) {
      setError('Wprowadź pełny 6-cyfrowy kod');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await verifyEmail({
        user_id: parseInt(userId!),
        code: finalCode,
      });

      console.log('✅ Email zweryfikowany!');

      // Redirect do dashboard
      router.push('/login');
    } catch (error: any) {
      setIsLoading(false);
      setError(error.message || 'Nieprawidłowy kod weryfikacyjny');
      setCode(['', '', '', '', '', '']); // Wyczyść kod
      inputRefs.current[0]?.focus();
      console.error('❌ Błąd weryfikacji:', error);
    }
  };

  // Ponowne wysłanie kodu
  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setResendLoading(true);
    setError('');
    setResendMessage('');

    try {
      await resendVerificationCode(parseInt(userId!));

      const data = await resendVerificationCode(parseInt(userId!));
      setResendMessage('✅ Nowy kod wysłany na email!');

      setResendCooldown(60); // 60 sekund cooldown
      console.log('📧 Kod ponownie wysłany');

      // Wyczyść wiadomość po 5 sekundach
      setTimeout(() => setResendMessage(''), 5000);
    } catch (error: any) {
      setError(error.message || 'Błąd przy wysyłaniu kodu');
      console.error('❌ Błąd resend:', error);
    } finally {
      setResendLoading(false);
    }
  };

  if (!userId || !email) {
    return null; // Redirect się wykonuje
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-200 via-green-300 to-emerald-400 p-5">
      {/* Back button */}
      <Link
        href="/rejestracja"
        className="absolute top-8 left-8 text-white hover:text-white/80 transition-colors flex items-center gap-2"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Powrót</span>
      </Link>

      {/* Verification Card */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Zweryfikuj email</h1>
          <p className="text-gray-600 text-sm">Wysłaliśmy kod weryfikacyjny na:</p>
          <p className="text-green-600 font-semibold mt-1">{email}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {/* Success Message */}
        {resendMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm text-center">
            {resendMessage}
          </div>
        )}

        {/* Code Inputs */}
        <div className="mb-6">
          <label className="block mb-3 text-sm font-medium text-gray-700 text-center">
            Wprowadź 6-cyfrowy kod
          </label>
          <div className="flex gap-2 justify-center">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  if (el) inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className="w-12 h-14 text-center text-2xl font-bold text-gray-700 bg-white border-2 border-gray-200 rounded-lg outline-none focus:border-green-500 transition-colors duration-200"
                disabled={isLoading}
              />
            ))}
          </div>
        </div>

        {/* Verify Button */}
        <button
          onClick={() => handleVerify()}
          disabled={isLoading || code.join('').length !== 6}
          className={`w-full py-3 px-4 text-white font-semibold rounded-lg transition-all duration-200 transform mb-6
            ${
              isLoading || code.join('').length !== 6
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0'
            }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Weryfikowanie...</span>
            </div>
          ) : (
            'Zweryfikuj'
          )}
        </button>

        {/* Resend Code */}
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">Nie otrzymałeś kodu?</p>
          <button
            onClick={handleResendCode}
            disabled={resendLoading || resendCooldown > 0}
            className={`text-sm font-semibold transition-colors duration-200
              ${
                resendCooldown > 0 || resendLoading
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-green-600 hover:text-green-700 hover:underline'
              }`}
          >
            {resendLoading
              ? 'Wysyłanie...'
              : resendCooldown > 0
                ? `Wyślij ponownie (${resendCooldown}s)`
                : 'Wyślij ponownie'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Weryfikacja() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-200 via-green-300 to-emerald-400">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      }
    >
      <VerificationContent />
    </Suspense>
  );
}
