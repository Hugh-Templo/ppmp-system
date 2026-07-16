"""
Apply a raw .sql migration file against the configured DATABASE_URL.

Usage:
    python scripts/apply_migration.py migrations/004_office_signatory.sql
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

try:
    from dotenv import load_dotenv

    load_dotenv(REPO_ROOT / ".env")
except Exception:
    pass

from app.config import DATABASE_URL  # noqa: E402


def main(sql_path: str) -> None:
    path = (REPO_ROOT / sql_path) if not os.path.isabs(sql_path) else Path(sql_path)
    if not path.exists():
        raise SystemExit(f"Migration file not found: {path}")

    sql = path.read_text(encoding="utf-8")
    print(f"Applying {path.name} to {DATABASE_URL.split('@')[-1]}")

    if DATABASE_URL.startswith("sqlite"):
        import sqlite3

        db_file = DATABASE_URL.split("///", 1)[1]
        conn = sqlite3.connect(db_file)
        conn.executescript(sql)
        conn.commit()
        conn.close()
    else:
        import psycopg2

        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
        finally:
            conn.close()

    print("OK")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/apply_migration.py <path/to/*.sql>")
    main(sys.argv[1])
