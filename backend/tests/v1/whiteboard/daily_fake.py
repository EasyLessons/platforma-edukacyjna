"""
Atrapa REST API Daily dla testow rozmowy (httpx.MockTransport) - zadnych prawdziwych wywolan.
Klucz i token sa losowane w runtime (zadnych literalow wygladajacych na sekret).
"""
import json
import secrets
import time
from datetime import datetime

import httpx

from api.v1.auth.utils import create_access_token
from core.config import get_settings
from core.models import Board, WorkspaceMember

API_KEY = secrets.token_urlsafe(24)
DAILY_TOKEN = secrets.token_urlsafe(48)
DAILY_DOMAIN = "https://easylesson-test.daily.co"
ROOM_TTL_MINUTES = 180
MAX_PARTICIPANTS = 4


def user_headers(user_id: int) -> dict:
    settings = get_settings()
    token = create_access_token({"sub": str(user_id)}, settings.secret_key, settings.algorithm)
    return {"Authorization": f"Bearer {token}"}


def daily_error(status: int, error: str, info: str = "") -> httpx.Response:
    return httpx.Response(status, json={"error": error, "info": info})


def add_member(db_session, board, user, role: str) -> None:
    db_session.add(WorkspaceMember(workspace_id=board.workspace_id, user_id=user.id, role=role))
    db_session.commit()


def add_board(db_session, workspace, user) -> Board:
    board = Board(
        name="Druga tablica", icon="TestIcon", bg_color="bg-blue-500", workspace_id=workspace.id,
        created_by=user.id, created_at=datetime.utcnow(), last_modified=datetime.utcnow(),
        last_modified_by=user.id,
    )
    db_session.add(board)
    db_session.commit()
    db_session.refresh(board)
    return board


def post_call(client, board_id: int, user_id: int, **kwargs):
    return client.post(f"/api/v1/whiteboard/{board_id}/call", headers=user_headers(user_id), **kwargs)


def get_usage(client, user_id: int):
    return client.get("/api/v1/whiteboard/call/usage", headers=user_headers(user_id))


def room_of(board) -> str:
    return f"easylesson-board-{board.id}"


def meeting(minutes_per_participant: list[float], *, room: str = "inny-pokoj", ongoing: bool = False) -> dict:
    return {
        "id": secrets.token_hex(8),
        "room": room,
        "start_time": int(time.time()) - 3600,
        "duration": int(max(minutes_per_participant, default=0) * 60),
        "ongoing": ongoing,
        "max_participants": len(minutes_per_participant),
        "participants": [
            {"user_id": None, "participant_id": secrets.token_hex(8), "user_name": "X",
             "join_time": int(time.time()) - 3600, "duration": int(m * 60)}
            for m in minutes_per_participant
        ],
    }


class FakeDaily:
    """Pokoje i spotkania w pamieci + nagrane zadania + nadpisywane odpowiedzi."""

    def __init__(self):
        self.rooms: dict[str, dict] = {}
        self.meetings: list[dict] = []
        # nazwa pokoju -> uczestnicy obecni teraz (GET /rooms/:name/presence)
        self.presence: dict[str, list[dict]] = {}
        self.requests: list[httpx.Request] = []
        # (metoda, sciezka) -> lista odpowiedzi/wyjatkow zuzywanych po kolei (ostatnia zostaje)
        self.overrides: dict[tuple[str, str], list] = {}
        self.missing_room_response = lambda: daily_error(404, "not-found", "room not found")
        # Wlasciwosci, ktore atrapa "po cichu ignoruje" przy tworzeniu pokoju.
        self.ignored_room_properties: set[str] = set()

    # --- pomocnicze dla testow ---

    def add_room(self, name: str, *, exp: int | None = None, privacy: str = "private", **config) -> dict:
        self.rooms[name] = {
            "id": secrets.token_hex(8),
            "name": name,
            "api_created": True,
            "privacy": privacy,
            "url": f"{DAILY_DOMAIN}/{name}",
            "created_at": "2026-10-02T10:00:00.000Z",
            "config": {
                "exp": exp if exp is not None else int(time.time()) + 3600,
                "eject_at_room_exp": True,
                "max_participants": MAX_PARTICIPANTS,
                **config,
            },
        }
        return self.rooms[name]

    def override(self, method: str, path: str, *responses) -> None:
        self.overrides[(method, path)] = list(responses)

    def calls(self, method: str | None = None, path: str | None = None) -> list[httpx.Request]:
        return [
            r for r in self.requests
            if (method is None or r.method == method) and (path is None or r.url.path == f"/v1{path}")
        ]

    def writes(self) -> list[httpx.Request]:
        """Zadania zmieniajace stan Daily, poza wydaniem tokenu."""
        return [r for r in self.requests if r.method != "GET" and r.url.path != "/v1/meeting-tokens"]

    def body(self, method: str, path: str, index: int = -1) -> dict:
        return json.loads(self.calls(method, path)[index].content)

    def token_properties(self, index: int = -1) -> dict:
        return self.body("POST", "/meeting-tokens", index)["properties"]

    # --- transport ---

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        assert request.url.host == "api.daily.co"
        assert request.headers["authorization"] == f"Bearer {API_KEY}"
        path = request.url.path.removeprefix("/v1")

        queue = self.overrides.get((request.method, path))
        if queue:
            item = queue.pop(0) if len(queue) > 1 else queue[0]
            if isinstance(item, Exception):
                raise item
            if callable(item):
                return item(request)
            return httpx.Response(item.status_code, content=item.content, headers={"content-type": "application/json"})

        if request.method == "GET" and path == "/meetings":
            return self._meetings(request)
        if request.method == "POST" and path == "/meeting-tokens":
            return httpx.Response(200, json={"token": DAILY_TOKEN})
        if request.method == "GET" and path == "/rooms":
            return httpx.Response(200, json={"total_count": len(self.rooms), "data": list(self.rooms.values())})
        if request.method == "POST" and path == "/rooms":
            payload = json.loads(request.content)
            if payload["name"] in self.rooms:
                return daily_error(400, "invalid-request-error", f"a room named {payload['name']} already exists")
            properties = {k: v for k, v in payload["properties"].items() if k not in self.ignored_room_properties}
            exp = properties.pop("exp")
            room = self.add_room(payload["name"], exp=exp, privacy=payload.get("privacy", "public"))
            room["config"] = {"exp": exp, **properties}
            return httpx.Response(200, json=room)
        if request.method == "GET" and path.startswith("/rooms/") and path.endswith("/presence"):
            name = path.removeprefix("/rooms/").removesuffix("/presence")
            if name not in self.rooms:
                return self.missing_room_response()
            people = self.presence.get(name, [])
            return httpx.Response(200, json={"total_count": len(people), "data": people})
        if path.startswith("/rooms/"):
            name = path.removeprefix("/rooms/")
            room = self.rooms.get(name)
            if room is None:
                return self.missing_room_response()
            if request.method == "DELETE":
                del self.rooms[name]
                return httpx.Response(200, json={"deleted": True, "name": name})
            if request.method == "POST":
                room["config"].update(json.loads(request.content).get("properties", {}))
            return httpx.Response(200, json=room)
        return daily_error(404, "not-found")

    def _meetings(self, request: httpx.Request) -> httpx.Response:
        limit = int(request.url.params.get("limit", 20))
        after = request.url.params.get("starting_after")
        start = 0
        if after:
            start = next(i for i, m in enumerate(self.meetings) if m["id"] == after) + 1
        return httpx.Response(
            200, json={"total_count": len(self.meetings), "data": self.meetings[start:start + limit]}
        )
