'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { createDemoSessionId } from './guest-identity';

interface DemoCtaButtonProps {
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}

/**
 * Przycisk "Wyprobuj demo" - losuje nowy identyfikator sesji i przenosi
 * na /demo/<sessionId>. Identyfikator powstaje dopiero po kliknieciu,
 * zeby nie bylo roznicy miedzy HTML z serwera a tym, co widzi przegladarka.
 */
export default function DemoCtaButton({ className, children, ariaLabel }: DemoCtaButtonProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleClick = useCallback(() => {
    if (isNavigating) return;
    setIsNavigating(true);
    router.push(`/demo/${createDemoSessionId()}`);
  }, [isNavigating, router]);

  return (
    <button type="button" onClick={handleClick} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
