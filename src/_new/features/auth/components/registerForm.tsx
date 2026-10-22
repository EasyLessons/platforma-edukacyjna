'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@new/shared/ui/input';
import { Button } from '@new/shared/ui/button';
import { useRegister } from '../hooks/useRegister';
import { TermsNotice } from './termsNotice';

export function RegisterForm() {
  const { formData, errors, isLoading, generalError, handleChange, handleSubmit } = useRegister();
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
        name="username"
        value={formData.username}
        onChange={handleChange}
        placeholder="Username"
        error={errors.username}
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
        name="password_confirm"
        value={formData.password_confirm}
        onChange={handleChange}
        placeholder="••••••••"
        rightIcon={
          showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />
        }
        onRightIconClick={() => setShowConfirmPassword(!showConfirmPassword)}
        error={errors.password_confirm}
      />

      {/* Submit Button */}
      <Button variant="dark" type="submit" loading={isLoading} className="w-full mb-5">
        Zarejestruj
      </Button>
      <TermsNotice action="Tworząc konto" className="mb-5" />

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
