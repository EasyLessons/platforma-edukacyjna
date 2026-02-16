'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@new/shared/ui/input';
import { Button } from '@new/shared/ui/button';
import { useRegister } from '../hooks/use-register';

export function RegisterForm() {
  const {
    formData,
    errors,
    isLoading,
    generalError,
    acceptTerms,
    handleChange,
    handleTermsChange,
    handleSubmit,
  } = useRegister();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* General Error */}
      {generalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center font-light">
          {generalError}
        </div>
      )}

      {/* Login Input */}
      <Input
        type="text"
        name="login"
        value={formData.login}
        onChange={handleChange}
        placeholder="Login"
        error={errors.login}
      />

      {/* Email Input */}
      <Input
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="Email"
        error={errors.email}
      />

      {/* Password Input */}
      <Input
        type={showPassword ? 'text' : 'password'}
        name="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="••••••••"
        rightIcon={showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
        onRightIconClick={() => setShowPassword(!showPassword)}
        error={errors.password}
      />

      {/* Confirm Password Input */}
      <Input
        type={showConfirmPassword ? 'text' : 'password'}
        name="confirmPassword"
        value={formData.confirmPassword}
        onChange={handleChange}
        placeholder="••••••••"
        rightIcon={
          showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />
        }
        onRightIconClick={() => setShowConfirmPassword(!showConfirmPassword)}
        error={errors.confirmPassword}
      />

      {/* Terms Checkbox */}
      <label className="flex items-start gap-3 cursor-pointer group py-3">
        <input
          type="checkbox"
          checked={acceptTerms}
          onChange={(e) => handleTermsChange(e.target.checked)}
          className="mt-1 w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-2 focus:ring-gray-400"
        />
        <span className="text-sm text-gray-600 font-light">
          Akceptuję{' '}
          <Link
            href="/regulamin"
            className="text-blue-600 hover:text-blue-700 hover:underline"
            target="_blank"
          >
            regulamin
          </Link>{' '}
          i{' '}
          <Link
            href="/polityka-prywatnosci"
            className="text-blue-600 hover:text-blue-700 hover:underline"
            target="_blank"
          >
            politykę prywatności
          </Link>
        </span>
      </label>

      {/* Submit Button */}
      <Button variant="dark" type="submit" loading={isLoading} className="w-full mb-5">
        Zarejestruj
      </Button>

      {/* Masz już konto */}
      <p className="py-5 text-center text-gray-600 font-light mb-8">
        Masz już konto?{' '}
        <Link
          href="/login"
          className="text-blue-600 font-normal hover:text-blue-700 hover:underline hover:cursor-pointer"
        >
          Zaloguj się
        </Link>
      </p>
    </form>
  );
}
