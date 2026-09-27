'use client';

import './dashboard/dashboard-theme.css';
import { DashboardHeader } from '@/_new/features/dashboard';
import { usePrewarmWhiteboardSync } from '@/_new/features/whiteboard/yjs/prewarm-sync';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Budzi uśpiony whiteboard-sync (Render Free), zanim użytkownik otworzy tablicę.
  usePrewarmWhiteboardSync();

  return (
    <>
      <DashboardHeader />
      <main>{children}</main>
    </>
  );
}
