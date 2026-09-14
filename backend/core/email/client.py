"""
Wspólny transport mailowy. 
Jedno miejsce, które zna szczegóły providera (Resend).
"""
import resend
from core.logging import get_logger

logger = get_logger(__name__)

async def send_email(to: str, subject: str, html: str, resend_api_key: str, from_email: str) -> bool:
    """
    Wysyła pojedynczy mail przez Resend.
    """
    resend.api_key = resend_api_key
    try:
        resend.Emails.send({
            "from": from_email,
            "to": [to],
            "subject": subject,
            "html": html
        })
        logger.info(f"Email wysłany (to={to})")
        return True
    except Exception:
        logger.exception(f"Błąd wysyłania emaila (to={to})")
        raise
