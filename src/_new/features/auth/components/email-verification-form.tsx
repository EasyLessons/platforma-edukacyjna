'use client';

import { Mail } from 'lucide-react';
import { CodeInput } from './code-input';
import { useRouter } from 'next/navigation';
import { verifyEmail, resendVerificationCode } from '../api/auth-api';

type EmailVerificationFormProps = {
  userId: string;
  email: string;
};

export function EmailVerificationForm({ 
  userId, 
  email 
}: EmailVerificationFormProps) {
  const router = useRouter();

  if (!userId || !email) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      {/* Icon */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-green-600" />
        </div>
      </div>

      <CodeInput
        onVerify={async (code) => {
          await verifyEmail({
            user_id: parseInt(userId),
            code,
          });
          router.push('/login?verified=true');
        }}
        onResend={async () => {
          await resendVerificationCode({
            user_id: parseInt(userId),
            email: email,
          });
        }}
        label="Wprowadź 6-cyfrowy kod"
        verifyButtonText="Zweryfikuj"
      />

      {/* Helper text */}
      <p className="text-xs text-gray-500 text-center mt-4 font-light">
        Nie otrzymałeś kodu? Sprawdź folder spam.
      </p>
    </div>
  );
}
