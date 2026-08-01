"""Szablony maili modułu workspace."""
from .base import _base_email_html, _cta_button_html

def workspace_invite_email(invited_name: str, inviter_name: str, workspace_name: str, invite_link: str) -> tuple[str, str]:
    """Zwraca (subject, html) dla maila z zaproszeniem do workspace'a."""
    subject = f"{inviter_name} zaprasza Cię do workspace'a {workspace_name}"
    html = _base_email_html(
        heading=f"Cześć, {invited_name}!",
        intro=f"{inviter_name} zaprasza Cię do dołączenia do workspace'a „{workspace_name}”.",
        content_html=_cta_button_html("Akceptuj zaproszenie", invite_link),
        footer="Zaproszenie wygasa po 7 dniach. Jeśli nie rozpoznajesz tego zaproszenia, możesz je bezpiecznie zignorować.",
    )
    return subject, html
