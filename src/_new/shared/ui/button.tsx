'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@new/lib/utils';

const buttonVariants = cva(
    [
        // Style ogólne wspólne dla wszystkich przycisków
        'inline-flex items-center justify-center gap-2',
        'font-medium',
        'rounded-xl',
        'transition-all duration-200',
        'cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
    ],
    {
        variants: {
            // Określają kolor i styl waraiantu przycisku
            variant: {
                // zielony przycisk główny
                primary: [ 
                    'bg-green-600 text-white',
                    'hover:bg-green-700',
                    'focus-visible:ring-green-600',
                    'shadow-sm hover:shadow-md',
                    'disabled:bg-gray-300 disabled:shadow-none',
                ],
                // szary przycisk drugorzędny (anuluj, zamknij, ikony)
                secondary: [
                    'bg-transparent text-gray-700',
                    'hover:bg-gray-100 hover:text-gray-600',
                    'focus-visible:ring-gray-500',
                ],
                // czerwony przycisk (usuwanie)
                destructive: [
                    'bg-red-500 text-red-50',
                    'hover:bg-red-600',
                    'focus-visible:ring-red-600',
                    'shadow-sm hover:shadow-md',
                    'disabled:bg-red-400',
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
                md: 'h-10 px-4 md:px-5 py-2.5 text-base',
                lg: 'h-11 px-6 md:px-8 py-4 text-lg',
                icon: 'h-10 w-10 p-0',
                iconSm: 'h-7 w-7 p-0',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;   
}

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
