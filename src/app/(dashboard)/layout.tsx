'use client';

import './dashboard/dashboard-theme.css';
import { DashboardHeader } from '@/_new/features/dashboard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardHeader />
      <main>{children}</main>
    </>
  );
}
