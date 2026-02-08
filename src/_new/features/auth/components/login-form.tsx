'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

import { Input } from '@new/shared/ui/input';
import { Button } from '@new/shared/ui/button';
import { useLogin } from '../hooks/use-login';

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const { formData, errors, isLoading, handleChange, handleSubmit } = useLogin();

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
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
      <div className="text-center pt-2">
        <Link
          href="/odzyskiwanie-hasla"
          className="hover-shine text-sm text-blue-600 font-light hover:text-blue-700 hover:underline transition-colors hover:cursor-pointer"
        >
          Zapomniałeś hasła?
        </Link>
      </div>
    </form>
  );
}
