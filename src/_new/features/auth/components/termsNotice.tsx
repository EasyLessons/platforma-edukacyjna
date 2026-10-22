import Link from 'next/link';

const LINK_CLASS = 'text-blue-600 hover:text-blue-700 hover:underline';

interface TermsNoticeProps {
  action: string;
  className?: string;
}

/**
 * Informacja pod przyciskiem zakładającym konto: założenie konta jest jednoczesną akceptacją regulaminu.
 * Polityka prywatności to odnośnik informacyjny.
 */
export function TermsNotice({ action, className = '' }: TermsNoticeProps) {
  return (
    <p className={`text-xs text-gray-500 font-light text-center ${className}`}>
      {action}, akceptujesz{' '}
      <Link href="/terms" target="_blank" className={LINK_CLASS}>
        regulamin
      </Link>
      . Informacje o tym, jak przetwarzamy dane, znajdziesz w{' '}
      <Link href="/privacy-policy" target="_blank" className={LINK_CLASS}>
        polityce prywatności
      </Link>
      .
    </p>
  );
}
