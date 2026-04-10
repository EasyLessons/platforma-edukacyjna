'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Header from '../layout/Header';
import Footer from '../layout/Footer';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return;
    
    setStatus('loading');
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      });
      
      if (response.ok) {
        setStatus('success');
        setName('');
        setEmail('');
        setMessage('');
      } else {
        setStatus('error');
      }
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-[#212224] flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#212224]/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#212224]/5 rounded-full blur-3xl pointer-events-none"></div>

      <Header />
      
      <main className="mt-40  flex-grow max-w-4xl mx-auto px-6 py-24 pb-40 w-full z-10">
        <div className="flex flex-col items-center justify-center mb-12">
          <Image
            src="/resources/LogoEasyLesson.webp"
            alt="EasyLesson Logo"
            width={200}
            height={50}
            priority
            className="h-10 w-auto mb-8 hover:opacity-80 transition-opacity hover:cursor-pointer"
          />
          <h1 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight text-center text-[#212224]">
            Zacznijmy współpracę!
          </h1>
          <p className="text-lg md:text-xl text-gray-500 text-center max-w-2xl mx-auto leading-relaxed">
            Masz pytania dotyczące wdrożenia <span className="font-semibold text-[#212224]">EasyLesson</span> w Twojej placówce? Wypełnij poniższy formularz, a nasi asystenci sprzedaży skontaktują się z Tobą najszybciej jak to możliwe.
          </p>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 max-w-2xl mx-auto relative">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2 ml-1">Imię i nazwisko</label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-[#212224]/10 focus:border-[#212224] transition-all hover:border-gray-300 hover:cursor-pointer hover:bg-white"
                  placeholder="Jan Kowalski"
                />
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2 ml-1">Adres email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-[#212224]/10 focus:border-[#212224] transition-all hover:border-gray-300 hover:cursor-pointer hover:bg-white"
                  placeholder="jan.kowalski@szkola.pl"
                />
              </div>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2 ml-1">Wiadomość</label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 focus:outline-none focus:ring-4 focus:ring-[#212224]/10 focus:border-[#212224] transition-all resize-none hover:border-gray-300 hover:cursor-pointer hover:bg-white"
                placeholder="Napisz, w czym możemy pomóc..."
              ></textarea>
            </div>

            {status === 'error' && (
              <div className="text-red-600 text-sm font-medium text-center bg-red-50 p-4 rounded-xl border border-red-100">
                Wystąpił błąd podczas wysyłania wiadomości. Spróbuj ponownie lub napisz na <strong>kontakt@easylesson.app</strong>
              </div>
            )}

            {status === 'success' && (
              <div className="text-[#212224] text-sm font-medium text-center bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Wiadomość została poprawnie wysłana! Odezwiemy się wkrótce.
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={status === 'loading' || status === 'success'}
                className="w-full bg-[#212224] text-white py-4 rounded-xl font-bold shadow-md hover:bg-black hover:shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0 disabled:active:scale-100 flex items-center justify-center gap-2 hover:cursor-pointer group"
              >
                {status === 'loading' ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Wysyłanie...
                  </>
                ) : status === 'success' ? (
                  <>Wysłano pomyślnie</>
                ) : (
                  <>
                    Wyślij wiadomość
                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
            
            <p className="text-xs text-center text-gray-400 mt-4">
              Przesyłając zapytanie, zgadzasz się z naszą 
              <a href="/polityka-prywatnosci" className="underline hover:text-[#212224] ml-1 hover:cursor-pointer transition-colors">Polityką Prywatności</a>.
            </p>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
