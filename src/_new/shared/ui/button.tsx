/**
 * KOMPONENT BUTTON
 * 
 * Uniwersalny przycisk, który obsługuje różne warianty stylów, rozmiary oraz stany ładowania.
 * Dzięki niemu można łatwo tworzyć spójne i dostępne przyciski w całej aplikacji, bez konieczności powtarzania kodu CSS.
 * Zapobiega duplikacji kodu i zapewnia jednolity wygląd interfejsu użytkownika.
 * 
 * UWAGA:
 * Można nadpisywać style przycisku za pomocą propsa className, 
 * ale należy ograniczać, aby utrzymać spójność designu.
 * Jeżeli wprowadzać zmiany to najlepiej globalnie tutaj lub dodać tu nowy wariant, jeżeli nowy przycisk.
*/

'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@new/lib/utils';

// Warianty designu
const buttonVariants = cva(
  [
    // Style ogólne wspólne dla wszystkich przycisków
    'inline-flex items-center justify-center gap-2',
    'font-light',
    'rounded-lg',
    'transition-all duration-200',
    'cursor-pointer',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ],
  {
    variants: {
      // Określają kolor i styl waraiantu przycisku
      variant: {
        // czarny przycisk w auth (MOŻNA DODAĆ PO PROSTU NOWY TYP)
        dark: [
          'bg-gray-900 text-white',
          'hover:bg-gray-800',
          'focus:ring-gray-400',
          'hover-shine',
        ],
        // zielony przycisk główny w dashboard
        primary: [
          'bg-green-600 text-white',
          'hover:bg-green-700',
          'focus-visible:ring-green-600',
        ],
        // szary przycisk drugorzędny (anuluj, zamknij, ikony)
        secondary: [
          'bg-transparent text-gray-700',
          'hover:bg-gray-200',
          'focus-visible:ring-gray-500',
        ],
        // Outline (dla Google button)
        outline: [
          'bg-white text-gray-700',
          'border-2 border-gray-300',
          'hover:bg-gray-50 hover:border-gray-400',
          'focus:ring-gray-400',
          'hover-shine',
        ],
        // czerwony przycisk (usuwanie)
        destructive: [
          'bg-red-600 text-white',
          'hover:bg-red-700',
          'focus:ring-red-400',
        ],
        // sam tekst bez tła (linki, akcje w tekście)
        link: [
          'bg-transparent text-green-600 underline-offset-4',
          'hover:underline',
          'focus-visible:ring-green-600',
          'shadow-none',
        ],
      },
      // Rozmiar przycisku, który wpływa na padding, wysokość i rozmiar tekstu
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-11 px-6 text-lg',
        icon: 'h-10 w-10 p-0',
        iconSm: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

// Dodatkowe propsy
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// Komponent ===============================
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <LoadingSpinner size={size} />
        ) : leftIcon ? (
          <span className="shrink-0">{leftIcon}</span>
        ) : null}

        {children && <span className="truncate">{children}</span>}

        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Loading spinner
function LoadingSpinner({ size }: { size?: ButtonProps['size'] }) {
  const spinnerSize = size === 'iconSm' ? 'w-4 h-4' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

  return (
    <svg
      className={cn(spinnerSize, 'animate-spin')}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}


export { Button, buttonVariants };
