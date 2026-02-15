"""
GOOGLE OAUTH HELPERS - Funkcje pomocnicze dla Google OAuth
"""
from authlib.integrations.starlette_client import OAuth
from core.config import get_settings

settings = get_settings()

# Konfiguracja OAuth klienta
oauth = OAuth()

oauth.register(
    name='google',
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)
