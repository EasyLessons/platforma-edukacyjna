import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F6F6F6] flex flex-col items-center justify-center p-6 relative">
      <div className="absolute inset-0 flex place-content-center items-center justify-center opacity-[0.03] pointer-events-none select-none">
        <span className="text-[30vw] font-black tracking-tighter leading-none">404</span>
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-xl mx-auto">
        <Link href="/" className="mb-12 inline-block transition-opacity hover:opacity-80">
          <Image
            src="/resources/LogoEasyLesson.webp"
            alt="EasyLesson Logo"
            width={180}
            height={45}
            priority
            className="h-8 w-auto"
          />
        </Link>
        
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#212224] mb-4">
          Strona nie istnieje
        </h1>
        
        <p className="text-base md:text-lg text-gray-500 mb-10 font-normal">
          Przepraszamy, ale nie mogliśmy znaleźć strony, której szukasz. Została usunięta lub podany adres jest nieprawidłowy.
        </p>

        <Link 
          href="/" 
          className="inline-flex items-center justify-center bg-[#212224] text-white px-8 py-3 rounded-full text-base font-medium transition-all hover:bg-black hover:scale-105 active:scale-95 shadow-sm"
        >
          Wróć na stronę główną
        </Link>
      </div>
    </div>
  );
}
