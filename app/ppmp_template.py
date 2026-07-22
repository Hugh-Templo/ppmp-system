"""
Per-office NGPA_PPMP.xlsx template management.

Each office keeps its own copy of the shared PPMP layout under
``templates/end-users/{office_code}/NGPA_PPMP.xlsx``. The master file at
``templates/NGPA_PPMP.xlsx`` is never modified — it is copied on first save
and then patched in-place with the office's signatory footer.

Cell layout on sheet ``Indicative PPMP (2)`` (verified against the master):

    A10 = "Fiscal Year : {year}"
    A11 = "End-User or Implementing Unit: {office name}"
    F7  = " INDICATIVE"      H7 = "FINAL"   (checkbox-style markers)
    Row 17 = instructional guide text (cleared for exported document)
    Rows 18-22 = 5 pre-formatted data rows (columns A..L)
    Row 23 col I = "TOTAL BUDGET:"   J23 = grand total
    B26 = "Prepared by:"                E26 = "Submitted by:"
    B28 = prepared_by (name)            E28 = submitted_by (name)
    B29 = prepared_by_designation       E29 = submitted_by_designation
    B30 = office name (unit label)      E30 = "Head of {office name}"

Public API:
    office_template_path(office)     -> absolute Path to the office xlsx
    ensure_office_template(office)   -> copy master if missing, return path
    write_signatory(office)          -> rewrite signatory footer from Office row
    export_ppmp_xlsx(office, ppmp)   -> bytes of a filled NGPA_PPMP.xlsx
"""

from __future__ import annotations

import io
import os
import re
import shutil
from copy import copy
from pathlib import Path
from typing import TYPE_CHECKING, Iterable

from openpyxl import load_workbook
from openpyxl.styles import Alignment, Border, Font, Side

if TYPE_CHECKING:
    from app.models import Office, PPMP, PPMPItem


REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = REPO_ROOT / "templates"
MASTER_TEMPLATE = TEMPLATES_DIR / "NGPA_PPMP.xlsx"
END_USERS_DIR = TEMPLATES_DIR / "end-users"

PPMP_SHEET = "Indicative PPMP (2)"

# Cells to write (see module docstring).
CELL_PREPARED_NAME = "B28"
CELL_PREPARED_DESIG = "B29"
CELL_PREPARED_UNIT = "B30"
CELL_SUBMITTED_NAME = "E28"
CELL_SUBMITTED_DESIG = "E29"
CELL_SUBMITTED_UNIT = "E30"
CELL_UNIT_HEADER = "A11"
CELL_FISCAL_YEAR = "A10"

# Layout constants for exporting item rows.
ITEM_START_ROW = 18
ITEM_END_ROW = 22            # Last pre-formatted data row in the master template.
TOTAL_ROW = 23               # Row where "TOTAL BUDGET:" label lives.
GUIDE_ROW = 17               # Instructional text row to blank out on export.
MARK_INDICATIVE = "F7"
MARK_FINAL = "H7"


def _safe_dir_name(code: str) -> str:
    """Sanitize an office code for use as a folder name (Windows-safe)."""
    cleaned = re.sub(r"[^A-Za-z0-9_\-]+", "_", (code or "").strip())
    return cleaned or "office"


def office_template_path(office: "Office") -> Path:
    """Return the absolute path where this office's NGPA_PPMP.xlsx lives."""
    return END_USERS_DIR / _safe_dir_name(office.code) / "NGPA_PPMP.xlsx"


def ensure_office_template(office: "Office") -> Path:
    """
    Copy the master NGPA_PPMP.xlsx into the office's folder if it isn't there
    yet. Returns the absolute path to the office file.
    """
    if not MASTER_TEMPLATE.exists():
        raise FileNotFoundError(
            f"Master PPMP template not found at {MASTER_TEMPLATE}"
        )

    dest = office_template_path(office)
    if not dest.exists():
        os.makedirs(dest.parent, exist_ok=True)
        shutil.copy2(MASTER_TEMPLATE, dest)
    return dest


def write_signatory(office: "Office") -> Path:
    """
    Rewrite the signatory footer of the office's NGPA_PPMP.xlsx from the
    values currently stored on the Office row. Returns the file path.
    """
    dest = ensure_office_template(office)

    wb = load_workbook(dest)
    if PPMP_SHEET in wb.sheetnames:
        ws = wb[PPMP_SHEET]
    else:
        ws = wb.worksheets[0]

    office_name = office.name or ""

    ws[CELL_UNIT_HEADER] = f"End-User or Implementing Unit: {office_name}"

    ws[CELL_PREPARED_NAME] = office.prepared_by or ""
    ws[CELL_PREPARED_DESIG] = office.prepared_by_designation or ""
    ws[CELL_PREPARED_UNIT] = office_name

    ws[CELL_SUBMITTED_NAME] = office.submitted_by or ""
    ws[CELL_SUBMITTED_DESIG] = office.submitted_by_designation or ""
    ws[CELL_SUBMITTED_UNIT] = f"Head of {office_name}" if office_name else ""

    wb.save(dest)
    return dest


def _yes_no(value) -> str:
    if value is None:
        return ""
    return "Yes" if value else "No"


