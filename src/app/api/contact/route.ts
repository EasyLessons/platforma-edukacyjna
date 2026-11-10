/**
 * /api/contact - formularz kontaktowy z landingu (/contact) -> mail przez Resend.
 *
 * Route Handler bez logowania (publiczny formularz), wiec sam sie broni (audyt SEC-08):
 * limit per IP (pamiec procesu, jak /api/chat), twarde limity dlugosci pol, honeypot
 * (ukryte pole `website`, ktore wypelniaja tylko boty) i tresc maila jako `text`,
 * nie `html` - zero escapowania, zero HTML-a od nadawcy w skrzynce.
 */
import { NextResponse } from 'next/server';

import { createRateLimiter, getClientIp } from '@/_new/server/chat/rate-limit';
import { createLogger } from '@/_new/lib/logger';

const log = createLogger('api/contact');

const CONTACT_TO_EMAIL_DEFAULT = 'kontakt@easylesson.app';
export const MAX_NAME_LENGTH = 120;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_MESSAGE_LENGTH = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 5 wiadomosci na 10 minut z jednego IP, potem blokada na 10 minut.
const rateLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 10 * 60 * 1000,
  blockDurationMs: 10 * 60 * 1000,
});
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000).unref?.();

function fieldString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function POST(request: Request) {
  try {
    if (!rateLimiter.check(`ip:${getClientIp(request.headers)}`)) {
      return NextResponse.json(
        { error: 'Zbyt wiele wiadomości. Spróbuj ponownie za kilka minut.' },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest('Nieprawidłowe dane');
    }
    const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const name = fieldString(data.name);
    const email = fieldString(data.email);
    const message = fieldString(data.message);

    // Honeypot: prawdziwy formularz zostawia to pole puste. Botowi odpowiadamy "sukces".
    if (fieldString(data.website)) {
      return NextResponse.json({ success: true }, { status: 200 });
    }

    if (!name || !email || !message) {
      return badRequest('Proszę wypełnić wszystkie pola');
    }
    if (
      name.length > MAX_NAME_LENGTH ||
      email.length > MAX_EMAIL_LENGTH ||
      message.length > MAX_MESSAGE_LENGTH
    ) {
      return badRequest('Wiadomość jest za długa');
    }
    if (!EMAIL_RE.test(email)) {
      return badRequest('Nieprawidłowy adres email');
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      log.error('Brak RESEND_API_KEY - formularz kontaktowy nie wyśle maila');
      return NextResponse.json(
        { error: 'Formularz kontaktowy jest chwilowo niedostępny' },
        { status: 500 }
      );
    }
    // Skrzynka odbiorcza formularza: env CONTACT_TO_EMAIL (Vercel), domyślnie wspólny adres
    // kontaktowy z landingu i stron prawnych.
    const recipient = process.env.CONTACT_TO_EMAIL || CONTACT_TO_EMAIL_DEFAULT;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // Klucz testowy / niezweryfikowana domena w Resend wymusza nadawce onboarding@resend.dev.
        from: 'EasyLesson <onboarding@resend.dev>',
        to: [recipient],
        reply_to: email,
        subject: `[EasyLesson Kontakt] Nowa wiadomość od: ${name}`,
        text: [
          'Nowa wiadomość z formularza kontaktowego easylesson.app',
          '',
          `Imię i nazwisko / Firma: ${name}`,
          `E-mail nadawcy: ${email}`,
          '',
          'Treść wiadomości:',
          message,
        ].join('\n'),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      log.error('Błąd z Resend API', { status: response.status, body: errorData });
      return NextResponse.json(
        { error: 'Błąd podczas wysyłania emaila do Resend' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    log.error('Błąd wewnętrzny serwera', error instanceof Error ? error.message : 'nieznany');
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 });
  }
}
