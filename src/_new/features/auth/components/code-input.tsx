/**
 * CODE INPUT COMPONENT
 * 
 * Reusable 6-digit code input UI
 * Używany w:
 * - Email verification
 * - Password reset (step 2)
 * - 2FA verification (przyszłość)
 */

'use client';

import { Button } from '@new/shared/ui/button';
import { useCodeInput } from '../hooks/use-code-input';

interface CodeInputProps {
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  label?: string;
  verifyButtonText?: string;
  resendButtonText?: string;
  disabled?: boolean;
}

export function CodeInput({
  onVerify,
  onResend,
  label = 'Wprowadź 6-cyfrowy kod',
  verifyButtonText = 'Zweryfikuj kod',
  resendButtonText = 'Wyślij kod ponownie',
  disabled = false,
}: CodeInputProps) {
  const {
    code,
    inputRefs,
    isLoading,
    error,
    resendCooldown,
    resendMessage,
    handleChange,
    handleKeyDown,
    handlePaste,
    handleVerify,
    handleResend,
    isComplete,
  } = useCodeInput({
    onVerify,
    onResend,
    autoFocus: true,
  });

  return (
    <div className="space-y-6">
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 text-center">
          {label}
        </label>
      )}

      {/* 6-digit inputs */}
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
            disabled={isLoading || disabled}
            className={`w-12 h-14 text-center text-2xl font-bold text-gray-800 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm text-center font-light">
          {error}
        </div>
      )}

      {/* Success message */}
      {resendMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm text-center font-light">
          {resendMessage}
        </div>
      )}

      {/* Resend button */}
      <div className="text-center">
        <Button
          variant="link"
          onClick={handleResend}
          disabled={resendCooldown > 0 || isLoading || disabled}
          className="text-sm"
        >
          {resendCooldown > 0
            ? `Wyślij ponownie za ${resendCooldown}s`
            : resendButtonText}
        </Button>
      </div>

      {/* Verify button */}
      <Button
        onClick={() => handleVerify()}
        disabled={!isComplete() || disabled}
        loading={isLoading}
        className="w-full"
      >
        {isLoading ? 'Weryfikacja...' : verifyButtonText}
      </Button>
    </div>
  );
}