"""Testy modułu core.email - szablony i transporty."""
from unittest.mock import patch, MagicMock
import pytest

from core.email import send_email
from core.email.templates.auth import verification_email, password_reset_email
from core.email.templates.workspace import workspace_invite_email

class TestAuthTemplates:
    def test_verification_email_contains_username_and_code(self):
        subject, html = verification_email("janek", "123456")
        assert "janek" in html
        assert "123456" in html
        assert "Weryfikacja" in subject

    def test_password_reset_email_contains_username_and_code(self):
        subject, html = password_reset_email("janek", "654321")
        assert "janek" in html
        assert "654321" in html
        assert "Reset" in subject

class TestWorkspaceTemplates:
    def test_invite_email_contains_names_and_link(self):
        subject, html = workspace_invite_email("Ola", "Janek", "Zespół X", "https://app/invite/abc")
        assert "Ola" in html
        assert "Janek" in subject
        assert "Zespół X" in html
        assert "https://app/invite/abc" in html

class TestSendEmail:
    @pytest.mark.asyncio
    async def test_calls_resend_with_correct_params(self):
        with patch("core.email.client.resend") as mock_resend:
            mock_resend.Emails.send = MagicMock(return_value={"id": "test"})
            result = await send_email("to@test.com", "Subject", "<p>Hi</p>", "key", "from@test.com")
        assert result is True
        mock_resend.Emails.send.assert_called_once()
        params = mock_resend.Emails.send.call_args[0][0]
        assert params["to"] == ["to@test.com"]
        assert params["subject"] == "Subject"

    @pytest.mark.asyncio
    async def test_reraises_on_provider_error(self):
        with patch("core.email.client.resend") as mock_resend:
            mock_resend.Emails.send.side_effect = Exception("Resend down")
            with pytest.raises(Exception, match="Resend down"):
                await send_email("to@test.com", "Subject", "<p>Hi</p>", "key", "from@test.com")
