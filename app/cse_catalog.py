"""
Load PS-DBM CSE items from templates/APP-CSE 2027 Form .xlsx into PostgreSQL
and optionally refresh app/data/item_catalog.json.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime
from pathlib import Path
from typing import List

from openpyxl import load_workbook
from sqlmodel import Session, select

from app.models import CseCatalogItem

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "templates" / "APP-CSE 2027 Form .xlsx"
JSON_DEST = REPO_ROOT / "app" / "data" / "item_catalog.json"


def clean(value) -> str:
    return re.sub(r"\s+", " ", str(value)).strip()


def titleize_category(raw: str) -> str:
    first_line = str(raw).split("\n", 1)[0]
    text = re.sub(r"\s*\([^)]*\)\s*", " ", first_line).strip()
    text = clean(text)
    lower = text.lower()
    words = []
    for i, w in enumerate(lower.split(" ")):
        if i > 0 and w in {"and", "or", "of", "for", "the", "in", "on", "to", "at", "by"}:
            words.append(w)
        else:
            words.append(w.capitalize())
    return " ".join(words) or raw


def parse_cse_items_from_xlsx(path: Path | None = None) -> List[dict]:
    src = path or SRC
    if not src.exists():
        raise FileNotFoundError(f"CSE template not found: {src}")

    wb = load_workbook(src, data_only=True)
    if "Final" not in wb.sheetnames:
        raise ValueError(f"Sheet 'Final' missing in {src.name}")
    ws = wb["Final"]

    items: List[dict] = []
    current_category = "Common-Use Supplies and Equipment"
    seen_keys: set[str] = set()

    for r in range(30, (ws.max_row or 30) + 1):
        a = ws.cell(r, 1).value
        b = ws.cell(r, 2).value
        c = ws.cell(r, 3).value
        d = ws.cell(r, 4).value
        if not any([a, b, c, d]):
            continue

        a_raw = a if a is not None else ""
        a_txt = clean(a) if a is not None else ""

        if a_txt.upper().startswith("PART "):
            if "PART II" in a_txt.upper():
                current_category = "Other Items Not Available at PS-DBM"
            else:
                current_category = "Common-Use Supplies and Equipment"
            continue

        if a_txt and not a_txt.isdigit() and (b is None) and (d is None):
            current_category = titleize_category(a_raw)
            continue

        if a_txt.isdigit() and c:
            code = clean(b) if b else ""
            description = clean(c)
            unit = clean(d) if d else "piece"
            key = (code or description.lower()).strip()
            if not key or key in seen_keys:
                continue
            seen_keys.add(key)
            items.append(
                {
                    "code": code,
                    "description": description,
                    "unit_of_measure": unit,
                    "category": current_category,
                    "is_cse": True,
                }
            )

    return items


def write_json_catalog(items: List[dict], source_name: str | None = None) -> Path:
    payload = {
        "version": 2,
        "source": source_name or SRC.name,
        "updated_at": date.today().isoformat(),
        "note": (
            "Items sourced from the PS-DBM APP-CSE 2027 template. Any item "
            "typed by an end user that does not match this list is treated "
            "as nonCSE."
        ),
        "items": items,
        "count": len(items),
    }
    JSON_DEST.parent.mkdir(parents=True, exist_ok=True)
    JSON_DEST.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    return JSON_DEST


def sync_cse_catalog_to_db(
    session: Session,
    *,
    path: Path | None = None,
    also_write_json: bool = True,
) -> dict:
    """
    Replace the cse_catalog_item table contents with rows parsed from the
    APP-CSE Excel template. Returns a summary dict.
    """
    items = parse_cse_items_from_xlsx(path)
    source_name = (path or SRC).name

    # Full replace keeps the catalogue identical to the official template.
    existing = session.exec(select(CseCatalogItem)).all()
    for row in existing:
        session.delete(row)
    session.flush()

    now = datetime.utcnow()
    for item in items:
        session.add(
            CseCatalogItem(
                code=item.get("code") or "",
                description=item["description"],
                unit_of_measure=item.get("unit_of_measure") or "piece",
                category=item.get("category") or "Common-Use Supplies and Equipment",
                is_cse=True,
                source=source_name,
                created_at=now,
                updated_at=now,
            )
        )
    session.commit()

    if also_write_json:
        write_json_catalog(items, source_name=source_name)

    logger.info("Synced %d CSE catalog items from %s", len(items), source_name)
    return {
        "count": len(items),
        "source": source_name,
        "updated_at": now.isoformat(),
    }


def ensure_cse_catalog_seeded(session: Session) -> None:
    """If the CSE catalog table is empty and the Excel exists, import it."""
    has_row = session.exec(select(CseCatalogItem).limit(1)).first()
    if has_row is not None:
        return
    if not SRC.exists():
        logger.warning("CSE template missing at %s; catalog not seeded", SRC)
        return
    try:
        sync_cse_catalog_to_db(session, also_write_json=True)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to seed CSE catalog from Excel")
