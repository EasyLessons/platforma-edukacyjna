"""
Supabase Broadcast — wysyłanie eventów do frontendu przez WebSocket.
 
Jak to działa:
  FastAPI robi INSERT do Neon (baza danych)
  → następnie wywołuje broadcast_notification()
  → która uderza w Supabase REST API (/realtime/v1/api/broadcast)
  → Supabase pushuje event przez WebSocket do wszystkich subskrybentów kanału
  → frontend (NotificationContext) odbiera event natychmiast
 
Kanały są per-user: "notifications:{user_id}"
Dzięki temu każdy user widzi tylko swoje powiadomienia.
"""

import httpx
import os
import logging
from typing import Any

logger = logging.getLogger(__name__)

async def broadcast_notification(
        user_id: int,
        event: str,
        payload: dict[str, Any],
) -> bool:
    """
    Wysyła event Broadcast do prywatnego kanału usera.
 
    Parametry:
        user_id: ID zapraszanego usera (subskrybuje kanał "notifications:{user_id}")
        event:   Nazwa eventu, np. "new_invite", "invite_accepted"
        payload: Dane eventu — dowolny dict (zostanie przesłany do frontendu)
 
    Zwraca True jeśli sukces, False jeśli błąd (nie rzuca wyjątku —
    broadcast to "best effort", nie blokuje głównej operacji).
    """
    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        logger.warning(
            "Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY — "
            "broadcast pominięty (ustaw zmienne środowiskowe)"
        )
        return False

    channel = f"notifications:{user_id}"

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                f"{supabase_url}/realtime/v1/api/broadcast",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {service_role_key}",
                    "apikey": service_role_key,
                },
                json={
                    "messages": [
                        {
                            "topic": channel,
                            "event": event,
                            "payload": payload,
                        }
                    ]
                },
            )
            response.raise_for_status()
            logger.info(f"Broadcast '{event}' → kanał '{channel}' — OK")
            return True
    except httpx.TimeoutException:
        logger.warning(f"Broadcast '{event}' → timeout (Supabase niedostępny)")
        return False
    except httpx.HTTPStatusError as e:
        logger.error(f"Broadcast '{event}' → HTTP {e.response.status_code}: {e.response.text}")
        return False
    except Exception as e:
        logger.error(f"Broadcast '{event}' → nieoczekiwany błąd: {e}")
        return False
