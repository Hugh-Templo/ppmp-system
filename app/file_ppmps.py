"""
Scan and parse office PPMP Excel files under IT_ppmps/{CSE|nonCSE}.

Supports:
- NGPA layout (preferred): header "Column 1".."Column 12" then data rows
- Legacy PPMP sheet: AIP REF. CODE / GENERAL DESCRIPTION / Quantity / Budget / METHOD
"""

from __future__ import annotations

import hashlib
import logging
import re
from pathlib import Path
from typing import Any, Iterable, List, Optional

from openpyxl import load_workbook

from app.config import IT_PPMPS_DIR

logger = logging.getLogger("file_ppmps")

EXCEL_SUFFIXES = {".xls", ".xlsx", ".xlsm"}

KIND_FOLDER = {
    "cse": "CSE",
    "noncse": "nonCSE",
}


def _kind_dir(kind: str) -> Path:
    key = (kind or "cse").strip().lower()
    if key not in KIND_FOLDER:
        raise ValueError("kind must be 'cse' or 'noncse'")
    return IT_PPMPS_DIR / KIND_FOLDER[key]


def _office_from_filename(stem: str) -> str:
    cleaned = re.sub(r"(?i)\s*ppmp\s*$", "", stem).strip(" -_")
    return cleaned or stem or "office"


def _file_id(path: Path) -> str:
    digest = hashlib.sha1(str(path.resolve()).encode("utf-8")).hexdigest()[:12]
    return f"file-{digest}"


def _cell_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value == int(value):
        return str(int(value))
    return str(value).strip()


def _cell_float(value: Any) -> float:
    if value is None or value == "":
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace(",", "").strip()
    if not text:
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def _yes_no_bool(value: Any) -> bool:
    text = _cell_str(value).lower()
    return text in {"yes", "y", "true", "1"}


def _iter_sheet_rows_xls(path: Path) -> Iterable[tuple[str, List[Any]]]:
    import xlrd

    wb = xlrd.open_workbook(str(path))
    for name in wb.sheet_names():
        ws = wb.sheet_by_name(name)
        rows: List[List[Any]] = []
        for r in range(ws.nrows):
            rows.append([ws.cell_value(r, c) for c in range(ws.ncols)])
        yield name, rows


def _iter_sheet_rows_xlsx(path: Path) -> Iterable[tuple[str, List[Any]]]:
    wb = load_workbook(path, data_only=True, read_only=True)
    try:
        for name in wb.sheetnames:
            ws = wb[name]
            rows = [list(row) for row in ws.iter_rows(values_only=True)]
            yield name, rows
    finally:
        wb.close()


def _iter_workbook_rows(path: Path) -> Iterable[tuple[str, List[Any]]]:
    suffix = path.suffix.lower()
    if suffix == ".xls":
        yield from _iter_sheet_rows_xls(path)
    elif suffix in {".xlsx", ".xlsm"}:
        yield from _iter_sheet_rows_xlsx(path)
    else:
        raise ValueError(f"Unsupported Excel type: {path.suffix}")


def _row_joined(row: List[Any]) -> str:
    return " ".join(_cell_str(c) for c in row).lower()


def _find_ngpa_header_index(rows: List[List[Any]]) -> Optional[int]:
    for i, row in enumerate(rows):
        cells = [_cell_str(c).lower() for c in row[:12]]
        if cells and cells[0] == "column 1" and any("column 12" == c for c in cells):
            return i
        joined = _row_joined(row)
        if "general description" in joined and "recommended mode of procurement" in joined:
            # NGPA label row; data usually starts two rows later (Column 1 row + guide)
            return i
    return None


