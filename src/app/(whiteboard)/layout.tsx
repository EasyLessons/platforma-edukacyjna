import type { Viewport } from 'next';

/**
 * `viewport-fit=cover` wlacza env(safe-area-inset-*) na iOS (wyciecie, pasek
 * home). Tylko w tej grupie tras: tablica i demo rozciagaja sie na caly ekran
 * i same odsuwaja kontrolki od krawedzi; reszta aplikacji zostaje bez zmian.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function WhiteboardLayout({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
