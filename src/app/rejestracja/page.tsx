'use client';
import { registerUser } from '@/auth_api/api';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock, Mail, User, X } from 'lucide-react';
import Link from 'next/link';

export default function Register() {
  const router = useRouter();

  // State management
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({
    fullName: '',
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
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    };

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Login jest wymagany';
      isValid = false;
    } else if (formData.fullName.trim().length < 3) {
      newErrors.fullName = 'Login musi mieć co najmniej 3 znaki';
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

  // Handle registration - POŁĄCZENIE Z PRAWDZIWYM API
  // Logika:
  // 1. Sprawdza czy email już istnieje
  // 2. Jeśli istnieje ale niezweryfikowany → wysyła nowy kod i redirect do weryfikacji
  // 3. Jeśli nowy → tworzy konto i redirect do weryfikacji
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setGeneralError('');

    try {
      // Wywołanie API rejestracji
      const response = await registerUser({
        username: formData.fullName,
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

          {/* Full Name Input */}
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium text-gray-700">Login</label>
            <div className="relative">
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="User123"
                className={`w-full pl-10 pr-4 py-3 text-gray-700 bg-white border-2 rounded-lg outline-none transition-colors duration-200
                  ${
                    errors.fullName
                      ? 'border-red-500 bg-red-50 focus:border-red-500'
                      : 'border-gray-200 focus:border-green-500'
                  }`}
              />
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <User className="w-5 h-5" />
              </span>
            </div>
            {errors.fullName && (
              <span className="text-red-500 text-xs mt-1 block">{errors.fullName}</span>
            )}
          </div>

          {/* Email Input */}
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium text-gray-700">Email</label>
            <div className="relative">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="nazwa@example.com"
                className={`w-full pl-10 pr-4 py-3 text-gray-700 bg-white border-2 rounded-lg outline-none transition-colors duration-200
                  ${
                    errors.email
                      ? 'border-red-500 bg-red-50 focus:border-red-500'
                      : 'border-gray-200 focus:border-green-500'
                  }`}
              />
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <Mail className="w-5 h-5" />
              </span>
            </div>
            {errors.email && (
              <span className="text-red-500 text-xs mt-1 block">{errors.email}</span>
            )}
          </div>

          {/* Password Input */}
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium text-gray-700">Hasło</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`w-full pl-10 pr-12 py-3 text-gray-700 bg-white border-2 rounded-lg outline-none transition-colors duration-200
                  ${
                    errors.password
                      ? 'border-red-500 bg-red-50 focus:border-red-500'
                      : 'border-gray-200 focus:border-green-500'
                  }`}
              />
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <Lock className="w-5 h-5" />
              </span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
              >
                {showPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && (
              <span className="text-red-500 text-xs mt-1 block">{errors.password}</span>
            )}
          </div>

          {/* Confirm Password Input */}
          <div className="mb-6">
            <label className="block mb-2 text-sm font-medium text-gray-700">Powtórz hasło</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className={`w-full pl-10 pr-12 py-3 text-gray-700 bg-white border-2 rounded-lg outline-none transition-colors duration-200
                  ${
                    errors.confirmPassword
                      ? 'border-red-500 bg-red-50 focus:border-red-500'
                      : 'border-gray-200 focus:border-green-500'
                  }`}
              />
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <Lock className="w-5 h-5" />
              </span>
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                title={showConfirmPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
              >
                {showConfirmPassword ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="text-red-500 text-xs mt-1 block">{errors.confirmPassword}</span>
            )}
          </div>

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
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 px-4 text-white font-semibold rounded-lg transition-all duration-200 transform mb-5
              ${
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0'
              }`}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Rejestrowanie...</span>
              </div>
            ) : (
              'Zarejestruj się'
            )}
          </button>

          {/* Login Link */}
          <div className="text-center text-gray-600">
            Masz już konto?{' '}
            <Link
              href="/login"
              className="text-green-600 font-semibold hover:text-green-700 hover:underline transition-colors duration-200"
            >
              Zaloguj się
            </Link>
          </div>
        </form>
      </div>
    </>
  );
}
