import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, message } = body;

    // Bardzo prosta walidacja poprawności
    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Proszę wypełnić wszystkie pola' }, { status: 400 });
    }

    if (!email.includes('@') || !email.includes('.')) {
      return NextResponse.json({ error: 'Nieprawidłowy adres email' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY || 're_9bnc7xKz_DNoHSowYYzvgf1Ye9PeLZXee';

    // Wysyłka z użyciem endpointu Resend przez zapytanie fetch
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        // Gdy korzystamy z klucza testowego lub niezarejestrowanej domeny "onboarding@resend.dev" zazwyczaj jest wymuszony
        from: 'Acme <onboarding@resend.dev>',
        to: ['easylesson@interia.pl'], // Odbiorca wybrany przez użytkownika
        subject: `[EasyLesson Kontakt] Nowa wiadomość od: ${name}`,
        html: `
          <h3>Otrzymano nową wiadomość z formularza kontaktowego Działu Sprzedaży</h3>
          <p><strong>Imię i nazwisko / Firma:</strong> ${name}</p>
          <p><strong>Email nadawcy:</strong> ${email}</p>
          <br />
          <p><strong>Treść wiadomości:</strong></p>
          <p style="white-space: pre-wrap; padding: 12px; background: #f9f9f9; border-radius: 8px;">${message}</p>
          <br />
          <p><i>Ta wiadomość została wysłana z formularza kontaktowego na easylesson.app</i></p>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Błąd z Resend API:', errorData);
      return NextResponse.json({ error: 'Błąd podczas wysyłania emaila do Resend' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Błąd wewnętrzny serwera:', error);
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 });
  }
}
