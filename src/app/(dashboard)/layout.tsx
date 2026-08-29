'use client';

import './dashboard/dashboard-theme.css';
import DashboardHeader from './dashboard/Header/DashboardHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardHeader />
      <main>{children}</main>
    </>
  );
}
