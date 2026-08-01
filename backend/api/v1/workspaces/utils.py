"""Utility funkcje modułu workspace."""
from core.email import send_email
from core.email.templates.workspace import workspace_invite_email

async def send_workspace_invite_email(
    invited_email: str,
    invited_name: str,
    inviter_name: str,
    workspace_name: str,
    invite_token: str,
    resend_api_key: str,
    from_email: str,
    frontend_url: str = "https://easylesson.app"
) -> bool:
    """Wysyła email z zaproszeniem do workspace'a."""
    invite_link = f"{frontend_url}/invite/{invite_token}"
    subject, html = workspace_invite_email(invited_name, inviter_name, workspace_name, invite_link)
    return await send_email(invited_email, subject, html, resend_api_key, from_email)