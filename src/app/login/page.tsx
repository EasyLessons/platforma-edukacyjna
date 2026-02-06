'use client';
import { loginUser, saveToken, saveUser } from '@/auth_api/api';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/_new/shared/ui/button';
import { Input } from '@/_new/shared/ui/input';

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();

  // State management
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');

  // Email validation
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error when user starts typing
    setErrors((prev) => ({
      ...prev,
      [name]: '',
    }));
    setGeneralError('');
  };

  // Form validation
  const validateForm = () => {
    let isValid = true;
    const newErrors = { email: '', password: '' };

    if (!formData.email) {
      newErrors.email = 'Email jest wymagany';
      isValid = false;
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Nieprawidłowy format email';
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = 'Hasło jest wymagane';
      isValid = false;
    } else if (formData.password.length < 6) {
      newErrors.password = 'Hasło musi mieć co najmniej 6 znaków';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError('');

    try {
      console.log('🔐 Próba logowania...');

      // Krok 1: Wywołaj API logowania
      const response = await loginUser({
        login: formData.email,
        password: formData.password,
      });

      console.log('✅ Odpowiedź z API:', response);

      login(response.access_token, response.user);

      console.log('✅ Login z Context wywołany! isLoggedIn powinien być true');

      // Krok 3: Przekieruj do dashboard
      router.push('/dashboard');
    } catch (error: any) {
      setIsLoading(false);

      console.error('❌ Błąd logowania:', error);

      // Obsługa błędów z backendu
      if (error.message.includes('niezweryfikowane')) {
        console.log('⚠️ Konto niezweryfikowane - wysyłam nowy kod...');

        try {
          const checkResponse = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/check-user`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: formData.email }),
            }
          );

          const checkData = await checkResponse.json();

          if (!checkData.verified && checkData.user_id) {
            console.log('📧 Redirect do weryfikacji');
            router.push(
              `/weryfikacja?userId=${checkData.user_id}&email=${encodeURIComponent(formData.email)}`
            );
          } else {
            setGeneralError('⚠️ Konto niezweryfikowane. Sprawdź email.');
          }
        } catch (checkError) {
          setGeneralError('⚠️ Konto niezweryfikowane. Sprawdź email lub zarejestruj się ponownie.');
        }
      } else {
        setGeneralError(error.message || 'Błędny email lub hasło');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-200 via-green-300 to-emerald-400 p-5">
      {/* Logo/Brand Section */}
      <div className="mb-8 text-center">
        <h2 className="text-white text-2xl font-semibold">Witaj ponownie!</h2>
      </div>

      {/* Login Form */}
      <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Zaloguj się</h1>

        <p className="text-center text-gray-600 mb-6">Zaloguj się, aby kontynuować</p>

        {/* General Error Message */}
        {generalError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
            {generalError}
          </div>
        )}

        {/* Email Input */}
        <Input
          label="Email"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="email@example.com"
          leftIcon={<Mail className="w-5 h-5" />}
          error={errors.email}
          wrapperClassName="mb-4"
        />

        {/* Password Input */}
        <div className="mb-6">
          <Input
            label="Hasło"
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            leftIcon={<Lock className="w-5 h-5" />}
            rightIcon={showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            onRightIconClick={() => setShowPassword(!showPassword)}
            error={errors.password}
          />

          {/* Forgot Password Link */}
          <div className="mt-2 text-right">
            <Link
              href="/odzyskiwanie-hasla"
              className="text-sm text-green-600 hover:text-green-700 font-medium hover:underline transition-colors duration-200"
            >
              Zapomniałeś hasła?
            </Link>
          </div>
        </div>

        {/* Login Button */}
        <Button type="submit" loading={isLoading} className="w-full mb-5">
          {isLoading ? 'Logowanie...' : 'Zaloguj'}
        </Button>

        {/* Sign Up Link */}
        <div className="text-center text-gray-600">
          Nie masz konta?{' '}
          <Link href="/rejestracja">
            <Button variant="link">Zarejestruj się</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
