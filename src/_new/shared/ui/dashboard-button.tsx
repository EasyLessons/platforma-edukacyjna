'use client';
/**
 * DashboardButton - przycisk panelu uzytkownika (dashboard, modale board/workspace,
 * panel powiadomien). Przeniesiony z src/app/(dashboard)/dashboard/Components (PR-A3
 * z docs/architecture/REFAKTOR-PLAN.md), zeby src/_new nie importowal z src/app.
 *
 * UWAGA: klasy `dashboard-btn-primary` / `dashboard-btn-secondary` sa zdefiniowane w
 * src/app/(dashboard)/dashboard/dashboard-theme.css - komponent wyglada poprawnie tylko
 * w drzewie, ktore laduje ten arkusz (layout (dashboard)).
 */

import * as React from 'react';
import { cn } from '@new/lib/utils';

type DashboardButtonVariant = 'primary' | 'secondary';

interface DashboardButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DashboardButtonVariant;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const BASE =
  'hover-shine hover:cursor-pointer inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const VARIANTS: Record<DashboardButtonVariant, string> = {
  primary: 'dashboard-btn-primary text-white',
  secondary: 'dashboard-btn-secondary text-black',
};

export function DashboardButton({
  variant = 'secondary',
  className,
  leftIcon,
  rightIcon,
  children,
  ...props
}: DashboardButtonProps) {
  return (
    <button className={cn(BASE, VARIANTS[variant], className)} {...props}>
      {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
      {children ? <span>{children}</span> : null}
      {rightIcon ? <span className="shrink-0">{rightIcon}</span> : null}
    </button>
  );
}
