"""
STORAGE CLEANUP - reczny przebieg sprzatania (api/v1/storage_quota/cleanup.py)
==============================================================================

    python scripts/storage_cleanup.py --dry-run   (z katalogu backend/, env jak backendu)
    python scripts/storage_cleanup.py

`--dry-run` nic nie zapisuje ani nie kasuje - drukuje raport, co przebieg by zrobil.
Pierwszy przebieg na produkcji warto zaczac od niego. Ten sam kod chodzi cyklicznie w procesie
backendu (STORAGE_CLEANUP_ENABLED); skrypt przydaje sie do podgladu i do uruchomienia z zewnatrz.
Raport (JSON) leci na stdout; kody wyjscia: 0 = bez bledow krokow, 1 = byly bledy, 2 = inny przebieg trwa.
"""
import argparse
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.v1.storage_quota.cleanup import run_cleanup  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Sprzatanie Storage, powiadomien i zaproszen")
    parser.add_argument("--dry-run", action="store_true", help="tylko raport, bez zapisu i kasowania")
    args = parser.parse_args()

    report = asyncio.run(run_cleanup(dry_run=args.dry_run))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report.get("skipped"):
        return 2
    return 1 if report.get("errors") else 0


if __name__ == "__main__":
    sys.exit(main())
