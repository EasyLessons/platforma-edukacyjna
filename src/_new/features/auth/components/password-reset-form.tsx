'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { requestPasswordReset, verifyResetCode } from '../api/auth-api';

import { Input } from '@/_new/shared/ui/input';
import { Button } from '@/_new/shared/ui/button';
import { CodeInput } from './code-input';
import { usePasswordReset } from '../hooks/use-password-reset';

export function PasswordResetForm() {
  const {
    step,
    setStep,
    // Step 1
    email,
    handleEmailChange,
    handleSendEmail,
    emailLoading,
    emailError,
    //Step 2
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
  } = usePasswordReset();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div>
      {/* STEP 1: EMAIL */}
      {step === 'email' && (
        <form onSubmit={handleSendEmail} className="space-y-3">
          <Input
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="Email"
            error={emailError}
          />

          <Button type="submit" variant="dark" loading={emailLoading} className="w-full">
            {emailLoading ? 'Wysyłanie...' : 'Wyślij kod'}
          </Button>
        </form>
      )}

      {/* STEP 2: CODE */}
      {step === 'code' && (
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* 6-digit code inputs */}
          <CodeInput
            onVerify={handleCodeVerified}
            onResend={handleCodeResend}
          />

          {/* Helper text */}
          <p className="text-xs text-gray-500 text-center mt-4 font-light">
            Nie otrzymałeś kodu? Sprawdź folder spam.
          </p>
        </div>
      )}

      {/* STEP 3: PASSWORD */}
      {step === 'password' && (
        <form onSubmit={handleResetPassword} className="space-y-3">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            placeholder="Nowe hasło"
            rightIcon={showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            onRightIconClick={() => setShowPassword(!showPassword)}
            helperText="Min. 8 znaków, wielka i mała litera, cyfra"
            error={passwordError}
          />

          <Input
            type={showConfirmPassword ? 'text' : 'password'}
            value={passwordConfirm}
            onChange={(e) => handlePasswordConfirmChange(e.target.value)}
            placeholder="Powtórz hasło"
            rightIcon={
              showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />
            }
            onRightIconClick={() => setShowConfirmPassword(!showConfirmPassword)}
          />

          <Button type="submit" variant="dark" loading={passwordLoading} className="w-full">
            {passwordLoading ? 'Zmiana hasła...' : 'Zmień hasło'}
          </Button>
        </form>
      )}
    </div>
  );
}
