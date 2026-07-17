"""
Build app/data/item_catalog.json and seed PostgreSQL cse_catalog_item
from templates/APP-CSE 2027 Form .xlsx.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from sqlmodel import Session

from app.cse_catalog import parse_cse_items_from_xlsx, sync_cse_catalog_to_db, write_json_catalog
from app.database import engine, init_db


def main() -> None:
    items = parse_cse_items_from_xlsx()
    dest = write_json_catalog(items)
    print(f"Wrote {len(items)} CSE items to {dest}")

    init_db()
    with Session(engine) as session:
        summary = sync_cse_catalog_to_db(session, also_write_json=False)
    print(f"Synced {summary['count']} CSE items into PostgreSQL (cse_catalog_item)")

    cats = sorted({it["category"] for it in items})
    print(f"Categories ({len(cats)}):")
    for cat in cats:
        print(f"  - {cat}")


if __name__ == "__main__":
    main()
