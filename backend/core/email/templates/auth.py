"""Szablony maili modułu auth."""
from .base import _base_email_html

def _code_box_html(code: str) -> str:
    """Wspólny szkielet HTML dla maili z kodem."""
    return f"""
    <div style="background: white; border: 2px dashed #10b981;
                padding: 20px; text-align: center; font-size: 32px;
                font-weight: bold; color: #10b981;">
        {code}
    </div>
    <p><strong>Kod ważny przez 15 minut.</strong></p>
    """

def verification_email(username: str, code: str) -> tuple[str, str]:
    """Zwraca (subject, html) dla maila weryfikacyjnego."""
    subject = "Weryfikacja konta - Platforma Edukacyjna"
    html = _base_email_html(
        heading=f"Witaj, {username}!",
        intro="Dziękujemy za rejestrację! Użyj poniższego kodu, aby zweryfikować konto.",
        content_html=_code_box_html(code),
    )
    return subject, html

def password_reset_email(username: str, code: str) -> tuple[str, str]:
    """Zwraca (subject, html) dla maila resetu hasła."""
    subject = "Reset hasła - Platforma Edukacyjna"
    html = _base_email_html(
        heading=f"Witaj, {username}!",
        intro="Otrzymaliśmy prośbę o zresetowanie hasła. Użyj poniższego kodu, aby ustawić nowe hasło.",
        content_html=_code_box_html(code),
        footer="Jeżeli nie prosiłeś o reset hasła, zignoruj tę wiadomość.",
    )
    return subject, html
