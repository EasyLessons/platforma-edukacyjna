'use client';
import { useEffect } from 'react';
import { Globe } from 'lucide-react';

export function LanguageSwitcher({ className }: { className?: string }) {
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value;
    const domain = window.location.hostname;
    const cookieValue = lang === 'pl' ? '/pl/pl' : `/pl/${lang}`;
    document.cookie = `googtrans=${cookieValue}; path=/; domain=${domain};`;
    document.cookie = `googtrans=${cookieValue}; path=/; domain=.${domain};`;
    document.cookie = `googtrans=${cookieValue}; path=/;`;
    window.location.reload();
  };

  useEffect(() => {
    const googtrans = document.cookie.split(';').find((c) => c.trim().startsWith('googtrans='));
    if (googtrans) {
      const lang = googtrans.split('/').pop() || 'pl';
      const select = document.getElementById('lang-select') as HTMLSelectElement;
      if (select) select.value = lang;
    }
  }, []);

  return (
    <div className="flex items-center ml-2 p-1 bg-white/80 rounded text-sm text-black">
      <Globe size={16} />
      <select
        id="lang-select"
        onChange={handleLanguageChange}
        className="bg-transparent outline-none cursor-pointer"
      >
        <option value="pl">PL</option>
        <option value="en">EN</option>
      </select>
    </div>
  );
}
