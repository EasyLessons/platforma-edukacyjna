import Link from 'next/link';
import Image from 'next/image';

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F6F6F6]">
      <div className="max-w-4xl mx-auto px-6 pt-8 pb-4">
        <Link href="/">
          <Image
            src="/resources/LogoEasyLesson.webp"
            alt="EasyLesson"
            width={160}
            height={48}
            className="h-10 w-auto"
          />
        </Link>
      </div>
      {children}
    </div>
  );
}