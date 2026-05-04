interface NewsletterSectionProps {
  title: string;
  description: string;
  variant?: 'light' | 'dark';
}

export default function NewsletterSection({
  title,
  description,
  variant = 'light',
}: NewsletterSectionProps) {
  const isDark = variant === 'dark';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
      <div className="lg:col-span-5">
        <h3
          className={`text-2xl italic mb-2 ${isDark ? 'text-[#F3F4F6]' : 'text-gray-900'}`}
          style={{ fontFamily: 'var(--font-playfair)' }}
        >
          {title}
        </h3>
        <p className={`text-sm leading-relaxed ${isDark ? 'text-[#B6B8BE]' : 'text-gray-600'}`}>
          {description}
        </p>
      </div>

      <div className="lg:col-span-7">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Imię"
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 ${
              isDark
                ? 'text-[#F9FAFB] placeholder-[#8F939C] border border-[#343A45]'
                : 'border border-gray-300 text-gray-900 placeholder-gray-400'
            }`}
            style={isDark ? { backgroundColor: '#1F232B' } : undefined}
          />
          <input
            type="email"
            placeholder="Adres e-mail"
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 ${
              isDark
                ? 'text-[#F9FAFB] placeholder-[#8F939C] border border-[#343A45]'
                : 'border border-gray-300 text-gray-900 placeholder-gray-400'
            }`}
            style={isDark ? { backgroundColor: '#1F232B' } : undefined}
          />
          <button
            className={`px-6 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
              isDark ? '' : 'hover-shine hover:cursor-pointer text-white'
            }`}
            style={
              isDark
                ? { backgroundColor: '#ffffff', color: '#032515' }
                : { backgroundColor: '#212224' }
            }
          >
            Subskrybuj
          </button>
        </div>

        <div className="flex items-start gap-2 mt-3">
          <input
            type="checkbox"
            id="newsletter-privacy"
            className="mt-0.5 cursor-pointer"
          />
          <label
            htmlFor="newsletter-privacy"
            className={`text-xs cursor-pointer ${isDark ? 'text-[#AEB2BC]' : 'text-gray-600'}`}
          >
            Akceptuję{' '}
            <a
              href="#"
              className={isDark ? 'text-[#ffffff] hover:underline' : 'text-blue-600 hover:underline'}
            >
              politykę prywatności
            </a>{' '}
            i wyrażam zgodę na otrzymywanie informacji handlowych
          </label>
        </div>
      </div>
    </div>
  );
}
