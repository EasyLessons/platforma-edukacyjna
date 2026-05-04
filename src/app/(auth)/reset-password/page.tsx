import { PasswordResetForm } from '@/_new/features/auth/components/passwordResetForm';
import Link from 'next/link';

export default function Page() {
  return (
    <>
      <h2 className="text-2xl font-light text-gray-900 text-center mb-6">Odzyskiwanie hasła</h2>
      <PasswordResetForm />
      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-sm text-gray-600 font-light hover:text-gray-900 hover:underline transition-colors"
        >
          Powrót do logowania
        </Link>
      </div>
    </>
  );
}
