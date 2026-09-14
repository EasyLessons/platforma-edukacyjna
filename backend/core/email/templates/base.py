"""Wspólny szkielet HTML dla maili."""


def _base_email_html(*, heading: str, intro: str, content_html: str, footer: str | None = None) -> str:
    """Wspólny layout: nagłówek, akapit, dowolna treść główna, opcjonalna stopka."""
    footer_html = f'<p style="color: #666; font-size: 14px;">{footer}</p>' if footer else ""
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>{heading}</h1>
            <p>{intro}</p>
            {content_html}
            {footer_html}
        </div>
    </body>
    </html>
    """


def _cta_button_html(text: str, link: str) -> str:
    """Przycisk-link + fallback jako zwykły tekst pod spodem."""
    return f"""
    <div style="text-align: center; margin: 30px 0;">
        <a href="{link}" style="background-color: #10b981; color: white; padding: 14px 32px;
                                 text-decoration: none; border-radius: 6px; font-weight: bold;
                                 display: inline-block;">
            {text}
        </a>
    </div>
    <p style="color: #666; font-size: 13px;">Lub wklej link do przeglądarki: {link}</p>
    """