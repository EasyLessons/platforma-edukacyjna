"""Wspólny szkielet HTML dla maili.

Wszystko, co trafia do szablonu jako tekst (nagłówek, akapit, stopka, link, kod),
jest escapowane tutaj (SEC-09) - nazwy użytkowników i workspace'ów pochodzą od
użytkowników i bez tego dałoby się wstrzyknąć dowolny HTML do maila z naszej domeny.
Jedynie `content_html` jest wstawiany bez zmian: to HTML zbudowany przez helpery
z tego pakietu (które same escapują swoje argumenty).
"""
from html import escape


def _text(value: str) -> str:
    """Escapuje tekst wstawiany między tagi (cudzysłowy zostają czytelne)."""
    return escape(str(value), quote=False)


def _base_email_html(*, heading: str, intro: str, content_html: str, footer: str | None = None) -> str:
    """Wspólny layout: nagłówek, akapit, dowolna treść główna, opcjonalna stopka."""
    footer_html = f'<p style="color: #666; font-size: 14px;">{_text(footer)}</p>' if footer else ""
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>{_text(heading)}</h1>
            <p>{_text(intro)}</p>
            {content_html}
            {footer_html}
        </div>
    </body>
    </html>
    """


def _cta_button_html(text: str, link: str) -> str:
    """Przycisk-link + fallback jako zwykły tekst pod spodem."""
    href = escape(str(link), quote=True)
    return f"""
    <div style="text-align: center; margin: 30px 0;">
        <a href="{href}" style="background-color: #10b981; color: white; padding: 14px 32px;
                                 text-decoration: none; border-radius: 6px; font-weight: bold;
                                 display: inline-block;">
            {_text(text)}
        </a>
    </div>
    <p style="color: #666; font-size: 13px;">Lub wklej link do przeglądarki: {_text(link)}</p>
    """