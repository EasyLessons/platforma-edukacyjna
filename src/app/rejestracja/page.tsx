'use client';
import { registerUser } from '@/auth_api/api';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, Mail, User, X } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/_new/shared/ui/button';
import { Input } from '@/_new/shared/ui/input';

export default function Register() {
  const router = useRouter();

  // State management
  const [formData, setFormData] = useState({
    login: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({
    login: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Verification modal state
  const [generatedCode, setGeneratedCode] = useState('');

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
    const newErrors = {
      login: '',
      email: '',
      password: '',
      confirmPassword: '',
    };

    if (!formData.login.trim()) {
      newErrors.login = 'Login jest wymagany';
      isValid = false;
    } else if (formData.login.trim().length < 3) {
      newErrors.login = 'Login musi mieć co najmniej 3 znaki';
      isValid = false;
    }

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
    } else if (formData.password.length < 8) {
      newErrors.password = 'Hasło musi mieć co najmniej 8 znaków';
      isValid = false;
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Hasło musi zawierać małą i wielką literę oraz cyfrę';
      isValid = false;
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Potwierdzenie hasła jest wymagane';
      isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Hasła nie są identyczne';
      isValid = false;
    }

    if (!acceptTerms) {
      setGeneralError('Musisz zaakceptować regulamin');
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError('');

    try {
      // Wywołanie API rejestracji
      const response = await registerUser({
        username: formData.login,
        email: formData.email,
        password: formData.password,
        password_confirm: formData.confirmPassword,
      });

      console.log('✅ Użytkownik zarejestrowany! ID:', response.user.id);
      console.log('📧 Kod wysłany na email:', formData.email);

      // Redirect do weryfikacji
      router.push(
        `/weryfikacja?userId=${response.user.id}&email=${encodeURIComponent(formData.email)}`
      );
    } catch (error: any) {
      setIsLoading(false);

      // Sprawdź czy to błąd "email zajęty"
      if (error.message.includes('Email zajęty')) {
        // Email istnieje - sprawdź czy zweryfikowany
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

          if (checkData.verified) {
            // Konto zweryfikowane - każ się zalogować
            setGeneralError('To konto już istnieje. Przejdź do logowania.');
          } else {
            // Konto niezweryfikowane - wysłano nowy kod
            console.log('📧 Konto istnieje ale niezweryfikowane. Nowy kod wysłany.');
            router.push(
              `/weryfikacja?userId=${checkData.user_id}&email=${encodeURIComponent(formData.email)}`
            );
          }
        } catch (checkError) {
          setGeneralError('Email już zajęty');
        }
      } else {
        setGeneralError(error.message || 'Błąd rejestracji');
      }

      console.error('❌ Błąd rejestracji:', error);
    }
  };

  return (
    <>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-200 via-green-300 to-emerald-400 p-5">
        {/* Logo/Brand Section */}
        <div className="mb-8 text-center">
          <h2 className="text-white text-2xl font-semibold">Dołącz do nas!</h2>
        </div>

        {/* Registration Form */}
        <form
          onSubmit={handleRegister}
          className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md"
        >
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Zarejestruj się</h1>

          <p className="text-center text-gray-600 mb-6">Utwórz nowe konto</p>

          {/* General Error Message */}
          {generalError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
              {generalError}
            </div>
          )}

          {/* Login Input */}
          <Input 
            label='Login'
            type='text'
            name='login'
            value={formData.login}
            onChange={handleChange}
            placeholder='User123'
            leftIcon={<User className="w-5 h-5" />}
            error={errors.login}
            wrapperClassName="mb-4"
          />

          {/* Email Input */}
          <Input 
            label='Email'
            type='email'
            name='email'
            value={formData.email}
            onChange={handleChange}
            placeholder='email@example.com'
            leftIcon={<Mail className="w-5 h-5" />}
            error={errors.email}
            wrapperClassName="mb-4"
          />

          {/* Password Input */}
          <Input 
            label='Hasło'
            type={showPassword ? 'text' : 'password'}
            name='password'
            value={formData.password}
            onChange={handleChange}
            placeholder='••••••••'
            leftIcon={<Lock className="w-5 h-5" />}
            rightIcon={showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            onRightIconClick={() => setShowPassword(!showPassword)}
            error={errors.password}
            wrapperClassName="mb-4"
          />

          {/* Confirm Password Input */}
          <Input 
            label='Powtórz hasło'
            type={showConfirmPassword ? 'text' : 'password'}
            name='confirmPassword'
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder='••••••••'
            leftIcon={<Lock className="w-5 h-5" />}
            rightIcon={showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            onRightIconClick={() => setShowConfirmPassword(!showConfirmPassword)}
            error={errors.confirmPassword}
            wrapperClassName="mb-4"
          />

          {/* Terms & Conditions Checkbox */}
          <div className="mb-6">
            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAcceptTerms(e.target.checked)
                }
                className="w-4 h-4 text-green-500 bg-white border-gray-300 rounded focus:ring-green-500 focus:ring-2 cursor-pointer mt-0.5"
              />
              <span className="ml-2 text-sm text-gray-600">
                Akceptuję{' '}
                <a
                  href="/regulamin"
                  className="text-green-600 hover:text-green-700 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  regulamin
                </a>{' '}
                i{' '}
                <a
                  href="/polityka-prywatnosci"
                  className="text-green-600 hover:text-green-700 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  politykę prywatności
                </a>
              </span>
            </label>
          </div>

          {/* Register Button */}
          <Button type="submit" loading={isLoading} className="w-full mb-5">
            {isLoading ? 'Rejestrowanie...' : 'Zarejestruj się'}
          </Button>

          {/* Login Link */}
          <div className="text-center text-gray-600">
            Masz już konto?{' '}
            <Link href="/login">
                <Button variant="link">Zaloguj się</Button>
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