def _parse_ngpa_items(rows: List[List[Any]], is_cse: bool, office_code: str) -> List[dict]:
    header_idx = None
    for i, row in enumerate(rows):
        cells = [_cell_str(c).lower() for c in row[:12]]
        if cells and cells[0] == "column 1":
            header_idx = i
            break
    if header_idx is None:
        return []

    items: List[dict] = []
    for row in rows[header_idx + 1 :]:
        if not row:
            continue
        joined = _row_joined(row)
        if not joined or joined.startswith("refers to"):
            continue
        if "submitted by" in joined or "approved by" in joined:
            break
        description = _cell_str(row[0] if len(row) > 0 else "")
        if not description or description.lower().startswith("column "):
            continue
        # Skip long instructional blobs
        if len(description) > 400 and "refers to" in description.lower():
            continue

        project_type = _cell_str(row[1] if len(row) > 1 else "") or "Goods"
        quantity_size = _cell_str(row[2] if len(row) > 2 else "")
        procurement_mode = _cell_str(row[3] if len(row) > 3 else "") or "Competitive Bidding"
        pre_proc = _yes_no_bool(row[4] if len(row) > 4 else "")
        proc_start = _cell_str(row[5] if len(row) > 5 else "")
        proc_end = _cell_str(row[6] if len(row) > 6 else "")
        delivery = _cell_str(row[7] if len(row) > 7 else "")
        fund_source = _cell_str(row[8] if len(row) > 8 else "")
        budget = _cell_float(row[9] if len(row) > 9 else 0)
        supporting = _cell_str(row[10] if len(row) > 10 else "")
        remarks = _cell_str(row[11] if len(row) > 11 else "")

        items.append(
            {
                "description": description,
                "category": description,
                "is_cse": bool(is_cse),
                "project_type": project_type,
                "quantity_size": quantity_size or None,
                "procurement_mode": procurement_mode.rstrip(","),
                "pre_proc_conf": pre_proc,
                "proc_start": proc_start or None,
                "proc_end": proc_end or None,
                "delivery_period": delivery or None,
                "fund_source": fund_source.rstrip(",") or None,
                "estimated_budget": budget,
                "supporting_docs": supporting or None,
                "remarks": remarks or None,
                "quantity": None,
                "unit_of_measure": None,
                "unit_cost": None,
                "q1_qty": 0,
                "q2_qty": 0,
                "q3_qty": 0,
                "q4_qty": 0,
                "office_code": office_code,
            }
        )
    return items


def _parse_legacy_ppmp_items(rows: List[List[Any]], is_cse: bool, office_code: str) -> List[dict]:
    """Parse AIP REF / GENERAL DESCRIPTION style sheets."""
    start = None
    for i, row in enumerate(rows):
        joined = _row_joined(row)
        if "aip ref" in joined and "general description" in joined:
            start = i + 1
            # skip size/budget sub-header if present
            if start < len(rows) and "size" in _row_joined(rows[start]) and "budget" in _row_joined(rows[start]):
                start += 1
            break
    if start is None:
        return []

    items: List[dict] = []
    for row in rows[start:]:
        if not row:
            continue
        code = _cell_str(row[0] if len(row) > 0 else "")
        description = _cell_str(row[1] if len(row) > 1 else "")
        qty_size = _cell_str(row[2] if len(row) > 2 else "")
        budget = _cell_float(row[3] if len(row) > 3 else 0)
        mode = _cell_str(row[4] if len(row) > 4 else "") or "Competitive Bidding"
        if not description and not code:
            continue
        if not description:
            description = code
        items.append(
            {
                "description": description,
                "category": code or description,
                "is_cse": bool(is_cse),
                "project_type": "Goods",
                "quantity_size": qty_size or None,
                "procurement_mode": mode,
                "pre_proc_conf": False,
                "proc_start": None,
                "proc_end": None,
                "delivery_period": None,
                "fund_source": None,
                "estimated_budget": budget,
                "supporting_docs": None,
                "remarks": None,
                "quantity": None,
                "unit_of_measure": None,
                "unit_cost": None,
                "q1_qty": 0,
                "q2_qty": 0,
                "q3_qty": 0,
                "q4_qty": 0,
                "office_code": office_code,
            }
        )
    return items


