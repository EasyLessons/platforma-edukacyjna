"""
Jednorazowa migracja: obrazy inline (data:image/...;base64) z Y.Doc tablic -> Supabase Storage.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import binascii
import hashlib
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Awaitable, Callable
from urllib.parse import urlsplit

from dotenv import load_dotenv
from pycrdt import Doc, Map
from sqlalchemy import create_engine, text

from api.v1.whiteboard.storage import (
    ALLOWED_CONTENT_TYPES,
    MAX_UPLOAD_SIZE_BYTES,
    upload_board_image,
)

# Jak ELEMENTS_KEY w src/_new/features/whiteboard/yjs/board-doc.ts
ELEMENTS_KEY = "elements"
DATA_URL_RE = re.compile(r"^data:(?P<mime>[\w.+-]+/[\w.+-]+);base64,(?P<data>.*)$", re.DOTALL)
MIME_ALIASES = {"image/jpg": "image/jpeg"}

# (board_id, bajty, content_type, object_name) -> publiczny URL
Uploader = Callable[[int, bytes, str, str], Awaitable[str]]

SELECT_CANDIDATES = text(
    "SELECT board_id FROM board_documents "
    "WHERE position('data:image'::bytea IN snapshot) > 0 ORDER BY board_id"
)
SELECT_ONE = text("SELECT snapshot, updated_at FROM board_documents WHERE board_id = :board_id")
UPDATE_ONE = text(
    "UPDATE board_documents SET snapshot = :snapshot, updated_at = :now "
    "WHERE board_id = :board_id AND updated_at = :old_updated_at"
)

@dataclass
class BoardReport:
    board_id: int
    bytes_before: int
    bytes_after: int = 0
    replaced: int = 0
    uploaded: int = 0
    skipped: Counter = field(default_factory=Counter)


async def migrate_snapshot(
    board_id: int, snapshot: bytes, upload: Uploader
) -> tuple[bytes, BoardReport]:
    """Podmienia obrazy inline na URL-e. Zwraca (nowy snapshot, raport). Jedyne I/O to `upload`."""
    report = BoardReport(board_id=board_id, bytes_before=len(snapshot))
    doc = Doc()
    doc.apply_update(snapshot)
    elements = doc.get(ELEMENTS_KEY, type=Map)

    urls_by_sha: dict[str, str] = {}
    replacements: list[tuple[Map, str]] = []

    # Najpierw zbieramy, potem podmieniamy - bez modyfikowania mapy w trakcie iteracji.
    for _element_id, node in list(elements.items()):
        if not isinstance(node, Map):
            continue
        src = node.get("src")
        if not isinstance(src, str) or not src.startswith("data:"):
            continue

        match = DATA_URL_RE.match(src)
        if not match:
            report.skipped["niepoprawny data URL"] += 1
            continue
        mime = match["mime"].lower()
        mime = MIME_ALIASES.get(mime, mime)
        if mime not in ALLOWED_CONTENT_TYPES:
            report.skipped[mime] += 1
            continue
        try:
            data = base64.b64decode(match["data"], validate=True)
        except (binascii.Error, ValueError):
            report.skipped["niepoprawny base64"] += 1
            continue
        if len(data) > MAX_UPLOAD_SIZE_BYTES:
            report.skipped["za duży (>15 MB)"] += 1
            continue

        sha = hashlib.sha256(data).hexdigest()
        if sha not in urls_by_sha:
            urls_by_sha[sha] = await upload(board_id, data, mime, sha)
            report.uploaded += 1
        replacements.append((node, urls_by_sha[sha]))

    if not replacements:
        report.bytes_after = len(snapshot)
        return snapshot, report

    with doc.transaction():
        for node, url in replacements:
            node["src"] = url
    report.replaced = len(replacements)

    new_snapshot = doc.get_update()
    report.bytes_after = len(new_snapshot)
    return new_snapshot, report

async def dry_run_upload(board_id: int, data: bytes, content_type: str, object_name: str) -> str:
    """Nic nie wysyła - zwraca URL o długości zbliżonej do prawdziwego (do szacunku rozmiaru)."""
    ext = ALLOWED_CONTENT_TYPES[content_type]
    return f"https://dry-run.supabase.co/storage/v1/object/public/board-images/{board_id}/{object_name}.{ext}"

async def storage_upload(board_id: int, data: bytes, content_type: str, object_name: str) -> str:
    return await upload_board_image(board_id, data, content_type, object_name=object_name)

def _mb(n: int) -> str:
    return f"{n / 1024 / 1024:.1f} MB"

def format_report(r: BoardReport) -> str:
    line = (
        f"  tablica {r.board_id}: podmienionych {r.replaced}, wgranych plików {r.uploaded}, "
        f"{_mb(r.bytes_before)} -> {_mb(r.bytes_after)}"
    )
    if r.skipped:
        line += f", pominięte: {dict(r.skipped)}"
    return line

def parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migracja obrazów inline z Y.Doc do Supabase Storage.")
    parser.add_argument(
        "--database-url",
        required=True,
        help="Adres bazy. Celowo bez domyślnej wartości z .env - żeby nie trafić w produkcję przez przypadek.",
    )
    parser.add_argument("--board-id", type=int, action="append", default=[], help="Tylko wskazane tablice.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Bez uploadu i bez zapisu - tylko raport.")
    mode.add_argument("--yes", action="store_true", help="Naprawdę wgrywa obrazy i zapisuje snapshoty.")
    return parser.parse_args(argv)

async def run(args: argparse.Namespace) -> int:
    # storage.py czyta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY przez os.getenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")

    engine = create_engine(args.database_url)
    upload: Uploader = dry_run_upload if args.dry_run else storage_upload
    mode = "DRY-RUN (bez uploadu i zapisu)" if args.dry_run else "ZAPIS"
    print(f"Baza: {urlsplit(args.database_url).hostname} | tryb: {mode}")

    with engine.connect() as conn:
        board_ids = args.board_id or [row.board_id for row in conn.execute(SELECT_CANDIDATES)]
    print(f"Tablic z obrazami inline: {len(board_ids)}")

    total_before = total_after = 0
    total_skipped: Counter = Counter()
    conflicts: list[int] = []
    errors: list[int] = []

    for board_id in board_ids:
        with engine.connect() as conn:
            row = conn.execute(SELECT_ONE, {"board_id": board_id}).first()
        if row is None:
            print(f"  tablica {board_id}: brak snapshotu - pomijam")
            continue

        try:
            new_snapshot, report = await migrate_snapshot(board_id, bytes(row.snapshot), upload)
        except Exception as exc:  # błąd uploadu/dekodowania - ta tablica zostaje bez zmian
            errors.append(board_id)
            print(f"  tablica {board_id}: BŁĄD {type(exc).__name__}: {exc} - bez zmian")
            continue

        total_before += report.bytes_before
        total_after += report.bytes_after
        total_skipped.update(report.skipped)
        print(format_report(report))

        if args.dry_run or not report.replaced:
            continue

        with engine.begin() as conn:
            result = conn.execute(
                UPDATE_ONE,
                {
                    "snapshot": new_snapshot,
                    "now": datetime.now(timezone.utc).replace(tzinfo=None),
                    "board_id": board_id,
                    "old_updated_at": row.updated_at,
                },
            )
        if result.rowcount != 1:
            conflicts.append(board_id)
            print(f"    KONFLIKT: snapshot tablicy {board_id} zmienił się w trakcie - nie zapisano")

    engine.dispose()
    print(f"\nRazem: {_mb(total_before)} -> {_mb(total_after)}")
    if total_skipped:
        print(f"Pominięte (zostają inline): {dict(total_skipped)}")
    if conflicts:
        print(f"Konflikty (uruchom ponownie dla tych tablic): {conflicts}")
    if errors:
        print(f"Błędy (bez zmian): {errors}")
    return 1 if conflicts or errors else 0

def main(argv: list[str] | None = None) -> int:
    return asyncio.run(run(parse_args(argv)))

if __name__ == "__main__":
    raise SystemExit(main())