'use client';

import { useAuth } from '../context/AuthContext';
import Header from '../layout/Header';
import AuthHeader from '../layout/AuthHeader';
import Footer from '../layout/Footer';
import Ad from '../layout/ad';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();

  return (
    <>
      <Ad />
      {isLoggedIn ? <AuthHeader /> : <Header />}
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}