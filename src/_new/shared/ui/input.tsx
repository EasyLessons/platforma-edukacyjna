/**
 * KOMPONENT INPUT
 * 
 * Uniwersalny input, który obsługuje różne warianty stylów, rozmiary oraz stany walidacji.
 * Dzięki niemu można łatwo tworzyć spójne i dostępne pola wejścia w całej aplikacji, bez konieczności powtarzania kodu CSS.
 * Zapobiega duplikacji kodu i zapewnia jednolity wygląd interfejsu użytkownika.
 * 
 * UWAGA:
 * Można nadpisywać style za pomocą propsa className, 
 * ale należy unikać to ograniczać aby utrzymać spójność systemu designu.
 * Jeżeli wprowadzać zmiany to najlepiej globalnie tutaj lub dodać tu nowy wariant.
*/

'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@new/lib/utils';

// Warianty designu
const inputVariants = cva(
  [
    'w-full',
    'px-4 py-3',
    'text-gray-900 placeholder:text-gray-400',
    'bg-white',
    'border-2 rounded-lg',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2',
    'disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      // Stan walidacji
      state: {
        default: ['border-gray-200', 'focus:border-green-500 focus:ring-green-100'],
        error: ['border-red-500 bg-red-50', 'focus:border-red-500 focus:ring-red-100'],
        success: ['border-green-500 bg-green-50', 'focus:border-green-500 focus:ring-green-100'],
      },
      // Rozmiar
      size: {
        sm: 'h-9 px-3 py-3 text-sm',
        md: 'h-10 px-4 py-6 text-base',
        lg: 'h-11 px-5 py-8 text-lg',
      },
    },
    defaultVariants: {
      state: 'default',
      size: 'md',
    },
  }
);

// Dodatkowe propsy
export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
  wrapperClassName?: string;
}

// Komponent ===============================
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      state: stateProp,
      size,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      onRightIconClick,
      wrapperClassName,
      disabled,
      ...props
    },
    ref
  ) => {
    const state = error ? 'error' : stateProp;

    return (
      <div className={cn('w-full', wrapperClassName)}>
        {/* Label */}
        {label && <label className="block mb-2 text-sm font-medium text-gray-700">{label}</label>}

        {/* Input wrapper */}
        <div className="relative">
          {/* Left icon */}
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}
          {/* Input */}
          <input
            ref={ref}
            disabled={disabled}
            className={cn(
              inputVariants({ state, size }),
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />
          {/* Right icon */}
          {rightIcon && (
            <button
              type="button"
              onClick={onRightIconClick}
              disabled={disabled}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              tabIndex={-1}
            >
              {rightIcon}
            </button>
          )}
        </div>

        {/* Error message */}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

        {/* Helper text */}
        {!error && helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input, inputVariants };