def _extract_meta(rows: List[List[Any]]) -> dict:
    fiscal_year = None
    end_user = None
    title = None
    for row in rows[:20]:
        joined = _row_joined(row)
        text0 = _cell_str(row[0] if row else "")
        if text0.lower().startswith("fiscal year"):
            m = re.search(r"(20\d{2})", text0)
            if m:
                fiscal_year = int(m.group(1))
        if "end-user" in joined or "end user" in joined:
            m = re.search(r"end[- ]user(?: unit)?\s*:?\s*(.+)$", text0, re.I)
            if m:
                end_user = m.group(1).strip()
        if "project procurement management plan" in joined:
            title = text0 or "PPMP"
    return {
        "fiscal_year": fiscal_year,
        "end_user": end_user,
        "title": title,
    }


def load_file_ppmp_items(path: Path | str, is_cse: bool) -> List[dict]:
    path = Path(path)
    office_code = _office_from_filename(path.stem)
    all_items: List[dict] = []
    try:
        for _name, rows in _iter_workbook_rows(path):
            ngpa = _parse_ngpa_items(rows, is_cse=is_cse, office_code=office_code)
            if ngpa:
                all_items.extend(ngpa)
                continue
            legacy = _parse_legacy_ppmp_items(rows, is_cse=is_cse, office_code=office_code)
            # Only keep legacy rows that have a real description or budget
            legacy = [
                it
                for it in legacy
                if (it.get("description") and it["description"] != it.get("category"))
                or (it.get("estimated_budget") or 0) > 0
            ]
            all_items.extend(legacy)
    except Exception:
        logger.exception("Failed to parse PPMP file %s", path)
        raise
    return all_items


def list_file_ppmps(kind: str) -> List[dict]:
    """List Excel PPMP files for CSE or nonCSE under IT_ppmps."""
    folder = _kind_dir(kind)
    want_cse = (kind or "cse").strip().lower() == "cse"
    if not folder.is_dir():
        return []

    results: List[dict] = []
    for path in sorted(folder.iterdir(), key=lambda p: p.name.lower()):
        if not path.is_file() or path.suffix.lower() not in EXCEL_SUFFIXES:
            continue
        if path.name.startswith("~$"):
            continue

        office_name = _office_from_filename(path.stem)
        title = path.stem
        fiscal_year = None
        try:
            for _name, rows in _iter_workbook_rows(path):
                meta = _extract_meta(rows)
                if meta.get("end_user"):
                    office_name = meta["end_user"]
                if meta.get("title"):
                    title = meta["title"]
                if meta.get("fiscal_year"):
                    fiscal_year = meta["fiscal_year"]
                # Prefer first sheet that yields meta or items
                items_probe = _parse_ngpa_items(rows, is_cse=want_cse, office_code=office_name)
                if items_probe or meta.get("end_user") or meta.get("fiscal_year"):
                    break
            items = load_file_ppmp_items(path, is_cse=want_cse)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Skipping unreadable PPMP %s: %s", path, exc)
            items = []

        total = sum(float(it.get("estimated_budget") or 0) for it in items)
        results.append(
            {
                "id": _file_id(path),
                "filename": path.name,
                "office_name": office_name,
                "office_code": _office_from_filename(path.stem),
                "title": title,
                "item_count": len(items),
                "total_estimated_budget": total,
                "status": "File",
                "path": str(path.resolve()),
                "fiscal_year": fiscal_year,
                "is_cse": want_cse,
            }
        )
    return results


def load_all_file_items() -> List[dict]:
    """Load CSE + nonCSE file items for consolidation."""
    items: List[dict] = []
    for kind, is_cse in (("cse", True), ("noncse", False)):
        for entry in list_file_ppmps(kind):
            path = Path(entry["path"])
            try:
                items.extend(load_file_ppmp_items(path, is_cse=is_cse))
            except Exception as exc:  # noqa: BLE001
                logger.warning("Could not load items from %s: %s", path, exc)
    return items
