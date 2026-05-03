import Image from 'next/image';

export default function ProductHero() {
  return (
    <section className="relative w-full h-[35vh] min-h-[250px] overflow-hidden flex items-center justify-center" id="hero">
      {/* Tło Video */}
      <video
        className="absolute inset-0 w-full h-full object-cover scale-[1.15]"
        src="https://pub-9f3b498e57d045a682d3009381570da0.r2.dev/EasylessonherosectionWEBM.webm"
        autoPlay
        muted
        loop
        playsInline
        disablePictureInPicture
        disableRemotePlayback
      />

      {/* Nakładka przyciemniająca video (żeby logo i napis były czytelne) */}
      <div className="absolute inset-0 bg-black/60 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 px-6 max-w-7xl mx-auto text-center mt-6">
        <Image
          src="/resources/LogoEasyLessonWhite.webp"
          alt="EasyLesson Logo"
          width={400}
          height={100}
          className="mx-auto w-64 md:w-80 lg:w-[400px] h-auto mb-6 drop-shadow-lg"
          priority
        />
        <p className="text-base md:text-xl text-gray-200 max-w-2xl mx-auto font-bold drop-shadow">
          Poznaj innowacyjną platformę edukacyjną, która łączy zaawansowany system zarządzania (Dashboard) z interaktywną przestrzenią do nauki (Tutoring Board).
        </p>
      </div>
    </section>
  );
}