def _item_quantity_size(item: "PPMPItem") -> str:
    """Prefer the NGPA free-text field, but fall back to qty + unit + name."""
    if item.quantity_size:
        return item.quantity_size
    qty = item.quantity
    uom = (item.unit_of_measure or "").strip()
    name = (item.description or "").strip()
    if qty is None and not uom and not name:
        return ""
    qty_str = "" if qty is None else str(qty)
    return " ".join(p for p in (qty_str, uom, name) if p).strip()


def _item_title_category(item: "PPMPItem") -> str:
    """NGPA Col 1: title/category, falling back to description for legacy rows."""
    category = (item.category or "").strip()
    if category:
        return category
    return item.description or ""


def _clone_row_style(ws, src_row: int, dst_row: int, last_col: int) -> None:
    """Copy per-cell style + row height from ``src_row`` onto ``dst_row``."""
    src_height = ws.row_dimensions[src_row].height
    if src_height is not None:
        ws.row_dimensions[dst_row].height = src_height
    for c in range(1, last_col + 1):
        src = ws.cell(row=src_row, column=c)
        dst = ws.cell(row=dst_row, column=c)
        if src.has_style:
            dst.font = copy(src.font)
            dst.fill = copy(src.fill)
            dst.border = copy(src.border)
            dst.alignment = copy(src.alignment)
            dst.number_format = src.number_format
            dst.protection = copy(src.protection)


def _write_item_row(ws, row: int, item: "PPMPItem") -> None:
    ws.cell(row=row, column=1, value=_item_title_category(item))
    ws.cell(row=row, column=2, value=item.project_type or "")
    ws.cell(row=row, column=3, value=_item_quantity_size(item))
    ws.cell(row=row, column=4, value=item.procurement_mode or "")
    ws.cell(row=row, column=5, value=_yes_no(item.pre_proc_conf))
    ws.cell(row=row, column=6, value=item.proc_start or "")
    ws.cell(row=row, column=7, value=item.proc_end or "")
    ws.cell(row=row, column=8, value=item.delivery_period or "")
    ws.cell(row=row, column=9, value=item.fund_source or "")
    budget_cell = ws.cell(row=row, column=10, value=float(item.estimated_budget or 0))
    budget_cell.number_format = "#,##0.00"
    ws.cell(row=row, column=11, value=item.supporting_docs or "")
    ws.cell(row=row, column=12, value=item.remarks or "")


def export_ppmp_xlsx(office: "Office", ppmp: "PPMP", items: Iterable["PPMPItem"]) -> bytes:
    """
    Return the office's NGPA_PPMP.xlsx filled with a PPMP header + line items.

    The office file (with signatory already written on save) is used as the
    base so the footer already reflects the current signatory values. Only
    the header/type marker, fiscal year, item rows, and total budget are
    (re)written on each export; the file itself is not modified.
    """
    dest = ensure_office_template(office)
    # Refresh signatory footer so a stale copy still exports the current values.
    write_signatory(office)

    wb = load_workbook(dest)
    ws = wb[PPMP_SHEET] if PPMP_SHEET in wb.sheetnames else wb.worksheets[0]

    office_name = office.name or ""
    fiscal_year = ppmp.fiscal_year if ppmp.fiscal_year is not None else ""
    ws[CELL_UNIT_HEADER] = f"End-User or Implementing Unit: {office_name}"
    ws[CELL_FISCAL_YEAR] = f"Fiscal Year : {fiscal_year}"

    # INDICATIVE / FINAL marker: driven by PPMP status, not the ``type`` column.
    # An Approved PPMP prints as FINAL; anything else (Draft, Returned, Pending
    # Budget Review) still prints as INDICATIVE regardless of the stored type.
    is_final = (ppmp.status or "").strip().lower() == "approved"
    if is_final:
        ws[MARK_INDICATIVE] = " INDICATIVE"
        ws[MARK_FINAL] = "✓ FINAL"
    else:
        ws[MARK_INDICATIVE] = "✓ INDICATIVE"
        ws[MARK_FINAL] = "FINAL"

    # Blank the instructional guide row (row 17) so it doesn't show up in the
    # exported document. Border styling is preserved via has_style.
    for c in range(1, 13):
        ws.cell(row=GUIDE_ROW, column=c).value = None

    items_list = list(items)
    template_slots = ITEM_END_ROW - ITEM_START_ROW + 1  # = 5
    extra = max(0, len(items_list) - template_slots)

    if extra:
        # Insert additional rows before the TOTAL row and clone styling from
        # the first data row so borders/heights match.
        ws.insert_rows(ITEM_END_ROW + 1, amount=extra)
        for offset in range(extra):
            _clone_row_style(ws, ITEM_START_ROW, ITEM_END_ROW + 1 + offset, 12)

    last_data_row = ITEM_START_ROW + max(len(items_list), template_slots) - 1
    for idx in range(last_data_row - ITEM_START_ROW + 1):
        row = ITEM_START_ROW + idx
        if idx < len(items_list):
            _write_item_row(ws, row, items_list[idx])
        else:
            for c in range(1, 13):
                ws.cell(row=row, column=c).value = None

    total_row = TOTAL_ROW + extra
    total_budget = sum(float(it.estimated_budget or 0) for it in items_list)
    ws.cell(row=total_row, column=9, value="TOTAL BUDGET:")
    total_cell = ws.cell(row=total_row, column=10, value=total_budget)
    total_cell.number_format = "#,##0.00"
    total_cell.font = Font(bold=True)

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream.getvalue()
