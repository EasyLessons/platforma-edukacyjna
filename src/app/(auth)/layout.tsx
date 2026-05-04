import Link from 'next/link';
import Image from 'next/image';
import { LanguageSwitcher } from '@/_new/shared/ui/language-switcher';

export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen sm:h-screen flex flex-col relative overflow-x-hidden overflow-y-auto sm:overflow-hidden bg-white">
      {/* Gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-64 -left-64 w-[1200px] h-[1200px] rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              'radial-gradient(circle, rgba(134,239,172,0.6) 0%, rgba(134,239,172,0) 70%)',
          }}
        />
        <div
          className="absolute -top-80 -right-80 w-[1100px] h-[1100px] rounded-full opacity-40 blur-[120px]"
          style={{
            background:
              'radial-gradient(circle, rgba(147,197,253,0.9) 0%, rgba(147,197,253,0) 70%)',
          }}
        />
        <div
          className="absolute -bottom-100 -left-100 w-[1000px] h-[1000px] rounded-full opacity-35 blur-[120px]"
          style={{
            background: 'radial-gradient(circle, rgba(253,224,71,0.1) 0%, rgba(253,224,71,0) 70%)',
          }}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-6 py-4">
        <Link href="/">
          <Image
            src="/resources/LogoEasyLesson.webp"
            alt="EasyLesson"
            width={140}
            height={42}
            className="h-9 w-auto"
          />
        </Link>
        <LanguageSwitcher />
      </div>

      {/* Wycentrowana zawartość strony */}
      <div className="relative z-10 flex-1 flex items-center justify-center py-8 sm:py-0">
        <main className="w-full max-w-md px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
