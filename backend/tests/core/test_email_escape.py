"""Testy escapowania wartości od użytkownika w szablonach maili (SEC-09)."""
from core.email.templates.auth import password_reset_email, verification_email
from core.email.templates.workspace import workspace_invite_email

PAYLOAD = '<a href="https://phish.example">Kliknij</a><script>alert(1)</script>'


def assert_no_injected_markup(html: str) -> None:
    assert "<script>" not in html
    assert '<a href="https://phish.example">' not in html
    assert "&lt;script&gt;" in html


class TestAuthTemplatesEscape:
    def test_verification_email_escapes_username(self):
        _, html = verification_email(PAYLOAD, "123456")
        assert_no_injected_markup(html)

    def test_password_reset_email_escapes_username(self):
        _, html = password_reset_email(PAYLOAD, "654321")
        assert_no_injected_markup(html)

    def test_code_is_escaped(self):
        _, html = verification_email("janek", "<b>1</b>")
        assert "<b>1</b>" not in html


class TestWorkspaceInviteEscape:
    def test_escapes_all_user_supplied_names(self):
        for args in (
            (PAYLOAD, "Janek", "Zespół"),
            ("Ola", PAYLOAD, "Zespół"),
            ("Ola", "Janek", PAYLOAD),
        ):
            _, html = workspace_invite_email(*args, "https://app/invite/abc")
            assert_no_injected_markup(html)

    def test_link_cannot_break_out_of_href(self):
        link = 'https://app/invite/abc"><img src=x onerror=alert(1)>'
        _, html = workspace_invite_email("Ola", "Janek", "Zespół", link)
        assert "<img src=x" not in html
        assert 'href="https://app/invite/abc&quot;&gt;' in html

    def test_plain_values_and_static_layout_stay_intact(self):
        _, html = workspace_invite_email("Ola", "Janek", "Zespół X", "https://app/invite/abc?a=1")
        assert "Cześć, Ola!" in html
        assert "workspace'a „Zespół X”" in html
        assert 'href="https://app/invite/abc?a=1"' in html
        assert "<h1>" in html and "<a href=" in html
