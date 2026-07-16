"""
Build app/data/item_catalog.json from templates/APP-CSE 2027 Form .xlsx.

The template lists every PS-DBM CSE item; anything not in this list is
considered nonCSE at input time. So the catalog only contains CSE entries;
the frontend combobox auto-classifies picks as CSE and leaves free-typed
items as nonCSE.
"""

from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

from openpyxl import load_workbook

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "templates" / "APP-CSE 2027 Form .xlsx"
DEST = REPO_ROOT / "app" / "data" / "item_catalog.json"


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", str(value)).strip()


def titleize_category(raw: str) -> str:
    """Convert the ALL-CAPS section headers into Title Case,
    dropping parenthetical notes and any explanatory lines."""
    # Keep only the first line (some cells use \n to append a "Please refer..." note).
    first_line = str(raw).split("\n", 1)[0]
    # Drop parenthetical notes like "(Note: Please indicate price of items)".
    # Replace with a single space so words on either side don't fuse together.
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


def parse_items() -> list[dict]:
    wb = load_workbook(SRC, data_only=True)
    ws = wb["Final"]

    items: list[dict] = []
    current_category = "Common-Use Supplies and Equipment"
    seen_codes: set[str] = set()

    for r in range(30, ws.max_row + 1):
        a = ws.cell(r, 1).value
        b = ws.cell(r, 2).value
        c = ws.cell(r, 3).value
        d = ws.cell(r, 4).value
        if not any([a, b, c, d]):
            continue

        a_raw = a if a is not None else ""
        a_txt = clean(a) if a is not None else ""

        if a_txt.upper().startswith("PART "):
            # Reset category between the two big sections; PART II lists
            # items without their own subheaders.
            if "PART II" in a_txt.upper():
                current_category = "Other Items Not Available at PS-DBM"
            else:
                current_category = "Common-Use Supplies and Equipment"
            continue

        # Category header: a text label sitting alone in column A
        if a_txt and not a_txt.isdigit() and (b is None) and (d is None):
            current_category = titleize_category(a_raw)
            continue

        # Data row: numbered item with code + description + unit
        if a_txt.isdigit() and c:
            code = clean(b) if b else ""
            description = clean(c)
            unit = clean(d) if d else "piece"
            key = code or description.lower()
            if key in seen_codes:
                continue
            seen_codes.add(key)
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


def main() -> None:
    items = parse_items()
    payload = {
        "version": 2,
        "source": SRC.name,
        "updated_at": date.today().isoformat(),
        "note": (
            "Items sourced from the PS-DBM APP-CSE 2027 template. Any item "
            "typed by an end user that does not match this list is treated "
            "as nonCSE."
        ),
        "items": items,
        "count": len(items),
    }
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(items)} CSE items to {DEST}")
    cats = sorted({it["category"] for it in items})
    print(f"Categories ({len(cats)}):")
    for cat in cats:
        print(f"  - {cat}")


if __name__ == "__main__":
    main()
