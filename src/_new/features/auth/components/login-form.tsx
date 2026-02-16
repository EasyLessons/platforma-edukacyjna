'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@new/shared/ui/input';
import { Button } from '@new/shared/ui/button';
import { useLogin } from '../hooks/use-login';

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const { formData, errors, isLoading, generalError, handleChange, handleSubmit } = useLogin();

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* General Error */}
      {generalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center font-light">
          {generalError}
        </div>
      )}

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

      {/* Submit Button */}
      <Button variant="dark" type="submit" loading={isLoading} className="w-full mb-5">
        {isLoading ? 'Logowanie...' : 'Zaloguj'}
      </Button>

      {/* Forgot Password Link */}
      <div className="text-right">
        <Link
          href="/odzyskiwanie-hasla"
          className="hover-shine text-sm text-blue-600 font-light hover:text-blue-700 hover:underline transition-colors hover:cursor-pointer"
        >
          Zapomniałeś hasła?
        </Link>
      </div>

      {/* Nie masz konta */}
      <p className="text-center text-gray-600 font-light mt-5">
        Nie masz konta?{' '}
        <Link
          href="/rejestracja"
          className="hover-shine text-blue-600 font-normal hover:text-blue-700 hover:underline transition-colors hover:cursor-pointer"
        >
          Zarejestruj się
        </Link>
      </p>
    </form>
  );
}
